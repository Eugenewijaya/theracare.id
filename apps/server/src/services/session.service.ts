import { db } from "../db/index.js";
import { reports, rescheduleRequests, sessionRatings, therapySessions } from "../db/schema.js";
import { eq, and, gte, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { httpError } from "../utils/http-error.js";
import { attachChildPhotoUrl, getChildPhotoUrlMap } from "./child.service.js";
import { evaluateSessionSlot } from "./scheduling-availability.service.js";

type TherapySessionInsert = typeof therapySessions.$inferInsert;

function pickSessionValues(data: any): Partial<TherapySessionInsert> {
  return {
    ...(typeof data.therapyPeriodId === "string" ? { therapyPeriodId: data.therapyPeriodId } : {}),
    ...(typeof data.therapistId === "string" ? { therapistId: data.therapistId } : {}),
    ...(typeof data.childId === "string" ? { childId: data.childId } : {}),
    ...(typeof data.roomId === "string" && data.roomId ? { roomId: data.roomId } : {}),
    ...(typeof data.date === "string" ? { date: data.date } : {}),
    ...(typeof data.startTime === "string" ? { startTime: data.startTime } : {}),
    ...(typeof data.duration === "string" ? { duration: data.duration } : {}),
    ...(typeof data.focus === "string" ? { focus: data.focus } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
    ...(typeof data.notes === "string" ? { notes: data.notes } : {}),
    ...(typeof data.cancelReason === "string" ? { cancelReason: data.cancelReason } : {}),
  };
}

async function enrichSessionChildren<T extends { child?: any }>(sessions: T[]) {
  const photoMap = await getChildPhotoUrlMap();
  return sessions.map((session) => ({
    ...session,
    child: attachChildPhotoUrl(session.child, photoMap),
  }));
}

async function assertSessionAvailable(
  values: Pick<TherapySessionInsert, "therapistId" | "childId" | "date" | "startTime"> & Partial<Pick<TherapySessionInsert, "roomId" | "duration">>,
  excludeSessionId?: string,
) {
  const availability = await evaluateSessionSlot({
    therapistId: values.therapistId,
    childId: values.childId,
    roomId: values.roomId,
    date: values.date,
    startTime: values.startTime,
    duration: values.duration,
  }, excludeSessionId);

  if (availability.status !== "available") {
    throw httpError(409, availability.reason || "Jadwal bentrok atau berada di luar jam operasional.", availability);
  }
}

export const sessionService = {
  async getAllWithDetails() {
    const sessions = await db.query.therapySessions.findMany({
      with: { therapist: { with: { user: true } }, child: { with: { parent: true, therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true } } } }, room: true, therapyPeriod: { with: { program: true } } },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    });
    return enrichSessionChildren(sessions);
  },

  async getById(id: string) {
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, id),
      with: { therapist: { with: { user: true } }, child: { with: { parent: true, therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true } } } }, room: true, therapyPeriod: { with: { program: true } } },
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
      with: { child: { with: { parent: true, therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true } } } }, room: true, therapyPeriod: { with: { program: true } } },
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
      with: { therapist: { with: { user: true } }, therapyPeriod: { with: { program: true } } },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });
  },

  async getCompletedForChild(childId: string) {
    return db.query.therapySessions.findMany({
      where: and(eq(therapySessions.childId, childId), eq(therapySessions.status, "done")),
      with: { therapist: { with: { user: true } }, therapyPeriod: { with: { program: true } } },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    });
  },

  async create(data: {
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string; therapyPeriodId?: string;
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
    await assertSessionAvailable(values);
    const [session] = await db.insert(therapySessions).values(values).returning();
    return session;
  },

  async createBulk(sessionsData: Array<{
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string; therapyPeriodId?: string;
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
    const localKeys = new Set<string>();
    for (const value of values) {
      const therapistKey = `therapist:${value.therapistId}:${value.date}:${value.startTime}`;
      const childKey = `child:${value.childId}:${value.date}:${value.startTime}`;
      const roomKey = value.roomId ? `room:${value.roomId}:${value.date}:${value.startTime}` : "";
      if (localKeys.has(therapistKey) || localKeys.has(childKey) || (roomKey && localKeys.has(roomKey))) {
        throw httpError(409, "Jadwal massal memiliki slot yang duplikat untuk terapis, anak, atau ruangan.");
      }
      localKeys.add(therapistKey);
      localKeys.add(childKey);
      if (roomKey) localKeys.add(roomKey);
      await assertSessionAvailable(value);
    }
    return db.insert(therapySessions).values(values).returning();
  },

  async updateStatus(id: string, status: string, cancelReason?: string) {
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

  // ── Session Ratings ──
  async update(id: string, updates: Partial<{
    therapyPeriodId: string; therapistId: string; childId: string; roomId: string | null; date: string; startTime: string;
    duration: string; focus: string; status: string; notes: string; cancelReason: string;
  }>) {
    const values: any = pickSessionValues(updates);
    if (Object.keys(values).length === 0) return this.getById(id);
    const existing = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, id) });
    if (!existing) return null;
    const next = { ...existing, ...values };
    if (["therapistId", "childId", "roomId", "date", "startTime", "duration"].some((key) => key in values)) {
      await assertSessionAvailable(next, id);
    }

    const scheduleChanged = ["therapistId", "childId", "roomId", "date", "startTime", "duration"].some((key) => key in values);
    const [updated] = await db.update(therapySessions)
      .set({
        ...values,
        ...(scheduleChanged && existing.status !== "cancelled" ? { status: "upcoming", startedAt: null, endedAt: null } : {}),
      })
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
    const existing = await db.query.sessionRatings.findFirst({
      where: eq(sessionRatings.sessionId, data.sessionId),
    });
    if (existing) {
      const [rating] = await db
        .update(sessionRatings)
        .set({
          childId: data.childId,
          parentId: data.parentId,
          rating: data.rating,
          comment: data.comment || null,
        })
        .where(eq(sessionRatings.id, existing.id))
        .returning();
      return rating;
    }

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
