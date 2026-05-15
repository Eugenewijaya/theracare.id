import { db } from "../db/index.js";
import { parents, rescheduleRequests, therapists, therapySessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";
import { auditLogService } from "./audit-log.service.js";
import { evaluateOperationalSlot, evaluateSessionSlot } from "./scheduling-availability.service.js";
import { httpError } from "../utils/http-error.js";
import { isOpenRescheduleStatus } from "../domain/workflow-status.js";

type ProposedSlot = { date: string; time: string; status?: string; reason?: string; kind?: string };
type AuditActor = { id?: string; role?: string; name?: string; email?: string } | null | undefined;

const sessionTrackingDetails = {
  therapist: { with: { user: true } },
  room: true,
  therapyPeriod: { with: { program: true } },
} as const;

function normalizeDateKey(value?: string | null) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : raw;
}

function normalizeTimeKey(value?: string | null) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "";
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeProposedSlots(slots?: Array<{ date: string; time: string }> | null) {
  const seen = new Set<string>();
  return (Array.isArray(slots) ? slots : [])
    .map((slot) => ({ date: normalizeDateKey(slot?.date), time: normalizeTimeKey(slot?.time) }))
    .filter((slot) => slot.date && slot.time)
    .filter((slot) => {
      const key = `${slot.date} ${slot.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isClosedSessionStatus(status?: string | null) {
  return ["done", "completed", "selesai", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
}

function assertFutureSession(session: { date?: string | Date | null; status?: string | null }) {
  if (isClosedSessionStatus(session.status)) {
    throw httpError(409, "Sesi ini sudah selesai atau dibatalkan sehingga tidak bisa diajukan reschedule.");
  }
  const today = new Date().toISOString().slice(0, 10);
  const sessionDate = normalizeDateKey(session.date instanceof Date ? session.date.toISOString().slice(0, 10) : String(session.date || ""));
  if (sessionDate && sessionDate < today) {
    throw httpError(409, "Sesi lampau tidak bisa diajukan reschedule.");
  }
}

function roleLabel(role?: string | null) {
  if (role === "therapist") return "Terapis";
  if (role === "admin") return "Admin";
  if (role === "parent") return "Orang Tua";
  return "Sistem";
}

function reviewerValues(actor: AuditActor) {
  return {
    reviewedBy: actor?.id || null,
    reviewedByRole: actor?.role || null,
    reviewedByName: actor?.name || actor?.email || roleLabel(actor?.role),
  };
}

function removeCurrentSessionSlot(
  slots: Array<{ date: string; time: string }>,
  session: { date?: string | Date | null; startTime?: string | null },
) {
  const sessionDate = normalizeDateKey(session.date instanceof Date ? session.date.toISOString().slice(0, 10) : String(session.date || ""));
  const sessionTime = normalizeTimeKey(session.startTime || "");
  return slots.filter((slot) => !(slot.date === sessionDate && slot.time === sessionTime));
}

async function assertOperationalSlots(slots: Array<{ date: string; time: string }>) {
  const checks = await Promise.all(slots.map((slot) => evaluateOperationalSlot(slot)));
  const blocked = checks.find((slot) => slot.kind === "operational");
  if (blocked) {
    throw httpError(409, `${blocked.date} ${blocked.time}: ${blocked.reason}`, blocked);
  }
}

async function annotateSlotsForSession(
  session: typeof therapySessions.$inferSelect,
  slots: Array<{ date: string; time: string }>,
) {
  return Promise.all(slots.map((slot) => evaluateSessionSlot({
    therapistId: session.therapistId,
    childId: session.childId,
    roomId: session.roomId,
    date: slot.date,
    startTime: slot.time,
    duration: session.duration,
  }, session.id)));
}

async function enrichRequestSlots<T extends { id?: string; session?: any; sessionId: string; proposedSlots?: ProposedSlot[] | null }>(request: T) {
  const session = request.session || await db.query.therapySessions.findFirst({
    where: eq(therapySessions.id, request.sessionId),
  });
  if (!session) return request;
  const proposedSlots = await annotateSlotsForSession(session, normalizeProposedSlots(request.proposedSlots));
  return { ...request, proposedSlots };
}

async function enrichRequests<T extends { id?: string; session?: any; sessionId: string; proposedSlots?: ProposedSlot[] | null }>(requests: T[]) {
  return Promise.all(requests.map(enrichRequestSlots));
}

export const rescheduleService = {
  async getAll() {
    const requests = await db.query.rescheduleRequests.findMany({
      with: { parent: { with: { user: true } }, child: true, session: { with: sessionTrackingDetails } },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return enrichRequests(requests);
  },

  async getByParent(parentId: string) {
    const requests = await db.query.rescheduleRequests.findMany({
      where: eq(rescheduleRequests.parentId, parentId),
      with: { child: true, session: { with: sessionTrackingDetails } },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return enrichRequests(requests);
  },

  async getForTherapist(therapistId: string) {
    const sessions = await db.query.therapySessions.findMany({
      where: eq(therapySessions.therapistId, therapistId),
    });
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const allReqs = await db.query.rescheduleRequests.findMany({
      with: { parent: { with: { user: true } }, child: true, session: { with: sessionTrackingDetails } },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return enrichRequests(allReqs.filter((r) => sessionIds.includes(r.sessionId)));
  },

  async previewSlotsForSession(data: {
    childId: string; sessionId: string; proposedSlots?: Array<{ date: string; time: string }>;
  }) {
    const proposedSlots = normalizeProposedSlots(data.proposedSlots);
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, data.sessionId),
    });
    if (!session) throw httpError(404, "Sesi yang diajukan tidak ditemukan");
    if (session.childId !== data.childId) {
      throw httpError(403, "Sesi tidak sesuai dengan data anak");
    }
    assertFutureSession(session);
    const candidateSlots = removeCurrentSessionSlot(proposedSlots, session);
    if (candidateSlots.length === 0) return [];
    return annotateSlotsForSession(session, candidateSlots);
  },

  async create(data: {
    parentId: string; childId: string; sessionId: string;
    reason?: string; details?: string; proposedSlots?: Array<{ date: string; time: string }>;
  }, actor?: AuditActor) {
    const proposedSlots = normalizeProposedSlots(data.proposedSlots);
    if (proposedSlots.length === 0) {
      throw httpError(400, "Minimal satu preferensi jadwal wajib diisi");
    }

    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, data.sessionId),
    });
    if (!session) throw httpError(404, "Sesi yang diajukan tidak ditemukan");
    if (session.childId !== data.childId) {
      throw httpError(403, "Sesi tidak sesuai dengan data anak");
    }
    assertFutureSession(session);

    const candidateSlots = removeCurrentSessionSlot(proposedSlots, session);
    if (candidateSlots.length === 0) {
      throw httpError(400, "Pilih minimal satu opsi jadwal yang berbeda dari jadwal saat ini");
    }
    await assertOperationalSlots(candidateSlots);
    const annotatedSlots = await annotateSlotsForSession(session, candidateSlots);
    if (!annotatedSlots.some((slot) => slot.status === "available")) {
      throw httpError(409, "Semua opsi jadwal bentrok. Pilih minimal satu opsi yang tersedia.", { proposedSlots: annotatedSlots });
    }
    const openRequests = await db.query.rescheduleRequests.findMany({
      where: eq(rescheduleRequests.parentId, data.parentId),
    });
    const duplicateOpenRequest = openRequests.find((request) => (
      request.childId === data.childId
      && request.sessionId === data.sessionId
      && isOpenRescheduleStatus(request.status)
    ));
    if (duplicateOpenRequest) {
      throw httpError(409, "Sesi ini sudah memiliki pengajuan reschedule yang sedang diproses.");
    }
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, session.therapistId) });
    const req = await db.transaction(async (tx) => {
      const id = generateId("RR");
      const [created] = await tx.insert(rescheduleRequests).values({
        id,
        parentId: data.parentId,
        childId: data.childId,
        sessionId: data.sessionId,
        reason: data.reason,
        details: data.details,
        proposedSlots: annotatedSlots,
        status: "pending",
      }).returning();

      await notificationService.create({
        type: "reschedule_request",
        icon: "event_repeat",
        title: "Permintaan reschedule baru",
        message: `Orang tua mengajukan perubahan jadwal untuk sesi ${data.sessionId}.`,
        targetRole: "admin",
        relatedId: id,
      }, tx);
      if (therapist?.userId) {
        await notificationService.create({
          type: "reschedule_request",
          icon: "event_repeat",
          title: "Permintaan reschedule menunggu review",
          message: `Permintaan perubahan jadwal masuk untuk sesi ${data.sessionId}.`,
          targetRole: "therapist",
          targetUserId: therapist.userId,
          relatedId: id,
        }, tx);
      }
      await auditLogService.create({
        actor,
        action: "reschedule.create",
        entityType: "reschedule_request",
        entityId: id,
        summary: `Orang tua mengajukan reschedule sesi ${data.sessionId}`,
        metadata: { childId: data.childId, sessionId: data.sessionId, proposedSlots: annotatedSlots },
      }, tx);
      return created;
    });
    return enrichRequestSlots(req);
  },

  async updateStatus(id: string, status: string, updates: {
    reviewNote?: string; newDate?: string; newStartTime?: string;
  } = {}, actor?: AuditActor) {
    const req = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.id, id) });
    if (!req) return null;
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, req.parentId) });
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, req.sessionId),
    });

    if (status === "approved") {
      if (!session) throw httpError(404, "Sesi asli tidak ditemukan");
      if (!updates.newDate) throw httpError(400, "Pilih slot jadwal baru yang tersedia");
      const chosenSlot = { date: updates.newDate, time: updates.newStartTime || session.startTime };
      const availability = await evaluateSessionSlot({
        therapistId: session.therapistId,
        childId: session.childId,
        roomId: session.roomId,
        date: chosenSlot.date,
        startTime: chosenSlot.time,
        duration: session.duration,
      }, session.id);
      if (availability.status !== "available") {
        throw httpError(409, `Slot tidak bisa dipilih: ${availability.reason || "jadwal bentrok"}`, availability);
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(rescheduleRequests).set({
        status,
        resolvedAt: new Date(),
        ...(updates.reviewNote ? { reviewNote: updates.reviewNote } : {}),
        ...reviewerValues(actor),
        ...(updates.newDate ? { newDate: updates.newDate } : {}),
        ...(updates.newStartTime ? { newStartTime: updates.newStartTime } : {}),
      }).where(eq(rescheduleRequests.id, id));

      if (status === "approved" && updates.newDate && session) {
        await tx.update(therapySessions)
          .set({
            date: updates.newDate,
            startTime: updates.newStartTime || session.startTime,
            status: "upcoming",
          })
          .where(eq(therapySessions.id, session.id));
      }

      if (parent?.userId) {
        await notificationService.create({
          type: "reschedule_result",
          icon: status === "approved" ? "event_available" : "event_busy",
          title: status === "approved" ? "Reschedule disetujui" : "Reschedule diperbarui",
          message: updates.reviewNote || (
            status === "approved" && updates.newDate
              ? `Jadwal baru: ${updates.newDate} ${updates.newStartTime || session?.startTime || ""}.`
              : `Permintaan reschedule ${req.sessionId} berstatus ${status}.`
          ),
          targetRole: "parent",
          targetUserId: parent.userId,
          relatedId: id,
        }, tx);
      }
      if (status === "approved" && session) {
        const therapist = await tx.query.therapists.findFirst({ where: eq(therapists.id, session.therapistId) });
        if (therapist?.userId) {
          await notificationService.create({
            type: "schedule_change",
            icon: "event_available",
            title: "Jadwal sesi diperbarui",
            message: `Sesi ${req.sessionId} dipindahkan ke ${updates.newDate} ${updates.newStartTime || session.startTime}.`,
            targetRole: "therapist",
            targetUserId: therapist.userId,
            relatedId: id,
          }, tx);
        }
      }
      await auditLogService.create({
        actor,
        action: "reschedule.status.update",
        entityType: "reschedule_request",
        entityId: id,
        summary: `Status reschedule diubah menjadi ${status}`,
        metadata: { status, ...updates },
      }, tx);
    });

    return this.getAll().then((all: any[]) => all.find((r) => r.id === id));
  },

  async respondAsTherapist(id: string, therapistId: string, data: {
    decision: "approve" | "reject";
    reviewNote?: string;
    newDate?: string;
    newStartTime?: string;
  }, actor?: AuditActor) {
    const req = await db.query.rescheduleRequests.findFirst({
      where: eq(rescheduleRequests.id, id),
      with: { parent: { with: { user: true } }, child: true, session: true },
    });
    if (!req) return null;
    if (!req.session || req.session.therapistId !== therapistId) {
      throw httpError(403, "Hanya terapis utama sesi ini yang dapat merespons pengajuan reschedule");
    }
    if (!isOpenRescheduleStatus(req.status)) {
      return enrichRequestSlots(req);
    }

    const note = String(data.reviewNote || "").trim();
    if (data.decision === "reject") {
      if (note.length < 8) throw httpError(400, "Alasan penolakan wajib diisi dengan jelas");
      await db.transaction(async (tx) => {
        await tx.update(rescheduleRequests)
          .set({
            status: "rejected",
            reviewNote: note,
            resolvedAt: new Date(),
            ...reviewerValues(actor),
          })
          .where(eq(rescheduleRequests.id, id));

        if (req.parent?.userId) {
          await notificationService.create({
            type: "reschedule_result",
            icon: "event_busy",
            title: "Reschedule belum disetujui",
            message: note,
            targetRole: "parent",
            targetUserId: req.parent.userId,
            relatedId: id,
          }, tx);
        }
        await notificationService.create({
          type: "reschedule_result",
          icon: "rule",
          title: "Terapis menolak reschedule",
          message: `${req.child?.name || req.childId} - ${note}`,
          targetRole: "admin",
          relatedId: id,
        }, tx);
        await auditLogService.create({
          actor,
          action: "reschedule.therapist.reject",
          entityType: "reschedule_request",
          entityId: id,
          summary: "Terapis utama menolak reschedule",
          metadata: data,
        }, tx);
      });
      return this.getAll().then((all: any[]) => all.find((r) => r.id === id));
    }

    const normalizedSlots = normalizeProposedSlots(req.proposedSlots as any);
    const preferred = {
      date: data.newDate || "",
      time: data.newStartTime || "",
    };
    const candidates = [
      ...(preferred.date && preferred.time ? [preferred] : []),
      ...normalizedSlots,
    ];
    let chosen: ProposedSlot | null = null;
    let lastReason = "";

    for (const slot of candidates) {
      const availability = await evaluateSessionSlot({
        therapistId: req.session.therapistId,
        childId: req.session.childId,
        roomId: req.session.roomId,
        date: slot.date,
        startTime: slot.time,
        duration: req.session.duration,
      }, req.session.id);
      if (availability.status === "available") {
        chosen = slot;
        break;
      }
      lastReason = availability.reason || lastReason;
    }

    if (!chosen) {
      throw httpError(409, lastReason || "Tidak ada opsi jadwal yang tersedia untuk disetujui");
    }

    await db.transaction(async (tx) => {
      await tx.update(rescheduleRequests)
        .set({
          status: "approved",
          reviewNote: note || "Disetujui langsung oleh terapis utama.",
          newDate: chosen.date,
          newStartTime: chosen.time,
          resolvedAt: new Date(),
          ...reviewerValues(actor),
        })
        .where(eq(rescheduleRequests.id, id));

      await tx.update(therapySessions)
        .set({
          date: chosen.date,
          startTime: chosen.time,
          status: "upcoming",
        })
        .where(eq(therapySessions.id, req.session.id));

      if (req.parent?.userId) {
        await notificationService.create({
          type: "reschedule_result",
          icon: "event_available",
          title: "Reschedule disetujui terapis",
          message: `Jadwal baru: ${chosen.date} ${chosen.time}. ${note}`.trim(),
          targetRole: "parent",
          targetUserId: req.parent.userId,
          relatedId: id,
        }, tx);
      }
      await notificationService.create({
        type: "schedule_change",
        icon: "event_available",
        title: "Reschedule disetujui langsung oleh terapis",
        message: `${req.child?.name || req.childId} dipindahkan ke ${chosen.date} ${chosen.time}.`,
        targetRole: "admin",
        relatedId: id,
      }, tx);
      await auditLogService.create({
        actor,
        action: "reschedule.therapist.approve",
        entityType: "reschedule_request",
        entityId: id,
        summary: "Terapis utama menyetujui reschedule",
        metadata: { ...data, chosenSlot: chosen },
      }, tx);
    });

    return this.getAll().then((all: any[]) => all.find((r) => r.id === id));
  },

  async delete(id: string, actor?: AuditActor) {
    const req = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.id, id) });
    if (!req) return null;
    return db.transaction(async (tx) => {
      await tx.delete(rescheduleRequests).where(eq(rescheduleRequests.id, id));
      await auditLogService.create({
        actor,
        action: "reschedule.delete",
        entityType: "reschedule_request",
        entityId: id,
        summary: `Permintaan reschedule ${id} dihapus`,
        metadata: { childId: req.childId, sessionId: req.sessionId },
      }, tx);
      return { deleted: true, id };
    });
  },
};
