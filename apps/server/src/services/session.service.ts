import { db } from "../db/index.js";
import { reports, rescheduleRequests, sessionRatings, therapySessions } from "../db/schema.js";
import { eq, and, gte, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { attachChildPhotoUrl, getChildPhotoUrlMap } from "./child.service.js";

type TherapySessionInsert = typeof therapySessions.$inferInsert;

type ScheduleSlot = {
  id?: string;
  therapistId?: string | null;
  childId?: string | null;
  roomId?: string | null;
  date?: string | null;
  startTime?: string | null;
  duration?: string | null;
  status?: string | null;
};

function pickSessionValues(data: any): Partial<TherapySessionInsert> {
  return {
    ...(typeof data.therapistId === "string" ? { therapistId: data.therapistId } : {}),
    ...(typeof data.childId === "string" ? { childId: data.childId } : {}),
    ...(data.roomId === null ? { roomId: null } : typeof data.roomId === "string" && data.roomId ? { roomId: data.roomId } : {}),
    ...(typeof data.date === "string" ? { date: data.date } : {}),
    ...(typeof data.startTime === "string" ? { startTime: data.startTime } : {}),
    ...(typeof data.duration === "string" ? { duration: data.duration } : {}),
    ...(typeof data.focus === "string" ? { focus: data.focus } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
    ...(typeof data.notes === "string" ? { notes: data.notes } : {}),
    ...(typeof data.cancelReason === "string" ? { cancelReason: data.cancelReason } : {}),
  };
}

function durationMinutes(duration?: string | null) {
  const match = String(duration || "60 mins").match(/\d+/);
  const minutes = match ? Number(match[0]) : 60;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
}

function timeMinutes(time?: string | null) {
  const [hour, minute] = String(time || "00:00").split(":").map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot) {
  const aStart = timeMinutes(a.startTime);
  const bStart = timeMinutes(b.startTime);
  const aEnd = aStart + durationMinutes(a.duration);
  const bEnd = bStart + durationMinutes(b.duration);
  return aStart < bEnd && bStart < aEnd;
}

function isBlockingStatus(status?: string | null) {
  return !["cancelled", "done"].includes(status || "upcoming");
}

function conflictsOnSameResource(a: ScheduleSlot, b: ScheduleSlot) {
  const sameTherapist = Boolean(a.therapistId && b.therapistId && a.therapistId === b.therapistId);
  const sameRoom = Boolean(a.roomId && b.roomId && a.roomId === b.roomId);
  return sameTherapist || sameRoom;
}

function createScheduleConflictError(message: string, data: any) {
  const error = new Error(message) as Error & { statusCode?: number; data?: any };
  error.statusCode = 409;
  error.data = data;
  return error;
}

function conflictMessage(slot: ScheduleSlot, conflict: ScheduleSlot) {
  const sameTherapist = Boolean(slot.therapistId && conflict.therapistId && slot.therapistId === conflict.therapistId);
  const sameRoom = Boolean(slot.roomId && conflict.roomId && slot.roomId === conflict.roomId);
  const resource = sameTherapist && sameRoom ? "terapis dan ruangan" : sameTherapist ? "terapis" : "ruangan";
  return `Jadwal bentrok pada ${slot.date} ${slot.startTime} untuk ${resource}.`;
}

async function findScheduleConflict(slot: ScheduleSlot, excludeId?: string) {
  if (!slot.therapistId || !slot.date || !slot.startTime || !isBlockingStatus(slot.status)) return null;
  const candidates = await db.query.therapySessions.findMany({
    where: eq(therapySessions.date, slot.date),
  });

  return candidates.find((candidate) => {
    if (excludeId && candidate.id === excludeId) return false;
    if (!isBlockingStatus(candidate.status)) return false;
    return conflictsOnSameResource(slot, candidate) && slotsOverlap(slot, candidate);
  }) || null;
}

function findBatchConflict(values: ScheduleSlot[]) {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      const a = values[i];
      const b = values[j];
      if (!a.date || a.date !== b.date) continue;
      if (!isBlockingStatus(a.status) || !isBlockingStatus(b.status)) continue;
      if (conflictsOnSameResource(a, b) && slotsOverlap(a, b)) {
        return { first: a, second: b };
      }
    }
  }
  return null;
}

async function enrichSessionChildren<T extends { child?: any }>(sessions: T[]) {
  const photoMap = await getChildPhotoUrlMap();
  return sessions.map((session) => ({
    ...session,
    child: attachChildPhotoUrl(session.child, photoMap),
  }));
}

