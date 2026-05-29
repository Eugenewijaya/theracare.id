import { db } from "../db/index.js";
import { clinicSettings, historicalSessionSummaries, reports, rescheduleRequests, sessionRatings, therapists, therapyPeriods, therapySessions } from "../db/schema.js";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { httpError } from "../utils/http-error.js";
import { attachChildPhotoUrl, getChildPhotoUrlMap } from "./child.service.js";
import { evaluateSessionSlot, evaluateTherapistSlot } from "./scheduling-availability.service.js";
import { notificationService } from "./notification.service.js";

type TherapySessionInsert = typeof therapySessions.$inferInsert;
type DbClient = typeof db | any;
const ONE_TIME_VISIT_LOG_KEY = "oneTimeVisitLog";
const APP_TIME_ZONE_OFFSET = "+07:00";
const AUTO_LIFECYCLE_STATUSES = new Set(["active", "confirmed", "checked_in", "present"]);

type SessionStatusTimestampOverrides = {
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
};

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

function attachTherapistDisplay(therapist: any) {
  if (!therapist) return therapist;
  const name = therapist.user?.name || therapist.name || therapist.nit || therapist.id || "";
  return {
    ...therapist,
    name,
    email: therapist.user?.email || therapist.email || "",
    phone: therapist.user?.phone || therapist.phone || "",
    status: therapist.user?.status || therapist.status || "active",
    avatar: therapist.avatar || therapist.user?.image || "",
  };
}

async function enrichSessionDetails<T extends { child?: any; therapist?: any }>(sessions: T[]) {
  const photoMap = await getChildPhotoUrlMap();
  return sessions.map((session) => ({
    ...session,
    child: attachChildPhotoUrl(session.child, photoMap),
    therapist: attachTherapistDisplay(session.therapist),
  }));
}

function parseDurationMinutes(value?: string | null) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45;
}

function normalizeDateKey(value?: string | Date | null) {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value || "").split("T")[0];
}

