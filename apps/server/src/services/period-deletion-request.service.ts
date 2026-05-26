import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, historicalSessionSummaries, therapists, therapyPeriods, therapySessions } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

const PERIOD_DELETION_REQUESTS_KEY = "periodDeletionRequests";
const DELETABLE_SESSION_STATUSES = ["upcoming", "confirmed", "active", "cancelled"];

type ApprovalStatus = "pending" | "approved" | "rejected";
type RequestStatus = "pending" | "approved" | "rejected" | "executed";

type PeriodDeletionRequest = {
  id: string;
  periodId: string;
  childId: string;
  childName: string;
  periodName: string;
  programName: string;
  reason: string;
  status: RequestStatus;
  parentApproval: {
    status: ApprovalStatus;
    userId?: string;
    name?: string;
    respondedAt?: string;
    note?: string;
  };
  therapistApproval: {
    status: ApprovalStatus;
    userIds: string[];
    therapistIds: string[];
    name?: string;
    respondedAt?: string;
    note?: string;
  };
  requestedByUserId?: string;
  requestedByRole?: string;
  requestedByName?: string;
  deletedSessionCount?: number;
  deletedSessionIds?: string[];
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
  history: Array<{
    actorUserId?: string;
    actorRole?: string;
    actorName?: string;
    action: string;
    note?: string;
    createdAt: string;
  }>;
};

type Actor = {
  id?: string;
  role?: string;
  name?: string;
  email?: string;
};

function safeJsonParse(value?: string | null): PeriodDeletionRequest[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readRequests() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, PERIOD_DELETION_REQUESTS_KEY),
  });
  return safeJsonParse(row?.value);
}

async function writeRequests(requests: PeriodDeletionRequest[]) {
  await db.insert(clinicSettings)
    .values({
      key: PERIOD_DELETION_REQUESTS_KEY,
      value: JSON.stringify(requests),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: {
        value: JSON.stringify(requests),
        updatedAt: new Date(),
      },
    });
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())));
}

function getScheduleTherapistIds(period: any) {
  return uniqueStrings([
    ...((Array.isArray(period?.scheduleRules) ? period.scheduleRules : []).map((rule: any) => rule?.therapistId)),
    ...((Array.isArray(period?.assistantTherapistIds) ? period.assistantTherapistIds : [])),
    ...((Array.isArray(period?.sessions) ? period.sessions : []).map((session: any) => session?.therapistId)),
  ]);
}

function summarizeRequest(request: PeriodDeletionRequest) {
  return {
    ...request,
    requiresParentApproval: request.parentApproval.status === "pending",
    requiresTherapistApproval: request.therapistApproval.status === "pending",
    approvalComplete: request.parentApproval.status === "approved" && request.therapistApproval.status === "approved",
  };
}

async function getPeriodContext(periodId: string) {
  const period = await db.query.therapyPeriods.findFirst({
    where: eq(therapyPeriods.id, periodId),
    with: {
      child: { with: { parent: { with: { user: true } } } },
      program: true,
      therapyProgram: true,
      sessions: true,
    },
  });
  if (!period) return null;

  const therapistIds = getScheduleTherapistIds(period);
  const therapistRows = therapistIds.length
    ? await db.query.therapists.findMany({ where: inArray(therapists.id, therapistIds) })
    : [];
  const therapistUserIds = uniqueStrings(therapistRows.map((therapist) => therapist.userId));

  return {
    period,
    programName: period.program?.name || period.therapyProgram?.type || "Program Terapi",
    childName: period.child?.name || period.childId,
    parentUserId: period.child?.parent?.userId || "",
    therapistIds,
    therapistUserIds,
  };
}

async function notifyUsers(targetRole: string, userIds: string[], payload: { title: string; message: string; relatedId: string; type?: string; icon?: string }) {
  for (const userId of userIds) {
    await notificationService.create({
      type: payload.type || "period_deletion_request",
      icon: payload.icon || "delete_forever",
      title: payload.title,
      message: payload.message,
      targetRole,
      targetUserId: userId,
      relatedId: payload.relatedId,
    });
  }
}

