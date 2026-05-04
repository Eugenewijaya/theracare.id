import { db } from "../db/index.js";
import { therapySessions, sessionRatings } from "../db/schema.js";
import { eq, and, gte, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";

export const sessionService = {
  async getAllWithDetails() {
    return db.query.therapySessions.findMany({
      with: { therapist: { with: { user: true } }, child: { with: { parent: true } }, room: true },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
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
    const [session] = await db.insert(therapySessions).values({
      id, ...data, status: "upcoming",
    }).returning();
    return session;
  },

  async createBulk(sessionsData: Array<{
    therapistId: string; childId: string; date: string; startTime: string;
    duration?: string; focus?: string; roomId?: string;
  }>) {
    const values = sessionsData.map((s, i) => ({
      id: `S-BULK-${Date.now()}-${i}`,
      ...s,
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
