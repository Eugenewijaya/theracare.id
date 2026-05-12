import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, therapists, therapySessions } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";
import { evaluateSessionSlot, evaluateTherapistSlot, getAvailableTherapistsForSlot } from "./scheduling-availability.service.js";

const SUBSTITUTE_REQUESTS_KEY = "substituteTherapistRequests";

type SubstituteRequestStatus = "pending_primary" | "approved" | "declined";

type SubstituteRequest = {
  id: string;
  requestKind?: "substitute" | "session_update";
  sessionId: string;
  childId: string;
  childName: string;
  date: string;
  startTime: string;
  focus?: string;
  leaveType: string;
  note?: string;
  originalTherapistId: string;
  originalTherapistUserId?: string;
  originalTherapistName: string;
  substituteTherapistId: string;
  substituteTherapistUserId?: string;
  substituteTherapistName: string;
  suggestedSubstituteId?: string;
  proposedUpdates?: Record<string, unknown>;
  responseNote?: string;
  status: SubstituteRequestStatus;
  createdBy?: string;
  createdAt: string;
  respondedAt?: string;
};

function parseRequests(value?: string | null): SubstituteRequest[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readRequests() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, SUBSTITUTE_REQUESTS_KEY),
  });
  return parseRequests(row?.value);
}

async function writeRequests(requests: SubstituteRequest[]) {
  await db.insert(clinicSettings)
    .values({
      key: SUBSTITUTE_REQUESTS_KEY,
      value: JSON.stringify(requests),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(requests), updatedAt: new Date() },
    });
}

