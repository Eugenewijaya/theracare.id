import { db } from "../db/index.js";
import { parents, rescheduleRequests, therapists, therapySessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";
import { annotateSlotsForTherapist, evaluateTherapistSlot, evaluateOperationalSlot } from "./scheduling-availability.service.js";

type ProposedSlot = { date: string; time: string; status?: string; reason?: string; kind?: string };

function normalizeProposedSlots(slots?: Array<{ date: string; time: string }> | null) {
  return (Array.isArray(slots) ? slots : [])
    .filter((slot) => slot?.date && slot?.time)
    .map((slot) => ({ date: slot.date, time: slot.time }));
}

async function assertOperationalSlots(slots: Array<{ date: string; time: string }>) {
  const checks = await Promise.all(slots.map((slot) => evaluateOperationalSlot(slot)));
  const blocked = checks.find((slot) => slot.kind === "operational");
  if (blocked) {
    throw new Error(`${blocked.date} ${blocked.time}: ${blocked.reason}`);
  }
}

async function enrichRequestSlots<T extends { id?: string; session?: any; sessionId: string; proposedSlots?: ProposedSlot[] | null }>(request: T) {
  const session = request.session || await db.query.therapySessions.findFirst({
    where: eq(therapySessions.id, request.sessionId),
  });
  if (!session) return request;
  const proposedSlots = await annotateSlotsForTherapist(
    session.therapistId,
    normalizeProposedSlots(request.proposedSlots),
    session.id,
  );
  return { ...request, proposedSlots };
}

async function enrichRequests<T extends { id?: string; session?: any; sessionId: string; proposedSlots?: ProposedSlot[] | null }>(requests: T[]) {
  return Promise.all(requests.map(enrichRequestSlots));
}

export const rescheduleService = {
  async getAll() {
    const requests = await db.query.rescheduleRequests.findMany({
      with: { parent: { with: { user: true } }, child: true, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return enrichRequests(requests);
  },

  async getByParent(parentId: string) {
    const requests = await db.query.rescheduleRequests.findMany({
      where: eq(rescheduleRequests.parentId, parentId),
      with: { child: true, session: true },
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
      with: { parent: { with: { user: true } }, child: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return enrichRequests(allReqs.filter((r) => sessionIds.includes(r.sessionId)));
  },

  async create(data: {
    parentId: string; childId: string; sessionId: string;
    reason?: string; details?: string; proposedSlots?: Array<{ date: string; time: string }>;
  }) {
    const proposedSlots = normalizeProposedSlots(data.proposedSlots);
    if (proposedSlots.length === 0) {
      throw new Error("Minimal satu preferensi jadwal wajib diisi");
    }

    await assertOperationalSlots(proposedSlots);

    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, data.sessionId),
    });
    if (!session) throw new Error("Sesi yang diajukan tidak ditemukan");
    if (session.childId !== data.childId) {
      throw new Error("Sesi tidak sesuai dengan data anak");
    }

    const annotatedSlots = await annotateSlotsForTherapist(session.therapistId, proposedSlots, session.id);
    const id = generateId("RR");
    const [req] = await db.insert(rescheduleRequests).values({
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
    });
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
    return enrichRequestSlots(req);
  },

  async updateStatus(id: string, status: string, updates: {
    reviewNote?: string; newDate?: string; newStartTime?: string;
  } = {}) {
    const req = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.id, id) });
    if (!req) return null;
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, req.parentId) });
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, req.sessionId),
    });

    if (status === "approved") {
      if (!session) throw new Error("Sesi asli tidak ditemukan");
      if (!updates.newDate) throw new Error("Pilih slot jadwal baru yang tersedia");
      const chosenSlot = { date: updates.newDate, time: updates.newStartTime || session.startTime };
      const availability = await evaluateTherapistSlot(session.therapistId, chosenSlot, session.id);
      if (availability.status !== "available") {
        throw new Error(`Slot tidak bisa dipilih: ${availability.reason || "jadwal bentrok"}`);
      }
    }

    await db.update(rescheduleRequests).set({
      status,
      resolvedAt: new Date(),
      ...(updates.reviewNote ? { reviewNote: updates.reviewNote } : {}),
      ...(updates.newDate ? { newDate: updates.newDate } : {}),
      ...(updates.newStartTime ? { newStartTime: updates.newStartTime } : {}),
    }).where(eq(rescheduleRequests.id, id));

    if (status === "approved" && updates.newDate && session) {
      await db.update(therapySessions)
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
      });
    }
    if (status === "approved" && session) {
      const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, session.therapistId) });
      if (therapist?.userId) {
        await notificationService.create({
          type: "schedule_change",
          icon: "event_available",
          title: "Jadwal sesi diperbarui",
          message: `Sesi ${req.sessionId} dipindahkan ke ${updates.newDate} ${updates.newStartTime || session.startTime}.`,
          targetRole: "therapist",
          targetUserId: therapist.userId,
          relatedId: id,
        });
      }
    }

    return this.getAll().then((all: any[]) => all.find((r) => r.id === id));
  },

  async delete(id: string) {
    const req = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.id, id) });
    if (!req) return null;
    await db.delete(rescheduleRequests).where(eq(rescheduleRequests.id, id));
    return { deleted: true, id };
  },
};