async function executeApprovedRequest(request: PeriodDeletionRequest) {
  const period = await db.query.therapyPeriods.findFirst({
    where: eq(therapyPeriods.id, request.periodId),
    with: { sessions: true },
  });
  if (!period) throw new Error("Periode terapi tidak ditemukan.");

  const deleted = await db.transaction(async (tx) => {
    const removed = await tx.delete(therapySessions)
      .where(and(
        eq(therapySessions.therapyPeriodId, request.periodId),
        inArray(therapySessions.status, DELETABLE_SESSION_STATUSES),
      ))
      .returning({ id: therapySessions.id });

    const doneCount = Array.isArray(period.sessions)
      ? period.sessions.filter((session: any) => session.status === "done" || session.status === "completed").length
      : 0;
    const [historicalRow] = await tx
      .select({ count: sql<number>`coalesce(sum(${historicalSessionSummaries.completedCount}), 0)` })
      .from(historicalSessionSummaries)
      .where(eq(historicalSessionSummaries.therapyPeriodId, request.periodId));
    const previousNotes = typeof period.notes === "string" && period.notes.trim() ? `${period.notes.trim()}\n\n` : "";
    await tx.update(therapyPeriods)
      .set({
        status: "cancelled",
        completedSessions: doneCount + Number(historicalRow?.count || 0),
        notes: `${previousNotes}Periode dibatalkan melalui persetujuan orang tua dan terapis pada ${new Date().toISOString()}. Alasan: ${request.reason}`,
        updatedAt: new Date(),
      })
      .where(eq(therapyPeriods.id, request.periodId));

    return removed;
  });

  const now = new Date().toISOString();
  return {
    ...request,
    status: "executed" as RequestStatus,
    deletedSessionCount: deleted.length,
    deletedSessionIds: deleted.map((row) => row.id),
    executedAt: now,
    updatedAt: now,
    history: [
      ...request.history,
      {
        actorRole: "system",
        action: "period_deletion.executed",
        note: `${deleted.length} sesi belum selesai dihapus dan periode ditandai cancelled.`,
        createdAt: now,
      },
    ],
  };
}

