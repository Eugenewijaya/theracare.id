import { db } from "../db/index.js";
import { rooms, programs, clinicSettings, therapySessions, children, therapists, user } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";

export const adminService = {
  // ── Rooms ──
  async getAllRooms() { return db.select().from(rooms); },
  async createRoom(data: { name: string; type?: string; capacity?: number; status?: string }) {
    const id = generateId("RM");
    const [room] = await db.insert(rooms).values({ id, ...data }).returning();
    return room;
  },
  async updateRoom(id: string, updates: any) {
    const [room] = await db.update(rooms).set(updates).where(eq(rooms.id, id)).returning();
    return room;
  },
  async deleteRoom(id: string) { await db.delete(rooms).where(eq(rooms.id, id)); },

  // ── Programs ──
  async getAllPrograms() { return db.select().from(programs); },
  async createProgram(data: { name: string; code?: string; target?: string; duration?: number; goals?: string[] }) {
    const id = generateId("PRG");
    const [prog] = await db.insert(programs).values({ id, ...data }).returning();
    return prog;
  },
  async updateProgram(id: string, updates: any) {
    const [prog] = await db.update(programs).set(updates).where(eq(programs.id, id)).returning();
    return prog;
  },
  async deleteProgram(id: string) { await db.delete(programs).where(eq(programs.id, id)); },

  // ── Settings ──
  async getSettings() {
    const rows = await db.select().from(clinicSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  async getPublicSettings() {
    const safeKeys = [
      "clinicName",
      "centerSubtitle",
      "centerAddress",
      "centerPhone",
      "centerEmail",
      "centerWebsite",
      "operatingHoursWeekday",
      "operatingHoursWeekend",
      "primaryColor",
      "secondaryColor",
      "logoUrl",
      "faviconUrl",
    ];
    const settings = await this.getSettings();
    return Object.fromEntries(safeKeys.map((key) => [key, settings[key]]).filter(([, value]) => value));
  },
  async updateSettings(updates: Record<string, string>) {
    for (const [key, value] of Object.entries(updates)) {
      await db.insert(clinicSettings).values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: clinicSettings.key, set: { value, updatedAt: new Date() } });
    }
  },

  // ── Dashboard Stats ──
  async getDashboardStats() {
    const today = new Date().toISOString().split("T")[0];
    const [childCount] = await db.select({ count: sql<number>`count(*)` }).from(children);
    const [therapistCount] = await db.select({ count: sql<number>`count(*)` }).from(therapists);
    const allSessions = await db.select().from(therapySessions).where(eq(therapySessions.date, today));
    return {
      activeChildren: Number(childCount.count),
      totalTherapists: Number(therapistCount.count),
      totalSessionsToday: allSessions.length,
      completedSessionsToday: allSessions.filter((s) => s.status === "done").length,
      pendingSessionsToday: allSessions.filter((s) => s.status === "upcoming").length,
    };
  },
};