export const sessionService = {
  async getAllWithDetails() {
    const sessions = await db.query.therapySessions.findMany({
      with: { therapist: { with: { user: true } }, child: { with: { parent: true } }, room: true },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    });
    return enrichSessionChildren(sessions);
  },

  async getById(id: string) {
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, id),
      with: { therapist: { with: { user: true } }, child: { with: { parent: true } }, room: true },
    });
    if (!session) return null;
    const [enriched] = await enrichSessionChildren([session]);
    return enriched;
  },

  async getForTherapist(therapistId: string, dateStr?: string) {
    const conditions = [eq(therapySessions.therapistId, therapistId)];
    if (dateStr) conditions.push(eq(therapySessions.date, dateStr));

    const sessions = await db.query.therapySessions.findMany({
      where: and(...conditions),
      with: { child: { with: { parent: true } }, room: true },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });
    return enrichSessionChildren(sessions);
  },

  async getUpcomingForChild(childId: string) {
    const today = new Date().toISOString().split("T")[0];
    return db.query.therapySessions.findMany({
      where: and(
        eq(therapySessions.childId, childId),
        gte(therapySessions.date, today),
        sql`${therapySessions.status} != 'done'`
      ),
      with: { therapist: { with: { user: true } } },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });
  },

  async getCompletedForChild(childId: string) {
    return db.query.therapySessions.findMany({
      where: and(eq(therapySessions.childId, childId), eq(therapySessions.status, "done")),
      with: { therapist: { with: { user: true } } },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    });
  },

  async assertSlotAvailable(slot: ScheduleSlot, excludeId?: string) {
    const conflict = await findScheduleConflict(slot, excludeId);
    if (conflict) {
      throw createScheduleConflictError(conflictMessage(slot, conflict), { conflict });
    }
  },

  async create(data: {
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string | null;
  }) {
    const id = `S-${Date.now().toString(36).toUpperCase()}`;
    const values: TherapySessionInsert = {
      id,
      therapistId: data.therapistId,
      childId: data.childId,
      date: data.date,
      startTime: data.startTime,
      ...pickSessionValues(data),
      status: "upcoming",
    };
    await this.assertSlotAvailable(values);
    const [session] = await db.insert(therapySessions).values(values).returning();
    return session;
  },

  async createBulk(sessionsData: Array<{
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string | null;
  }>) {
    const values: TherapySessionInsert[] = sessionsData.map((s, i) => ({
      id: `S-BULK-${Date.now()}-${i}`,
      therapistId: s.therapistId,
      childId: s.childId,
      date: s.date,
      startTime: s.startTime,
      ...pickSessionValues(s),
      status: "upcoming" as const,
    }));

    const batchConflict = findBatchConflict(values);
    if (batchConflict) {
      throw createScheduleConflictError(conflictMessage(batchConflict.first, batchConflict.second), {
        conflict: batchConflict.second,
      });
    }
    for (const value of values) {
      await this.assertSlotAvailable(value);
    }

    return db.insert(therapySessions).values(values).returning();
  },

  async updateStatus(id: string, status: string, cancelReason?: string) {
    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, id) });
    if (!session) return null;

    if (isBlockingStatus(status)) {
      await this.assertSlotAvailable({ ...session, status }, id);
    }

    const timestampUpdates: Partial<typeof therapySessions.$inferInsert> = {};
    if (status === "active") {
      timestampUpdates.startedAt = new Date();
      timestampUpdates.endedAt = null;
    }
    if (status === "done") {
      timestampUpdates.endedAt = new Date();
    }
    if (status === "upcoming") {
      timestampUpdates.startedAt = null;
      timestampUpdates.endedAt = null;
    }
    const [updated] = await db.update(therapySessions)
      .set({ status, ...timestampUpdates, ...(cancelReason ? { cancelReason } : {}) })
      .where(eq(therapySessions.id, id))
      .returning();
    return updated;
  },

  async saveNotes(id: string, notes: string) {
    const [updated] = await db.update(therapySessions)
      .set({ notes })
      .where(eq(therapySessions.id, id))
      .returning();
    return updated;
  },

  async update(id: string, updates: Partial<{
    therapistId: string; childId: string; roomId: string | null; date: string; startTime: string;
    duration: string; focus: string; status: string; notes: string; cancelReason: string;
  }>) {
    const existing = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, id) });
    if (!existing) return null;

    const values: any = pickSessionValues(updates);
    if (Object.keys(values).length === 0) return this.getById(id);

    const scheduleKeys = ["therapistId", "roomId", "date", "startTime", "duration", "status"];
    const scheduleChanged = scheduleKeys.some((key) => key in values);
    const merged = { ...existing, ...values };
    if (scheduleChanged && isBlockingStatus(merged.status)) {
      await this.assertSlotAvailable(merged, id);
    }

    const [updated] = await db.update(therapySessions)
      .set(values)
      .where(eq(therapySessions.id, id))
      .returning();
    return updated;
  },

  async delete(id: string) {
    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, id) });
    if (!session) return null;

    const report = await db.query.reports.findFirst({ where: eq(reports.sessionId, id) });
    if (report) return { blocked: true, reason: "Sesi masih memiliki laporan terapi." };

    const reschedule = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.sessionId, id) });
    if (reschedule) return { blocked: true, reason: "Sesi masih memiliki permintaan reschedule." };

    await db.delete(sessionRatings).where(eq(sessionRatings.sessionId, id));
    await db.delete(therapySessions).where(eq(therapySessions.id, id));
    return { deleted: true, id };
  },

  async addRating(data: {
    sessionId: string; childId: string; parentId: string; rating: number; comment?: string;
  }) {
    const id = generateId("RAT");
    const [rating] = await db.insert(sessionRatings).values({ id, ...data }).returning();
    return rating;
  },

  async getRating(sessionId: string) {
    return db.query.sessionRatings.findFirst({
      where: eq(sessionRatings.sessionId, sessionId),
    });
  },
};