function sortRequests(requests: SubstituteRequest[]) {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function enrichRequest(request: SubstituteRequest) {
  return {
    ...request,
    availableTherapists: await getAvailableTherapistsForSlot(request.date, request.startTime, {
      excludeTherapistId: request.originalTherapistId,
      excludeSessionId: request.sessionId,
    }),
  };
}

async function notifyParentIfAvailable(sessionId: string, title: string, message: string, relatedId: string) {
  const session = await db.query.therapySessions.findFirst({
    where: eq(therapySessions.id, sessionId),
    with: { child: { with: { parent: { with: { user: true } } } } },
  });
  const parentUserId = session?.child?.parent?.userId;
  if (!parentUserId) return;
  await notificationService.create({
    type: "schedule_change",
    icon: "event_available",
    title,
    message,
    targetRole: "parent",
    targetUserId: parentUserId,
    relatedId,
  });
}

export const substituteRequestService = {
  async getAll() {
    const requests = sortRequests(await readRequests());
    return Promise.all(requests.map(enrichRequest));
  },

  async getForTherapist(therapistId: string) {
    const requests = sortRequests(await readRequests()).filter((request) => (
      request.originalTherapistId === therapistId
      || request.substituteTherapistId === therapistId
      || request.suggestedSubstituteId === therapistId
    ));
    return Promise.all(requests.map(enrichRequest));
  },

  async createByAdmin(data: { sessionId: string; substituteTherapistId: string; leaveType: string; note?: string }, adminUserId?: string) {
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, data.sessionId),
      with: {
        therapist: { with: { user: true } },
        child: true,
      },
    });
    if (!session) throw new Error("Sesi tidak ditemukan");
    if (session.therapistId === data.substituteTherapistId) {
      throw new Error("Terapis pengganti tidak boleh sama dengan terapis utama");
    }

    const substitute = await db.query.therapists.findFirst({
      where: eq(therapists.id, data.substituteTherapistId),
      with: { user: true },
    });
    if (!substitute) throw new Error("Terapis pengganti tidak ditemukan");

    const availability = await evaluateTherapistSlot(data.substituteTherapistId, {
      date: session.date,
      time: session.startTime,
    }, session.id);
    if (availability.status !== "available") {
      throw new Error(availability.reason || "Terapis pengganti bentrok pada slot tersebut");
    }

    const request: SubstituteRequest = {
      id: generateId("SUB"),
      requestKind: "substitute",
      sessionId: session.id,
      childId: session.childId,
      childName: session.child?.name || session.childId,
      date: session.date,
      startTime: session.startTime,
      focus: session.focus || "",
      leaveType: data.leaveType,
      note: (data.note || "").trim(),
      originalTherapistId: session.therapistId,
      originalTherapistUserId: session.therapist?.userId,
      originalTherapistName: session.therapist?.user?.name || session.therapistId,
      substituteTherapistId: substitute.id,
      substituteTherapistUserId: substitute.userId,
      substituteTherapistName: substitute.user?.name || substitute.nit,
      status: "pending_primary",
      createdBy: adminUserId,
      createdAt: new Date().toISOString(),
    };

    const requests = await readRequests();
    await writeRequests([request, ...requests]);

    if (request.originalTherapistUserId) {
      await notificationService.create({
        type: "substitute_confirmation",
        icon: "assignment_ind",
        title: "Konfirmasi terapis pengganti",
        message: `Admin meminta konfirmasi pergantian sesi ${request.childName} pada ${request.date} ${request.startTime} ke ${request.substituteTherapistName}.`,
        targetRole: "therapist",
        targetUserId: request.originalTherapistUserId,
        relatedId: request.id,
      });
    }

    return enrichRequest(request);
  },

  async createSessionUpdateByAdmin(data: { sessionId: string; updates: Record<string, unknown>; note?: string }, adminUserId?: string) {
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, data.sessionId),
      with: {
        therapist: { with: { user: true } },
        child: true,
      },
    });
    if (!session) throw new Error("Sesi tidak ditemukan");
    const allowedUpdates = Object.fromEntries(
      Object.entries(data.updates || {}).filter(([key, value]) => (
        ["date", "startTime", "duration", "focus", "roomId"].includes(key) && value !== undefined
      ))
    );
    if (Object.keys(allowedUpdates).length === 0) throw new Error("Tidak ada perubahan jadwal/program yang valid");

    const request: SubstituteRequest = {
      id: generateId("SCH"),
      requestKind: "session_update",
      sessionId: session.id,
      childId: session.childId,
      childName: session.child?.name || session.childId,
      date: session.date,
      startTime: session.startTime,
      focus: session.focus || "",
      leaveType: "schedule_update",
      note: (data.note || "").trim(),
      originalTherapistId: session.therapistId,
      originalTherapistUserId: session.therapist?.userId,
      originalTherapistName: session.therapist?.user?.name || session.therapistId,
      substituteTherapistId: session.therapistId,
      substituteTherapistUserId: session.therapist?.userId,
      substituteTherapistName: session.therapist?.user?.name || session.therapistId,
      proposedUpdates: allowedUpdates,
      status: "pending_primary",
      createdBy: adminUserId,
      createdAt: new Date().toISOString(),
    };

    const requests = await readRequests();
    await writeRequests([request, ...requests]);

    if (request.originalTherapistUserId) {
      await notificationService.create({
        type: "schedule_change_confirmation",
        icon: "rule",
        title: "Konfirmasi perubahan jadwal/program",
        message: `Admin meminta persetujuan perubahan sesi ${request.childName} pada ${request.date} ${request.startTime}.`,
        targetRole: "therapist",
        targetUserId: request.originalTherapistUserId,
        relatedId: request.id,
      });
    }

    return enrichRequest(request);
  },

  async respondAsPrimaryTherapist(id: string, therapistId: string, data: {
    decision: "approve" | "decline";
    suggestedSubstituteId?: string;
    responseNote?: string;
  }) {
    const requests = await readRequests();
    const index = requests.findIndex((request) => request.id === id);
    if (index === -1) return null;
    const current = requests[index];
    if (current.originalTherapistId !== therapistId) {
      throw new Error("Hanya terapis utama yang dapat merespons konfirmasi ini");
    }
    if (current.status !== "pending_primary") {
      return enrichRequest(current);
    }

    const now = new Date().toISOString();
    const responseNote = (data.responseNote || "").trim();

    if (data.decision === "approve") {
      if (current.requestKind === "session_update") {
        const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, current.sessionId) });
        if (!session) throw new Error("Sesi tidak ditemukan");
        const updates = current.proposedUpdates || {};
        const next = {
          ...session,
          ...updates,
          therapistId: session.therapistId,
          childId: session.childId,
        };
        if (["date", "startTime", "duration", "roomId"].some((key) => Object.prototype.hasOwnProperty.call(updates, key))) {
          const availability = await evaluateSessionSlot({
            therapistId: next.therapistId,
            childId: next.childId,
            roomId: (next.roomId as string | null) || undefined,
            date: next.date,
            startTime: next.startTime,
            duration: next.duration || undefined,
          }, current.sessionId);
          if (availability.status !== "available") {
            throw new Error(availability.reason || "Perubahan jadwal bentrok atau di luar jam operasional");
          }
        }
        const existingNotes = String(session.notes || "").trim();
        const approvalLine = `[${now}] Terapis utama menyetujui perubahan jadwal/program. ${responseNote}`.trim();
        await db.update(therapySessions)
          .set({
            ...(typeof updates.date === "string" ? { date: updates.date } : {}),
            ...(typeof updates.startTime === "string" ? { startTime: updates.startTime } : {}),
            ...(typeof updates.duration === "string" ? { duration: updates.duration } : {}),
            ...(typeof updates.focus === "string" ? { focus: updates.focus } : {}),
            ...(typeof updates.roomId === "string" ? { roomId: updates.roomId } : {}),
            status: "upcoming",
            notes: existingNotes ? `${existingNotes}\n${approvalLine}` : approvalLine,
          })
          .where(eq(therapySessions.id, current.sessionId));

        const approvedRequest = { ...current, status: "approved" as const, responseNote, respondedAt: now };
        requests[index] = approvedRequest;
        await writeRequests(requests);

        await notificationService.create({
          type: "schedule_change_result",
          icon: "rule",
          title: "Perubahan jadwal/program disetujui",
          message: `${current.originalTherapistName} menyetujui perubahan sesi ${current.childName}.`,
          targetRole: "admin",
          relatedId: current.id,
        });
        await notifyParentIfAvailable(
          current.sessionId,
          "Jadwal terapi diperbarui",
          `Jadwal/program sesi ${current.childName} pada ${current.date} ${current.startTime} sudah diperbarui setelah konfirmasi terapis.`,
          current.id,
        );

        return enrichRequest(approvedRequest);
      }

      const replacementLine = `[${now}] Terapis utama menyetujui pergantian ke ${current.substituteTherapistName}. ${responseNote}`.trim();
      const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, current.sessionId) });
      const existingNotes = String(session?.notes || "").trim();
      await db.update(therapySessions)
        .set({
          therapistId: current.substituteTherapistId,
          status: "upcoming",
          notes: existingNotes ? `${existingNotes}\n${replacementLine}` : replacementLine,
          cancelReason: `Terapis utama ${current.originalTherapistName} menyetujui pengganti ${current.substituteTherapistName}.`,
        })
        .where(eq(therapySessions.id, current.sessionId));

      const next = { ...current, status: "approved" as const, responseNote, respondedAt: now };
      requests[index] = next;
      await writeRequests(requests);

      await notificationService.create({
        type: "substitute_result",
        icon: "assignment_turned_in",
        title: "Pergantian terapis disetujui",
        message: `${current.originalTherapistName} menyetujui ${current.substituteTherapistName} untuk sesi ${current.childName}.`,
        targetRole: "admin",
        relatedId: current.id,
      });
      if (current.substituteTherapistUserId) {
        await notificationService.create({
          type: "new_session",
          icon: "event_available",
          title: "Sesi pengganti ditugaskan",
          message: `Anda menjadi terapis bertugas untuk ${current.childName} pada ${current.date} ${current.startTime}.`,
          targetRole: "therapist",
          targetUserId: current.substituteTherapistUserId,
          relatedId: current.id,
        });
      }
      await notifyParentIfAvailable(
        current.sessionId,
        "Jadwal terapis diperbarui",
        `Terapis bertugas untuk sesi ${current.childName} pada ${current.date} ${current.startTime} diperbarui ke ${current.substituteTherapistName}.`,
        current.id,
      );

      return enrichRequest(next);
    }

    const suggested = data.suggestedSubstituteId
      ? await db.query.therapists.findFirst({ where: eq(therapists.id, data.suggestedSubstituteId), with: { user: true } })
      : null;
    const next = {
      ...current,
      status: "declined" as const,
      suggestedSubstituteId: suggested?.id,
      responseNote,
      respondedAt: now,
    };
    requests[index] = next;
    await writeRequests(requests);

    await notificationService.create({
      type: "substitute_result",
      icon: "assignment_late",
      title: "Pergantian terapis belum disetujui",
      message: `${current.originalTherapistName} belum menyetujui pergantian. ${suggested ? `Saran pengganti: ${suggested.user?.name || suggested.nit}.` : ""} ${responseNote}`,
      targetRole: "admin",
      relatedId: current.id,
    });

    return enrichRequest(next);
  },
};
