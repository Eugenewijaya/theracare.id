import { db } from "../db/index.js";
import { rooms, programs, therapyPrograms, clinicSettings, therapySessions, children, therapists, user } from "../db/schema.js";
import { and, eq, ne, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { todayDateKey } from "../utils/date-key.js";
import { emailService } from "./email.service.js";

type RoomInsert = typeof rooms.$inferInsert;
type ProgramInsert = typeof programs.$inferInsert;

function normalizeRoom(room: any) {
  if (!room) return null;
  return room;
}

function pickRoomValues(data: any): Partial<RoomInsert> {
  return {
    ...(typeof data.name === "string" ? { name: data.name.trim() } : {}),
    ...(typeof data.type === "string" ? { type: data.type.trim() } : {}),
    ...(Number.isFinite(Number(data.capacity)) ? { capacity: Number(data.capacity) } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
  };
}

function normalizeProgram(program: any) {
  if (!program) return null;
  return {
    ...program,
    code: program?.code || "",
    target: program?.target || "",
    goals: Array.isArray(program?.goals) ? program.goals : [],
  };
}

function parseJsonArray(value?: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getNotificationChannelsStatus() {
  const emailLive = emailService.isEnabled();
  return {
    inApp: {
      live: true,
      status: "Aktif",
      label: "In-App",
      description: "Notifikasi portal aktif dan tersinkron untuk admin, terapis, dan orang tua.",
    },
    email: {
      live: emailLive,
      status: emailLive ? "Aktif" : "Dalam Pengembangan",
      label: "Email",
      description: emailLive
        ? "Email otomatis aktif sesuai preferensi admin."
        : "Email belum aktif sampai domain pengirim dan konfigurasi Resend siap.",
    },
    sms: {
      live: false,
      status: "Tidak Digunakan",
      label: "SMS / WhatsApp",
      description: "SMS dan WhatsApp otomatis belum menjadi kanal pengiriman sistem.",
    },
  };
}

function pickProgramValues(data: any): Partial<ProgramInsert> {
  return {
    ...(typeof data.name === "string" ? { name: data.name.trim() } : {}),
    ...(typeof data.code === "string" ? { code: data.code.trim().toUpperCase() } : {}),
    ...(typeof data.target === "string" ? { target: data.target.trim() } : {}),
    ...(Number.isFinite(Number(data.duration)) ? { duration: Number(data.duration) } : {}),
    ...(Array.isArray(data.goals) ? {
      goals: data.goals
        .filter((goal: unknown) => typeof goal === "string" && goal.trim())
        .map((goal: string) => goal.trim()),
    } : {}),
  };
}

export const adminService = {
  // ── Rooms ──
  async getAllRooms() {
    const rows = await db.select().from(rooms);
    return rows.map(normalizeRoom);
  },
  async createRoom(data: { name: string; type?: string; capacity?: number; status?: string }) {
    const id = generateId("RM");
    const values: RoomInsert = { id, name: data.name.trim(), ...pickRoomValues(data) };
    const [room] = await db.insert(rooms).values(values).returning();
    return normalizeRoom(room);
  },
  async updateRoom(id: string, updates: any) {
    const values = pickRoomValues(updates);
    if (Object.keys(values).length === 0) {
      const room = await db.query.rooms.findFirst({ where: eq(rooms.id, id) });
      return normalizeRoom(room);
    }
    const [room] = await db.update(rooms).set(values).where(eq(rooms.id, id)).returning();
    return normalizeRoom(room);
  },
  async deleteRoom(id: string) {
    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.roomId, id) });
    if (session) return { blocked: true, reason: "Ruangan masih dipakai dalam jadwal terapi." };

    const [room] = await db.delete(rooms).where(eq(rooms.id, id)).returning({ id: rooms.id });
    return room ? { deleted: true, id: room.id } : null;
  },

  // ── Programs ──
  async getAllPrograms() {
    const rows = await db.select().from(programs);
    return rows.map(normalizeProgram);
  },
  async createProgram(data: { name: string; code?: string; target?: string; duration?: number; goals?: string[] }) {
    const id = generateId("PRG");
    const values: ProgramInsert = { id, name: data.name.trim(), ...pickProgramValues(data) };
    const [prog] = await db.insert(programs).values(values).returning();
    return normalizeProgram(prog);
  },
  async updateProgram(id: string, updates: any) {
    const values = pickProgramValues(updates);
    if (Object.keys(values).length === 0) {
      const prog = await db.query.programs.findFirst({ where: eq(programs.id, id) });
      return normalizeProgram(prog);
    }
    const [prog] = await db.update(programs).set(values).where(eq(programs.id, id)).returning();
    return normalizeProgram(prog);
  },
  async deleteProgram(id: string) {
    const enrollment = await db.query.therapyPrograms.findFirst({ where: eq(therapyPrograms.programId, id) });
    if (enrollment) return { blocked: true, reason: "Program masih terhubung ke program terapi anak." };

    const [prog] = await db.delete(programs).where(eq(programs.id, id)).returning({ id: programs.id });
    return prog ? { deleted: true, id: prog.id } : null;
  },

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
      "adminWhatsApp",
      "centerEmail",
      "centerWebsite",
      "operatingHoursWeekday",
      "operatingHoursWeekend",
      "primaryColor",
      "secondaryColor",
      "logoUrl",
      "faviconUrl",
      "centerPhotoUrl",
      "centerClosures",
      "notificationPreferences",
    ];
    const settings = await this.getSettings();
    return {
      ...Object.fromEntries(safeKeys.map((key) => [key, settings[key] ?? ""])),
      notificationChannels: getNotificationChannelsStatus(),
    };
  },
  async updateSettings(updates: Record<string, unknown>) {
    for (const [key, value] of Object.entries(updates)) {
      const storedValue = typeof value === "string" ? value : JSON.stringify(value ?? "");
      await db.insert(clinicSettings).values({ key, value: storedValue, updatedAt: new Date() })
        .onConflictDoUpdate({ target: clinicSettings.key, set: { value: storedValue, updatedAt: new Date() } });
    }
  },

  // ── Dashboard Stats ──
  async getDashboardStats() {
    const today = todayDateKey();
    const [childCount] = await db.select({ count: sql<number>`count(*)` }).from(children).where(eq(children.status, "active"));
    const [therapistCount] = await db.select({ count: sql<number>`count(*)` })
      .from(therapists)
      .innerJoin(user, eq(therapists.userId, user.id))
      .where(ne(user.status, "deleted"));
    const [activeTherapistCount] = await db.select({ count: sql<number>`count(*)` })
      .from(therapists)
      .innerJoin(user, eq(therapists.userId, user.id))
      .where(and(eq(user.status, "active"), sql`${user.banned} is not true`));
    const [totalSessionsToday] = await db.select({ count: sql<number>`count(*)` })
      .from(therapySessions)
      .where(eq(therapySessions.date, today));
    const [completedSessionsToday] = await db.select({ count: sql<number>`count(*)` })
      .from(therapySessions)
      .where(and(eq(therapySessions.date, today), eq(therapySessions.status, "done")));
    const [pendingSessionsToday] = await db.select({ count: sql<number>`count(*)` })
      .from(therapySessions)
      .where(and(eq(therapySessions.date, today), eq(therapySessions.status, "upcoming")));
    const settings = await this.getSettings();
    const oneTimeVisits = parseJsonArray(settings.oneTimeVisitLog)
      .filter((visit: any) => visit?.date === today && String(visit?.status || "upcoming").toLowerCase() !== "cancelled");
    const completedOneTimeVisits = oneTimeVisits.filter((visit: any) => ["done", "completed"].includes(String(visit?.status || "").toLowerCase()));
    const pendingOneTimeVisits = oneTimeVisits.filter((visit: any) => ["upcoming", "confirmed"].includes(String(visit?.status || "upcoming").toLowerCase()));
    return {
      activeChildren: Number(childCount.count),
      totalTherapists: Number(therapistCount.count),
      activeTherapists: Number(activeTherapistCount.count),
      totalSessionsToday: Number(totalSessionsToday.count || 0) + oneTimeVisits.length,
      completedSessionsToday: Number(completedSessionsToday.count || 0) + completedOneTimeVisits.length,
      pendingSessionsToday: Number(pendingSessionsToday.count || 0) + pendingOneTimeVisits.length,
    };
  },
};