function normalizeClock(value?: string | null) {
  const raw = String(value || "00:00").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "00:00";
  const h = Math.max(0, Math.min(23, Number.parseInt(match[1], 10)));
  const m = Math.max(0, Math.min(59, Number.parseInt(match[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getSessionStartAt(session: Pick<TherapySessionInsert, "date" | "startTime">) {
  const start = new Date(`${normalizeDateKey(session.date)}T${normalizeClock(session.startTime)}:00${APP_TIME_ZONE_OFFSET}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function getSessionEndAt(session: Pick<TherapySessionInsert, "date" | "startTime" | "duration" | "startedAt">) {
  const startedAt = session.startedAt ? new Date(session.startedAt) : null;
  const start = startedAt && !Number.isNaN(startedAt.getTime())
    ? startedAt
    : getSessionStartAt(session);
  if (!start || Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + parseDurationMinutes(session.duration) * 60_000);
}

function asDateOverride(value: Date | string | null | undefined) {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asIsoOverride(value: Date | string | null | undefined) {
  const date = asDateOverride(value);
  if (typeof date === "undefined") return undefined;
  return date === null ? null : date.toISOString();
}

function isAutoLifecycleStatus(status?: string | null) {
  return AUTO_LIFECYCLE_STATUSES.has(String(status || "").toLowerCase());
}

function isStoredActiveStatus(status?: string | null) {
  return String(status || "").toLowerCase() === "active";
}

function getCompletionTimestamp(session: Pick<TherapySessionInsert, "date" | "startTime" | "duration" | "startedAt">) {
  const endAt = getSessionEndAt(session);
  return endAt && !Number.isNaN(endAt.getTime()) ? endAt : null;
}

function getStartTimestamp(session: Pick<TherapySessionInsert, "date" | "startTime">) {
  const startAt = getSessionStartAt(session);
  return startAt && !Number.isNaN(startAt.getTime()) ? startAt : null;
}

function parseOneTimeVisits(value?: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readOneTimeVisits(client: DbClient = db) {
  const row = await client.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, ONE_TIME_VISIT_LOG_KEY),
  });
  return parseOneTimeVisits(row?.value);
}

async function writeOneTimeVisits(visits: any[], client: DbClient = db) {
  await client.insert(clinicSettings)
    .values({ key: ONE_TIME_VISIT_LOG_KEY, value: JSON.stringify(visits), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(visits), updatedAt: new Date() },
    });
}

function normalizeOneTimeVisit(visit: any) {
  const visitorName = String(visit?.visitorName || visit?.childName || "One-time visit").trim() || "One-time visit";
  const status = String(visit?.status || "upcoming").toLowerCase();
  return {
    id: visit?.id || generateId("OTV"),
    isOneTime: true,
    visitorName,
    childId: "",
    child: { id: "", name: visitorName, parent: null },
    therapistId: visit?.therapistId || "",
    therapyPeriodId: null,
    roomId: null,
    room: null,
    therapyPeriod: null,
    date: visit?.date || "",
    startTime: visit?.startTime || "09:00",
    duration: visit?.duration || "60 mins",
    focus: visit?.focus || visit?.program || "One-time Visit",
    program: visit?.program || visit?.focus || "One-time Visit",
    status,
    notes: visit?.notes || "One-time visit. Tidak membuat data anak baru.",
    cancelReason: visit?.cancelReason || null,
    startedAt: visit?.startedAt || null,
    endedAt: visit?.endedAt || null,
    createdAt: visit?.createdAt || new Date().toISOString(),
    updatedAt: visit?.updatedAt || visit?.createdAt || new Date().toISOString(),
  };
}

async function enrichOneTimeVisits(visits: any[]) {
  const normalized = visits.map(normalizeOneTimeVisit);
  const therapistIds = [...new Set(normalized.map((visit) => visit.therapistId).filter(Boolean))];
  const therapistRows = therapistIds.length
    ? await db.query.therapists.findMany({
        where: inArray(therapists.id, therapistIds),
        with: { user: true },
      })
    : [];
  const therapistById = new Map(therapistRows.map((therapist) => [therapist.id, attachTherapistDisplay(therapist)]));
  return normalized.map((visit) => ({
    ...visit,
    therapist: therapistById.get(visit.therapistId) || null,
  }));
}

async function getOneTimeVisitById(id: string) {
  const visits = await readOneTimeVisits();
  const visit = visits.find((item: any) => item?.id === id);
  if (!visit) return null;
  const [enriched] = await enrichOneTimeVisits([visit]);
  return enriched || null;
}

function sessionSortAsc(a: any, b: any) {
  return String(a.date || "").localeCompare(String(b.date || ""))
    || String(a.startTime || "").localeCompare(String(b.startTime || ""));
}

function sessionSortDesc(a: any, b: any) {
  return String(b.date || "").localeCompare(String(a.date || ""))
    || String(b.startTime || "").localeCompare(String(a.startTime || ""));
}

async function assertOneTimeVisitAvailable(visit: any, excludeVisitId?: string) {
  const availability = await evaluateTherapistSlot(
    visit.therapistId,
    { date: visit.date, time: visit.startTime, duration: visit.duration },
    excludeVisitId,
  );
  if (availability.status !== "available") {
    throw httpError(409, availability.reason || "Jadwal bentrok atau berada di luar jam operasional.", availability);
  }
}

async function autoCompleteExpiredActiveSessions() {
  const activeSessions = await db.query.therapySessions.findMany({
    where: inArray(therapySessions.status, ["active", "confirmed", "checked_in", "present"]),
    columns: {
      id: true,
      status: true,
      date: true,
      startTime: true,
      duration: true,
      startedAt: true,
    },
  });
  const now = new Date();
  for (const session of activeSessions) {
    const endAt = getCompletionTimestamp(session);
    if (endAt && now >= endAt) {
      if (!isStoredActiveStatus(session.status)) {
        await sessionService.updateStatus(session.id, "active", undefined, {
          startedAt: getStartTimestamp(session) || now,
        });
      }
      await sessionService.updateStatus(session.id, "done", undefined, { endedAt: endAt });
    }
  }
  const visits = await readOneTimeVisits();
  let changed = false;
  const nextVisits = visits.map((visit: any) => {
    const normalized = normalizeOneTimeVisit(visit);
    if (!isAutoLifecycleStatus(normalized.status)) return visit;
    const endAt = getCompletionTimestamp(normalized as any);
    if (!endAt || now < endAt) return visit;
    changed = true;
    const startAt = getStartTimestamp(normalized as any);
    return {
      ...normalized,
      status: "done",
      startedAt: normalized.startedAt || startAt?.toISOString() || normalized.startedAt,
      endedAt: endAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  if (changed) await writeOneTimeVisits(nextVisits);
}

async function refreshPeriodCompletedCount(client: any, periodId?: string | null) {
  if (!periodId) return;
  const [sessionRow] = await client
    .select({ count: sql<number>`count(*)` })
    .from(therapySessions)
    .where(and(eq(therapySessions.therapyPeriodId, periodId), inArray(therapySessions.status, ["done", "completed"])));
  const [historicalRow] = await client
    .select({ count: sql<number>`coalesce(sum(${historicalSessionSummaries.completedCount}), 0)` })
    .from(historicalSessionSummaries)
    .where(eq(historicalSessionSummaries.therapyPeriodId, periodId));
  await client.update(therapyPeriods)
    .set({
      completedSessions: Number(sessionRow?.count || 0) + Number(historicalRow?.count || 0),
      updatedAt: new Date(),
    })
    .where(eq(therapyPeriods.id, periodId));
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
    await autoCompleteExpiredActiveSessions();
    const [sessions, oneTimeVisits] = await Promise.all([
      db.query.therapySessions.findMany({
      with: { therapist: { with: { user: true } }, child: { with: { parent: true, therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } } } }, room: true, therapyPeriod: { with: { program: true, historicalSummaries: true } } },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
      }),
      readOneTimeVisits(),
    ]);
    const [regular, oneTime] = await Promise.all([
      enrichSessionDetails(sessions),
      enrichOneTimeVisits(oneTimeVisits),
    ]);
    return [...regular, ...oneTime].sort(sessionSortDesc);
  },

  async getById(id: string) {
    await autoCompleteExpiredActiveSessions();
    if (id.startsWith("OTV-")) return getOneTimeVisitById(id);
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, id),
      with: { therapist: { with: { user: true } }, child: { with: { parent: true, therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } } } }, room: true, therapyPeriod: { with: { program: true, historicalSummaries: true } } },
    });
    if (!session) return null;
    const [enriched] = await enrichSessionDetails([session]);
    return enriched;
  },

  async getForTherapist(therapistId: string, dateStr?: string) {
    await autoCompleteExpiredActiveSessions();
    const conditions = [eq(therapySessions.therapistId, therapistId)];
    if (dateStr) conditions.push(eq(therapySessions.date, dateStr));

    const [sessions, oneTimeVisits] = await Promise.all([
      db.query.therapySessions.findMany({
      where: and(...conditions),
      with: { child: { with: { parent: true, therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } } } }, room: true, therapyPeriod: { with: { program: true, historicalSummaries: true } } },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
      }),
      readOneTimeVisits(),
    ]);
    const matchingVisits = oneTimeVisits.filter((visit: any) => (
      visit?.therapistId === therapistId
      && (!dateStr || visit?.date === dateStr)
    ));
    const [regular, oneTime] = await Promise.all([
      enrichSessionDetails(sessions),
      enrichOneTimeVisits(matchingVisits),
    ]);
    return [...regular, ...oneTime].sort(sessionSortAsc);
  },

  async getUpcomingForChild(childId: string) {
    await autoCompleteExpiredActiveSessions();
    const today = new Date().toISOString().split("T")[0];
    const sessions = await db.query.therapySessions.findMany({
      where: and(
        eq(therapySessions.childId, childId),
        gte(therapySessions.date, today),
        sql`${therapySessions.status} not in ('done', 'completed', 'cancelled')`
      ),
      with: { therapist: { with: { user: true } }, therapyPeriod: { with: { program: true, historicalSummaries: true } } },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });
    return enrichSessionDetails(sessions);
  },

  async getCompletedForChild(childId: string) {
    await autoCompleteExpiredActiveSessions();
    const sessions = await db.query.therapySessions.findMany({
      where: and(eq(therapySessions.childId, childId), inArray(therapySessions.status, ["done", "completed"])),
      with: { therapist: { with: { user: true } }, therapyPeriod: { with: { program: true, historicalSummaries: true } } },
      orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    });
    return enrichSessionDetails(sessions);
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

  async createOneTimeVisit(data: {
    visitorName: string; therapistId: string; date: string; startTime: string;
    duration?: string; program?: string; focus?: string; notes?: string;
  }) {
    const visit = normalizeOneTimeVisit({
      id: generateId("OTV"),
      visitorName: data.visitorName,
      therapistId: data.therapistId,
      date: data.date,
      startTime: data.startTime,
      duration: data.duration || "60 mins",
      program: data.program || data.focus || "One-time Visit",
      focus: data.focus || data.program || "One-time Visit",
      status: "upcoming",
      notes: data.notes || "One-time visit. Tidak membuat data anak baru.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await assertOneTimeVisitAvailable(visit);
    const visits = await readOneTimeVisits();
    const nextVisits = [...visits, visit];
    await writeOneTimeVisits(nextVisits);
    const [enriched] = await enrichOneTimeVisits([visit]);
    return enriched || visit;
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

  async updateStatus(id: string, status: string, cancelReason?: string, timestampOverrides: SessionStatusTimestampOverrides = {}) {
    if (id.startsWith("OTV-")) {
      const visits = await readOneTimeVisits();
      const index = visits.findIndex((visit: any) => visit?.id === id);
      if (index === -1) return null;
      const existing = normalizeOneTimeVisit(visits[index]);
      const timestampUpdates: Record<string, string | null> = { updatedAt: new Date().toISOString() };
      if (status === "confirmed") {
        timestampUpdates.startedAt = null;
        timestampUpdates.endedAt = null;
      }
      if (status === "active") {
        timestampUpdates.startedAt = new Date().toISOString();
        timestampUpdates.endedAt = null;
      }
      if (status === "done") {
        timestampUpdates.endedAt = new Date().toISOString();
      }
      if (status === "upcoming") {
        timestampUpdates.startedAt = null;
        timestampUpdates.endedAt = null;
      }
      const startedAtOverride = asIsoOverride(timestampOverrides.startedAt);
      if (typeof startedAtOverride !== "undefined") timestampUpdates.startedAt = startedAtOverride;
      const endedAtOverride = asIsoOverride(timestampOverrides.endedAt);
      if (typeof endedAtOverride !== "undefined") timestampUpdates.endedAt = endedAtOverride;
      const updated = {
        ...existing,
        status,
        ...timestampUpdates,
        ...(cancelReason ? { cancelReason } : {}),
      };
      visits[index] = updated;
      await writeOneTimeVisits(visits);

      if (status === "confirmed" && existing.therapistId) {
        const therapist = await db.query.therapists.findFirst({
          where: eq(therapists.id, existing.therapistId),
          with: { user: true },
        });
        const therapistUserId = therapist?.userId || therapist?.user?.id;
        if (therapistUserId) {
          await notificationService.create({
            type: "session_attendance_confirmed",
            icon: "how_to_reg",
            title: "One-time visit sudah dikonfirmasi hadir",
            message: `${existing.visitorName} sudah dikonfirmasi hadir untuk one-time visit ${existing.startTime}. Sesi dapat dimulai saat waktunya.`,
            targetRole: "therapist",
            targetUserId: therapistUserId,
            relatedId: id,
          });
        }
      }

      const [enriched] = await enrichOneTimeVisits([updated]);
      return enriched || updated;
    }

    const existing = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, id),
      with: { therapist: { with: { user: true } }, child: { with: { parent: true } } },
    });
    if (!existing) return null;

    const timestampUpdates: Partial<typeof therapySessions.$inferInsert> = {};
    if (status === "confirmed") {
      timestampUpdates.startedAt = null;
      timestampUpdates.endedAt = null;
    }
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
    const startedAtOverride = asDateOverride(timestampOverrides.startedAt);
    if (typeof startedAtOverride !== "undefined") timestampUpdates.startedAt = startedAtOverride;
    const endedAtOverride = asDateOverride(timestampOverrides.endedAt);
    if (typeof endedAtOverride !== "undefined") timestampUpdates.endedAt = endedAtOverride;

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(therapySessions)
        .set({ status, ...timestampUpdates, ...(cancelReason ? { cancelReason } : {}) })
        .where(eq(therapySessions.id, id))
        .returning();
      await refreshPeriodCompletedCount(tx, updated?.therapyPeriodId || existing.therapyPeriodId);

      const therapistUserId = existing.therapist?.userId || existing.therapist?.user?.id;
      const parentUserId = existing.child?.parent?.userId;
      const childName = existing.child?.name || existing.childId;
      if (updated && status === "confirmed" && therapistUserId) {
        await notificationService.create({
          type: "session_attendance_confirmed",
          icon: "how_to_reg",
          title: "Anak sudah dikonfirmasi hadir",
          message: `${childName} sudah dikonfirmasi hadir untuk sesi ${existing.startTime}. Sesi dapat dimulai saat waktunya.`,
          targetRole: "therapist",
          targetUserId: therapistUserId,
          relatedId: id,
        }, tx);
      }
      if (updated && status === "confirmed" && parentUserId) {
        await notificationService.create({
          type: "session_attendance_confirmed",
          icon: "how_to_reg",
          title: "Kehadiran anak sudah dikonfirmasi",
          message: `${childName} sudah dikonfirmasi hadir untuk sesi ${existing.startTime}. Anda bisa memantau countdown sesi di dashboard.`,
          targetRole: "parent",
          targetUserId: parentUserId,
          relatedId: id,
        }, tx);
      }
      if (updated && status === "active" && parentUserId) {
        await notificationService.create({
          type: "session_started",
          icon: "play_circle",
          title: "Sesi terapi sedang berjalan",
          message: `${childName} memulai sesi terapi ${existing.startTime}. Dashboard orang tua menampilkan sisa waktu sesi.`,
          targetRole: "parent",
          targetUserId: parentUserId,
          relatedId: id,
        }, tx);
      }
      if (updated && status === "done" && therapistUserId) {
        await notificationService.create({
          type: "report_reminder",
          icon: "edit_note",
          title: "Laporan harian perlu diisi",
          message: `Sesi ${childName} sudah selesai. Simpan draft atau kirim laporan harian agar orang tua mendapat update.`,
          targetRole: "therapist",
          targetUserId: therapistUserId,
          relatedId: id,
        }, tx);
      }
      if (updated && status === "done" && parentUserId) {
        await notificationService.create({
          type: "session_finished",
          icon: "task_alt",
          title: "Sesi terapi selesai",
          message: `${childName} sudah selesai terapi. Terapis akan mengisi laporan harian setelah sesi.`,
          targetRole: "parent",
          targetUserId: parentUserId,
          relatedId: id,
        }, tx);
      }
      return updated;
    });
  },

  async saveNotes(id: string, notes: string) {
    if (id.startsWith("OTV-")) {
      const visits = await readOneTimeVisits();
      const index = visits.findIndex((visit: any) => visit?.id === id);
      if (index === -1) return null;
      const updated = {
        ...normalizeOneTimeVisit(visits[index]),
        notes,
        updatedAt: new Date().toISOString(),
      };
      visits[index] = updated;
      await writeOneTimeVisits(visits);
      const [enriched] = await enrichOneTimeVisits([updated]);
      return enriched || updated;
    }

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
    if (id.startsWith("OTV-")) {
      const visits = await readOneTimeVisits();
      const nextVisits = visits.filter((visit: any) => visit?.id !== id);
      if (nextVisits.length === visits.length) return null;
      await writeOneTimeVisits(nextVisits);
      return { deleted: true, id };
    }

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
