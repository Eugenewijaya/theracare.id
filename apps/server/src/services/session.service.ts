import { db } from "../db/index.js";
import { reports, rescheduleRequests, sessionRatings, therapySessions } from "../db/schema.js";
import { eq, and, gte, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";

type TherapySessionInsert = typeof therapySessions.$inferInsert;

function pickSessionValues(data: any): Partial<TherapySessionInsert> {
  return {
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

export const sessionService = {
  async getAllWithDetails() {
    return db.query.therapySessions.findMany({
      with: { therapist: { with: { user: true } }, child: { with: { parent: true } }, room: true },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    });
  },

  async getById(id: string) {
    return db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, id),
      with: { therapist: { with: { user: true } }, child: { with: { parent: true } }, room: true },
    });
  },

  async getForTherapist(therapistId: string, dateStr?: string) {
    const conditions = [eq(therapySessions.therapistId, therapistId)];
    if (dateStr) conditions.push(eq(therapySessions.date, dateStr));

    return db.query.therapySessions.findMany({
      where: and(...conditions),
      with: { child: { with: { parent: true } }, room: true },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });
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

  async create(data: {
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string;
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
    const [session] = await db.insert(therapySessions).values(values).returning();
    return session;
  },

  async createBulk(sessionsData: Array<{
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string;
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
    return db.insert(therapySessions).values(values).returning();
  },

  async updateStatus(id: string, status: string, cancelReason?: string) {
    const [updated] = await db.update(therapySessions)
      .set({ status, ...(cancelReason ? { cancelReason } : {}) })
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
    therapistId: string; childId: string; roomId: string | null; date: string; startTime: string;
    duration: string; focus: string; status: string; notes: string; cancelReason: string;
  }>) {
    const values: any = pickSessionValues(updates);
    if (Object.keys(values).length === 0) return this.getById(id);

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