export const periodDeletionRequestService = {
  async getAllForUser(actor: Actor) {
    const requests = await readRequests();
    if (actor.role === "admin") return requests.map(summarizeRequest);
    if (actor.role === "parent") {
      return requests
        .filter((request) => request.parentApproval.userId === actor.id)
        .map(summarizeRequest);
    }
    if (actor.role === "therapist") {
      return requests
        .filter((request) => request.therapistApproval.userIds.includes(actor.id || ""))
        .map(summarizeRequest);
    }
    return [];
  },

  async create(periodId: string, actor: Actor, reason = "") {
    const context = await getPeriodContext(periodId);
    if (!context) return null;
    if (!["active", "planned"].includes(String(context.period.status || "").toLowerCase())) {
      throw new Error("Hanya periode active atau planned yang dapat diajukan untuk dihapus.");
    }
    if (!context.parentUserId) throw new Error("Akun orang tua periode ini belum terhubung.");
    if (context.therapistUserIds.length === 0) throw new Error("Periode ini belum memiliki terapis untuk persetujuan.");

    const requests = await readRequests();
    const existing = requests.find((request) => request.periodId === periodId && request.status === "pending");
    if (existing) return summarizeRequest(existing);

    const now = new Date().toISOString();
    const request: PeriodDeletionRequest = {
      id: generateId("PDR"),
      periodId,
      childId: context.period.childId,
      childName: context.childName,
      periodName: context.period.name,
      programName: context.programName,
      reason: reason.trim() || "Admin mengajukan penghapusan periode berjalan.",
      status: "pending",
      parentApproval: {
        status: "pending",
        userId: context.parentUserId,
      },
      therapistApproval: {
        status: "pending",
        userIds: context.therapistUserIds,
        therapistIds: context.therapistIds,
      },
      requestedByUserId: actor.id,
      requestedByRole: actor.role,
      requestedByName: actor.name || actor.email,
      createdAt: now,
      updatedAt: now,
      history: [{
        actorUserId: actor.id,
        actorRole: actor.role,
        actorName: actor.name || actor.email,
        action: "period_deletion.requested",
        note: reason.trim(),
        createdAt: now,
      }],
    };

    await writeRequests([request, ...requests]);

    const message = `Admin meminta persetujuan untuk menghapus sesi belum selesai pada ${context.period.name} - ${context.programName} milik ${context.childName}. Alasan: ${request.reason}`;
    await notifyUsers("parent", [context.parentUserId], {
      title: "Persetujuan hapus periode berjalan",
      message,
      relatedId: request.id,
    });
    await notifyUsers("therapist", context.therapistUserIds, {
      title: "Konfirmasi hapus periode berjalan",
      message,
      relatedId: request.id,
    });

    return summarizeRequest(request);
  },

  async respond(requestId: string, actor: Actor, decision: ApprovalStatus, note = "") {
    if (!["approved", "rejected"].includes(decision)) {
      throw new Error("Keputusan persetujuan tidak valid.");
    }

    const requests = await readRequests();
    const index = requests.findIndex((request) => request.id === requestId);
    if (index < 0) return null;

    const current = requests[index];
    if (current.status !== "pending") {
      throw new Error("Pengajuan ini sudah selesai dan tidak dapat diubah.");
    }

    const now = new Date().toISOString();
    let updated: PeriodDeletionRequest = { ...current };

    if (actor.role === "parent") {
      if (current.parentApproval.userId !== actor.id) throw new Error("Akses persetujuan orang tua ditolak.");
      updated = {
        ...updated,
        parentApproval: {
          ...updated.parentApproval,
          status: decision,
          name: actor.name || actor.email,
          respondedAt: now,
          note: note.trim(),
        },
      };
    } else if (actor.role === "therapist") {
      if (!current.therapistApproval.userIds.includes(actor.id || "")) throw new Error("Akses persetujuan terapis ditolak.");
      updated = {
        ...updated,
        therapistApproval: {
          ...updated.therapistApproval,
          status: decision,
          name: actor.name || actor.email,
          respondedAt: now,
          note: note.trim(),
        },
      };
    } else {
      throw new Error("Hanya orang tua dan terapis terkait yang dapat memberi persetujuan.");
    }

    updated = {
      ...updated,
      updatedAt: now,
      history: [
        ...updated.history,
        {
          actorUserId: actor.id,
          actorRole: actor.role,
          actorName: actor.name || actor.email,
          action: `period_deletion.${decision}`,
          note: note.trim(),
          createdAt: now,
        },
      ],
    };

    if (decision === "rejected") {
      updated.status = "rejected";
    } else if (updated.parentApproval.status === "approved" && updated.therapistApproval.status === "approved") {
      updated.status = "approved";
      updated = await executeApprovedRequest(updated);
    }

    requests[index] = updated;
    await writeRequests(requests);

    const resultType = updated.status === "executed" ? "period_deletion_result" : "period_deletion_request";
    if (updated.status === "rejected" || updated.status === "executed") {
      const title = updated.status === "executed" ? "Periode berjalan berhasil dihapus" : "Penghapusan periode ditolak";
      const message = updated.status === "executed"
        ? `${updated.periodName} milik ${updated.childName} dibatalkan. ${updated.deletedSessionCount || 0} sesi belum selesai dihapus.`
        : `${actor.role === "parent" ? "Orang tua" : "Terapis"} menolak penghapusan ${updated.periodName} milik ${updated.childName}.`;
      await notificationService.create({
        type: resultType,
        icon: updated.status === "executed" ? "task_alt" : "block",
        title,
        message,
        targetRole: "admin",
        relatedId: updated.id,
      });
      if (updated.parentApproval.userId) {
        await notifyUsers("parent", [updated.parentApproval.userId], {
          title,
          message,
          relatedId: updated.id,
          type: resultType,
          icon: updated.status === "executed" ? "task_alt" : "block",
        });
      }
      await notifyUsers("therapist", updated.therapistApproval.userIds, {
        title,
        message,
        relatedId: updated.id,
        type: resultType,
        icon: updated.status === "executed" ? "task_alt" : "block",
      });
    }

    return summarizeRequest(updated);
  },

  async getDeveloperSnapshot() {
    return (await readRequests()).map(summarizeRequest);
  },
};

export type { PeriodDeletionRequest };
