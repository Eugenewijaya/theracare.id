import { db } from "../db/index.js";
import { parents, rescheduleRequests, therapists, therapySessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";
import { sessionService } from "./session.service.js";

function httpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

export const rescheduleService = {
  async getAll() {
    return db.query.rescheduleRequests.findMany({
      with: { parent: { with: { user: true } }, child: true, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  },

  async getByParent(parentId: string) {
    return db.query.rescheduleRequests.findMany({
      where: eq(rescheduleRequests.parentId, parentId),
      with: { child: true, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  },

  async getForTherapist(therapistId: string) {
    const sessions = await db.query.therapySessions.findMany({
      where: eq(therapySessions.therapistId, therapistId),
    });
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const allReqs = await db.query.rescheduleRequests.findMany({
      with: { parent: { with: { user: true } }, child: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return allReqs.filter((r) => sessionIds.includes(r.sessionId));
  },

  async create(data: {
    parentId: string; childId: string; sessionId: string;
    reason?: string; details?: string; proposedSlots?: Array<{ date: string; time: string }>;
  }) {
    const id = generateId("RR");
    const [req] = await db.insert(rescheduleRequests).values({
      id, ...data, status: "pending",
    }).returning();
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, data.sessionId),
    });
    await notificationService.create({
      type: "reschedule_request",
      icon: "event_repeat",
      title: "Permintaan reschedule baru",
      message: `Orang tua mengajukan perubahan jadwal untuk sesi ${data.sessionId}.`,
      targetRole: "admin",
      relatedId: id,
    });
    if (session) {
      const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, session.therapistId) });
      if (therapist?.userId) {
        await notificationService.create({
          type: "reschedule_request",
          icon: "event_repeat",
          title: "Permintaan reschedule menunggu review",
          message: `Permintaan perubahan jadwal masuk untuk sesi ${data.sessionId}.`,
          targetRole: "therapist",
          targetUserId: therapist.userId,
          relatedId: id,
        });
      }
    }
    return req;
  },

  async updateStatus(id: string, status: string, updates: {
    reviewNote?: string; newDate?: string; newStartTime?: string;
  } = {}) {
    const req = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.id, id) });
    if (!req) return null;
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, req.parentId) });
    const sourceSession = status === "approved"
      ? await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, req.sessionId) })
      : null;

    if (status === "approved") {
      if (!updates.newDate) throw httpError("Tanggal baru wajib dipilih untuk approve reschedule.", 400);
      if (!sourceSession) return null;
      await sessionService.assertSlotAvailable({
        ...sourceSession,
        date: updates.newDate,
        startTime: updates.newStartTime || sourceSession.startTime,
        status: "upcoming",
      }, sourceSession.id);
    }

    await db.update(rescheduleRequests).set({
      status,
      resolvedAt: new Date(),
      ...(updates.reviewNote ? { reviewNote: updates.reviewNote } : {}),
      ...(updates.newDate ? { newDate: updates.newDate } : {}),
      ...(updates.newStartTime ? { newStartTime: updates.newStartTime } : {}),
    }).where(eq(rescheduleRequests.id, id));

    // If approved, cancel old session and create new one
    if (status === "approved" && updates.newDate && sourceSession) {
        await db.update(therapySessions)
          .set({ status: "cancelled", cancelReason: "Rescheduled (parent request)" })
          .where(eq(therapySessions.id, sourceSession.id));

        await db.insert(therapySessions).values({
          id: `S-RESCHED-${Date.now()}`,
          therapistId: sourceSession.therapistId,
          childId: sourceSession.childId,
          roomId: sourceSession.roomId,
          date: updates.newDate,
          startTime: updates.newStartTime || sourceSession.startTime,
          duration: sourceSession.duration,
          focus: sourceSession.focus,
          status: "upcoming",
        });
    }

    if (parent?.userId) {
      await notificationService.create({
        type: "reschedule_result",
        icon: status === "approved" ? "event_available" : "event_busy",
        title: status === "approved" ? "Reschedule disetujui" : "Reschedule diperbarui",
        message: updates.reviewNote || `Permintaan reschedule ${req.sessionId} berstatus ${status}.`,
        targetRole: "parent",
        targetUserId: parent.userId,
        relatedId: id,
      });
    }

    return this.getAll().then((all) => all.find((r) => r.id === id));
  },

  async respondAsTherapist(id: string, therapistId: string, status: string, updates: {
    reviewNote?: string; newDate?: string; newStartTime?: string;
  } = {}) {
    if (!["approved", "rejected", "review"].includes(status)) {
      throw httpError("Status respons terapis tidak valid.", 400);
    }

    const req = await db.query.rescheduleRequests.findFirst({
      where: eq(rescheduleRequests.id, id),
    });
    if (!req) return null;

    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, req.sessionId),
    });
    if (!session) return null;
    if (session.therapistId !== therapistId) {
      throw httpError("Akses ditolak untuk permintaan reschedule ini.", 403);
    }

    const proposedSlots = Array.isArray(req.proposedSlots) ? req.proposedSlots : [];
    const selectedSlot = updates.newDate
      ? proposedSlots.find((slot) =>
        slot.date === updates.newDate && (!updates.newStartTime || slot.time === updates.newStartTime)
      )
      : proposedSlots[0];
    if (status === "approved" && proposedSlots.length > 0 && !selectedSlot) {
      throw httpError("Slot usulan reschedule tidak valid.", 400);
    }
    const resolvedUpdates = {
      ...updates,
      ...(status === "approved" && selectedSlot
        ? { newDate: selectedSlot.date, newStartTime: selectedSlot.time }
        : {}),
      reviewNote: updates.reviewNote || (
        status === "approved"
          ? "Disetujui oleh terapis dan jadwal sudah disinkronkan."
          : status === "rejected"
            ? "Ditolak oleh terapis."
            : "Direview oleh terapis."
      ),
    };

    const result = await this.updateStatus(id, status, resolvedUpdates);
    if (!result) return null;

    await notificationService.create({
      type: "therapist_reschedule_response",
      icon: status === "approved" ? "event_available" : status === "rejected" ? "event_busy" : "manage_search",
      title: "Respons terapis untuk reschedule",
      message: `Terapis ${therapistId} memberi respons ${status} untuk permintaan reschedule ${id}.`,
      targetRole: "admin",
      relatedId: id,
    });

    return result;
  },

  async delete(id: string) {
    const req = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.id, id) });
    if (!req) return null;
    await db.delete(rescheduleRequests).where(eq(rescheduleRequests.id, id));
    return { deleted: true, id };
  },
};
