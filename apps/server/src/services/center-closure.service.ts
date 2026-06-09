import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, therapySessions } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { dateKeyFromDate, normalizeDateKey, parseDateKey, todayDateKey } from "../utils/date-key.js";
import { notificationService } from "./notification.service.js";
import { notifyCenterClosureSessionConflict } from "./schedule-conflict-notification.service.js";
import { evaluateSessionSlot } from "./scheduling-availability.service.js";
import { sessionService } from "./session.service.js";

const CENTER_CLOSURES_KEY = "centerClosures";
const CLOSURE_WRITE_LOCK_KEY = "center-closures:write";
const VALID_TYPES = new Set(["public_holiday", "manual_off", "temporary_closure"]);
const VALID_CONTACT_CHANNELS = new Set(["whatsapp", "phone", "in_person", "other"]);
const RESOLVED_IMPACT_STATUSES = new Set(["rescheduled_manual", "rescheduled_auto", "not_applicable"]);
const PROCESSING_IMPACT_STATUSES = new Set(["manual_processing", "auto_processing"]);
const PROCESSING_STALE_MS = 10 * 60 * 1000;
const AUTO_RETRY_MS = 6 * 60 * 60 * 1000;
const AUTO_SEARCH_DAYS = 210;

type DbClient = typeof db | any;
type CenterClosureType = "public_holiday" | "manual_off" | "temporary_closure";
type CenterClosureSource = "auto" | "manual";
type CenterClosureImpactStatus =
  | "awaiting_contact"
  | "contacted"
  | "manual_processing"
  | "auto_processing"
  | "rescheduled_manual"
  | "rescheduled_auto"
  | "auto_failed"
  | "not_applicable";

export type CenterClosureImpact = {
  sessionId: string;
  childId: string;
  childName: string;
  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  therapistId: string;
  therapistName: string;
  therapyPeriodId?: string;
  periodEndDate?: string;
  originalDate: string;
  originalStartTime: string;
  duration?: string;
  roomId?: string;
  status: CenterClosureImpactStatus;
  contactChannel?: string;
  contactNote?: string;
  contactedAt?: string;
  contactedBy?: string;
  replacementSessionId?: string;
  replacementDate?: string;
  replacementStartTime?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  processingAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt?: string;
};

export type CenterClosure = {
  id: string;
  title: string;
  type: CenterClosureType;
  source: CenterClosureSource;
  startDate: string;
  endDate: string;
  note?: string;
  reopensAt?: string;
  isActive: boolean;
  impacts: CenterClosureImpact[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
};

type HolidayCandidate = {
  date: string;
  title: string;
  source: string;
  isCollectiveLeave?: boolean;
};

function parseClosures(value?: string | null): CenterClosure[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.map((closure) => ({ ...closure, impacts: Array.isArray(closure?.impacts) ? closure.impacts : [] }))
      : [];
  } catch {
    return [];
  }
}

function isIsoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHalfHourClock(value: unknown) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(value);
}

function normalizeDateRange(startDate: string, endDate?: string) {
  const end = endDate && endDate >= startDate ? endDate : startDate;
  return { startDate, endDate: end };
}

function normalizeClosure(input: any, createdBy?: string): CenterClosure {
  if (!VALID_TYPES.has(input?.type)) {
    throw new Error("Jenis jadwal off center tidak valid");
  }
  if (!isIsoDate(input?.startDate)) {
    throw new Error("Tanggal mulai wajib diisi dengan format YYYY-MM-DD");
  }

  const { startDate, endDate } = normalizeDateRange(input.startDate, input.endDate);
  const now = new Date().toISOString();
  return {
    id: input.id || generateId("CLOSE"),
    title: String(input.title || "Center libur").trim(),
    type: input.type,
    source: input.source === "auto" ? "auto" : "manual",
    startDate,
    endDate,
    note: typeof input.note === "string" ? input.note.trim() : "",
    reopensAt: isIsoDate(input.reopensAt) ? input.reopensAt : "",
    isActive: input.isActive !== false,
    impacts: Array.isArray(input.impacts) ? input.impacts : [],
    createdAt: input.createdAt || now,
    updatedAt: now,
    createdBy: input.createdBy || createdBy,
  };
}

async function readClosures(client: DbClient = db) {
  const row = await client.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, CENTER_CLOSURES_KEY),
  });
  return parseClosures(row?.value);
}

async function writeClosures(closures: CenterClosure[], client: DbClient = db) {
  await client.insert(clinicSettings)
    .values({
      key: CENTER_CLOSURES_KEY,
      value: JSON.stringify(closures),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(closures), updatedAt: new Date() },
    });
}

async function withClosureWriteLock<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CLOSURE_WRITE_LOCK_KEY}))`);
    return callback(tx);
  });
}

function sortClosures(closures: CenterClosure[]) {
  return [...closures].sort((a, b) => {
    const date = b.startDate.localeCompare(a.startDate);
    if (date !== 0) return date;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function sortImpacts(impacts: CenterClosureImpact[]) {
  return [...impacts].sort((a, b) => (
    a.originalDate.localeCompare(b.originalDate)
    || a.originalStartTime.localeCompare(b.originalStartTime)
    || a.childName.localeCompare(b.childName)
  ));
}

function isResolvedImpact(impact: CenterClosureImpact) {
  return RESOLVED_IMPACT_STATUSES.has(impact.status);
}

function isProcessingImpact(impact: CenterClosureImpact) {
  return PROCESSING_IMPACT_STATUSES.has(impact.status);
}

function isStaleProcessing(impact: CenterClosureImpact) {
  const processingAt = Date.parse(impact.processingAt || "");
  return !Number.isFinite(processingAt) || Date.now() - processingAt >= PROCESSING_STALE_MS;
}

function shouldRetryAutomaticImpact(impact: CenterClosureImpact) {
  if (impact.status !== "auto_failed") return true;
  const lastAttemptAt = Date.parse(impact.lastAttemptAt || "");
  return !Number.isFinite(lastAttemptAt) || Date.now() - lastAttemptAt >= AUTO_RETRY_MS;
}

function addDays(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}

function maxDateKey(...values: string[]) {
  return values.filter(isIsoDate).sort().at(-1) || "";
}

async function sendClosureNotification(closure: CenterClosure, action: string) {
  const dateLabel = closure.startDate === closure.endDate
    ? closure.startDate
    : `${closure.startDate} sampai ${closure.endDate}`;
  const status = closure.isActive ? "aktif" : "dinonaktifkan";
  await notificationService.create({
    type: "center_closure",
    icon: closure.isActive ? "event_busy" : "event_available",
    title: "Jadwal operasional center diperbarui",
    message: `${closure.title} (${dateLabel}) ${status}. ${action}`,
    targetRole: "all",
    relatedId: closure.id,
  });
}

async function findImpactedSessions(closure: CenterClosure) {
  if (!closure.isActive) return [];
  return db.query.therapySessions.findMany({
    where: sql`${therapySessions.date} >= ${closure.startDate}
      and ${therapySessions.date} <= ${closure.endDate}
      and ${therapySessions.status} not in ('cancelled', 'canceled', 'done', 'completed')`,
    with: {
      child: { with: { parent: { with: { user: true } } } },
      therapist: { with: { user: true } },
      therapyPeriod: true,
    },
  });
}

function buildImpact(session: any, existing?: CenterClosureImpact): CenterClosureImpact {
  const now = new Date().toISOString();
  const baseStatus = existing?.status === "not_applicable" ? "awaiting_contact" : existing?.status;
  return {
    ...existing,
    sessionId: session.id,
    childId: session.childId,
    childName: session.child?.name || session.childId,
    parentId: session.child?.parentId || session.child?.parent?.id || "",
    parentName: session.child?.parent?.user?.name || "",
    parentPhone: session.child?.parent?.user?.phone || "",
    therapistId: session.therapistId,
    therapistName: session.therapist?.user?.name || session.therapist?.nit || session.therapistId,
    therapyPeriodId: session.therapyPeriodId || "",
    periodEndDate: normalizeDateKey(session.therapyPeriod?.endDate),
    originalDate: normalizeDateKey(session.date),
    originalStartTime: session.startTime,
    duration: session.duration || "",
    roomId: session.roomId || "",
    status: baseStatus || "awaiting_contact",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

async function refreshClosureImpacts(closure: CenterClosure) {
  const sessions = await findImpactedSessions(closure);
  const existingBySession = new Map((closure.impacts || []).map((impact) => [impact.sessionId, impact]));
  const matchedIds = new Set(sessions.map((session) => session.id));
  const newSessionIds: string[] = [];
  const current = sessions.map((session) => {
    const existing = existingBySession.get(session.id);
    if (!existing || existing.status === "not_applicable") newSessionIds.push(session.id);
    return buildImpact(session, existing);
  });
  const retained = (closure.impacts || [])
    .filter((impact) => !matchedIds.has(impact.sessionId))
    .map((impact) => (
      isResolvedImpact(impact)
        ? impact
        : { ...impact, status: "not_applicable" as CenterClosureImpactStatus, updatedAt: new Date().toISOString() }
    ));
  const impacts = sortImpacts([...current, ...retained]);
  return {
    closure: { ...closure, impacts },
    newSessionIds,
  };
}

async function notifyNewClosureImpacts(closure: CenterClosure, sessionIds: string[]) {
  for (const sessionId of sessionIds) {
    await notifyCenterClosureSessionConflict(sessionId, `center off: ${closure.title}`);
  }
}

async function mutateImpact(
  closureId: string,
  sessionId: string,
  updater: (impact: CenterClosureImpact, closure: CenterClosure) => CenterClosureImpact,
) {
  return withClosureWriteLock(async (tx) => {
    const closures = await readClosures(tx);
    const closureIndex = closures.findIndex((closure) => closure.id === closureId);
    if (closureIndex === -1) throw new Error("Jadwal off center tidak ditemukan.");
    const closure = closures[closureIndex];
    const impactIndex = closure.impacts.findIndex((impact) => impact.sessionId === sessionId);
    if (impactIndex === -1) throw new Error("Sesi terdampak tidak ditemukan pada jadwal off ini.");
    const nextImpact = updater(closure.impacts[impactIndex], closure);
    const nextClosure = {
      ...closure,
      impacts: closure.impacts.map((impact, index) => index === impactIndex ? nextImpact : impact),
      updatedAt: new Date().toISOString(),
    };
    closures[closureIndex] = nextClosure;
    await writeClosures(sortClosures(closures), tx);
    return { closure: nextClosure, impact: nextImpact };
  });
}

async function claimImpact(closureId: string, sessionId: string, status: "manual_processing" | "auto_processing") {
  let previousStatus: CenterClosureImpactStatus = "awaiting_contact";
  const result = await mutateImpact(closureId, sessionId, (impact, closure) => {
    if (!closure.isActive) throw new Error("Jadwal off center sudah nonaktif.");
    if (isResolvedImpact(impact)) throw new Error("Sesi terdampak ini sudah diselesaikan.");
    if (isProcessingImpact(impact) && !isStaleProcessing(impact)) {
      throw new Error("Sesi terdampak sedang diproses. Muat ulang beberapa saat lagi.");
    }
    previousStatus = impact.status === "auto_processing" || impact.status === "manual_processing"
      ? "awaiting_contact"
      : impact.status;
    const now = new Date().toISOString();
    return {
      ...impact,
      status,
      processingAt: now,
      ...(status === "auto_processing" ? { lastAttemptAt: now } : {}),
      updatedAt: now,
    };
  });
  return { ...result, previousStatus };
}

async function restoreManualImpact(closureId: string, sessionId: string, previousStatus: CenterClosureImpactStatus, error: unknown) {
  await mutateImpact(closureId, sessionId, (impact) => {
    if (impact.status !== "manual_processing") return impact;
    return {
      ...impact,
      status: previousStatus,
      processingAt: undefined,
      lastError: error instanceof Error ? error.message : "Pemindahan sesi gagal.",
      updatedAt: new Date().toISOString(),
    };
  });
}

async function failAutomaticImpact(closureId: string, sessionId: string, error: unknown) {
  await mutateImpact(closureId, sessionId, (impact) => {
    if (impact.status !== "auto_processing") return impact;
    return {
      ...impact,
      status: "auto_failed",
      processingAt: undefined,
      lastError: error instanceof Error ? error.message : "Pemindahan otomatis gagal.",
      updatedAt: new Date().toISOString(),
    };
  });
}

async function completeImpact(
  closureId: string,
  sessionId: string,
  status: "rescheduled_manual" | "rescheduled_auto" | "not_applicable",
  data: { actorId?: string; replacement?: any; error?: string } = {},
) {
  return mutateImpact(closureId, sessionId, (impact) => {
    const now = new Date().toISOString();
    return {
      ...impact,
      status,
      replacementSessionId: data.replacement?.id || impact.replacementSessionId,
      replacementDate: normalizeDateKey(data.replacement?.date) || impact.replacementDate,
      replacementStartTime: data.replacement?.startTime || impact.replacementStartTime,
      resolvedAt: now,
      resolvedBy: data.actorId || (status === "rescheduled_auto" ? "system" : impact.resolvedBy),
      processingAt: undefined,
      lastError: data.error || "",
      updatedAt: now,
    };
  });
}

async function findAutomaticReplacement(session: any, closure: CenterClosure) {
  const originalDate = normalizeDateKey(session.date);
  const originalDateValue = parseDateKey(originalDate);
  if (!originalDateValue) throw new Error("Tanggal sesi asal tidak valid.");
  const periodEndDate = normalizeDateKey(session.therapyPeriod?.endDate);
  const startDate = maxDateKey(
    addDays(periodEndDate || closure.endDate, 1),
    addDays(closure.endDate, 1),
    todayDateKey(),
  );
  const originalWeekday = originalDateValue.getDay();

  for (let offset = 0; offset <= AUTO_SEARCH_DAYS; offset += 1) {
    const candidateDate = addDays(startDate, offset);
    const candidateValue = parseDateKey(candidateDate);
    if (!candidateValue || candidateValue.getDay() !== originalWeekday) continue;
    const availability = await evaluateSessionSlot({
      therapistId: session.therapistId,
      childId: session.childId,
      roomId: session.roomId,
      date: candidateDate,
      startTime: session.startTime,
      duration: session.duration,
    }, session.id);
    if (availability.status === "available") {
      return { date: candidateDate, startTime: session.startTime };
    }
  }

  throw new Error(`Tidak ditemukan slot pengganti dengan hari dan jam yang sama dalam ${AUTO_SEARCH_DAYS} hari setelah periode.`);
}

async function processAutomaticImpact(closureId: string, sessionId: string) {
  let claimed: Awaited<ReturnType<typeof claimImpact>> | null = null;
  try {
    claimed = await claimImpact(closureId, sessionId, "auto_processing");
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, sessionId),
      with: { therapyPeriod: true },
    });
    if (!session) {
      await completeImpact(closureId, sessionId, "not_applicable", { error: "Sesi asal tidak ditemukan." });
      return { status: "skipped", sessionId };
    }
    if (["cancelled", "canceled", "done", "completed", "active"].includes(String(session.status || "").toLowerCase())) {
      await completeImpact(closureId, sessionId, "not_applicable", { error: `Status sesi asal sudah ${session.status}.` });
      return { status: "skipped", sessionId };
    }

    const replacement = await findAutomaticReplacement(session, claimed.closure);
    const result = await sessionService.cancelWithPolicy(sessionId, {
      policy: "replacement",
      cancelReason: `Pemindahan otomatis H-1 karena center off: ${claimed.closure.title}.`,
      replacement: {
        ...replacement,
        note: `Dijadwalkan otomatis setelah periode karena tidak ada konfirmasi pemindahan hingga H-1 jadwal off ${claimed.closure.title}.`,
      },
    });
    if (!result?.replacement) throw new Error("Sesi pengganti otomatis tidak berhasil dibuat.");
    await completeImpact(closureId, sessionId, "rescheduled_auto", { replacement: result.replacement });
    await notificationService.create({
      type: "center_closure_auto_reschedule",
      icon: "event_repeat",
      title: "Sesi tanggal merah dipindahkan otomatis",
      message: `${claimed.impact.childName} dipindahkan dari ${claimed.impact.originalDate} ${claimed.impact.originalStartTime} ke ${normalizeDateKey(result.replacement.date)} ${result.replacement.startTime} karena belum ada konfirmasi hingga H-1.`,
      targetRole: "admin",
      relatedId: result.replacement.id,
    });
    return { status: "rescheduled", sessionId, replacement: result.replacement };
  } catch (error) {
    if (claimed) {
      await failAutomaticImpact(closureId, sessionId, error);
      await notificationService.create({
        type: "center_closure_auto_reschedule_failed",
        icon: "error",
        title: "Pemindahan otomatis tanggal merah perlu ditangani",
        message: `${claimed.impact.childName}: ${error instanceof Error ? error.message : "Pemindahan otomatis gagal."}`,
        targetRole: "admin",
        relatedId: sessionId,
      });
    }
    return { status: "failed", sessionId, error: error instanceof Error ? error.message : "Pemindahan otomatis gagal." };
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromHariLiburApi(year: number): Promise<HolidayCandidate[]> {
  const payload = await fetchWithTimeout(`https://api-hari-libur.vercel.app/api?year=${year}`);
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows
    .filter((item: any) => isIsoDate(item?.date))
    .map((item: any) => {
      const title = String(item.description || item.name || "Hari libur nasional").trim();
      return {
        date: item.date,
        title,
        source: "api-hari-libur",
        isCollectiveLeave: title.toLowerCase().includes("cuti bersama"),
      };
    });
}

async function fetchFromNager(year: number): Promise<HolidayCandidate[]> {
  const payload = await fetchWithTimeout(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .filter((item: any) => isIsoDate(item?.date))
    .map((item: any) => ({
      date: item.date,
      title: String(item.localName || item.name || "Hari libur nasional").trim(),
      source: "nager-date",
      isCollectiveLeave: false,
    }));
}

export const centerClosureService = {
  async getAll() {
    const closures = await readClosures();
    const today = todayDateKey();
    const activeToday = closures.find((closure) => (
      closure.isActive && closure.startDate <= today && (closure.endDate || closure.startDate) >= today
    )) || null;
    return { closures: sortClosures(closures), activeToday };
  },

  async getIndonesianHolidays(year: number) {
    if (!Number.isInteger(year) || year < 2020 || year > 2035) {
      throw new Error("Tahun libur nasional tidak valid");
    }
    try {
      const holidays = await fetchFromHariLiburApi(year);
      if (holidays.length > 0) return holidays;
    } catch (error) {
      console.warn("[center-closures] api-hari-libur failed, using fallback", error);
    }
    return fetchFromNager(year);
  },

  async create(data: any, createdBy?: string) {
    const initial = normalizeClosure(data, createdBy);
    const { closure, newSessionIds } = await refreshClosureImpacts(initial);
    await withClosureWriteLock(async (tx) => {
      const closures = await readClosures(tx);
      await writeClosures(sortClosures([closure, ...closures]), tx);
    });
    if (data.notify !== false) {
      await sendClosureNotification(closure, `${newSessionIds.length} sesi terdampak dicatat untuk tindak lanjut admin.`);
      await notifyNewClosureImpacts(closure, newSessionIds);
    }
    return closure;
  },

  async applyHolidays(data: { holidays?: HolidayCandidate[]; year?: number; notify?: boolean }, createdBy?: string) {
    const year = Number(data.year || new Date().getFullYear());
    const incoming = Array.isArray(data.holidays) && data.holidays.length > 0
      ? data.holidays
      : await this.getIndonesianHolidays(year);
    const { populated, nextItems, closures } = await withClosureWriteLock(async (tx) => {
      const current = await readClosures(tx);
      const existingKeys = new Set(current.map((closure) => `${closure.type}:${closure.startDate}`));
      const createdAt = new Date().toISOString();
      const initialItems = incoming
        .filter((holiday) => isIsoDate(holiday.date))
        .filter((holiday) => !existingKeys.has(`public_holiday:${holiday.date}`))
        .map((holiday) => normalizeClosure({
          id: generateId("CLOSE"),
          title: holiday.title,
          type: "public_holiday",
          source: "auto",
          startDate: holiday.date,
          endDate: holiday.date,
          note: holiday.isCollectiveLeave ? "Cuti bersama nasional Indonesia" : "Hari libur nasional Indonesia",
          isActive: true,
          createdAt,
        }, createdBy));
      const populated = await Promise.all(initialItems.map((closure) => refreshClosureImpacts(closure)));
      const nextItems = populated.map((item) => item.closure);
      const closures = sortClosures([...nextItems, ...current]);
      await writeClosures(closures, tx);
      return { populated, nextItems, closures };
    });

    if (nextItems.length > 0 && data.notify !== false) {
      const totalImpacts = nextItems.reduce((total, closure) => total + closure.impacts.length, 0);
      await notificationService.create({
        type: "center_closure",
        icon: "event_busy",
        title: "Tanggal merah Indonesia diterapkan",
        message: `${nextItems.length} tanggal merah tahun ${year} diterapkan sebagai jadwal off center. ${totalImpacts} sesi terdampak dicatat untuk tindak lanjut admin.`,
        targetRole: "all",
      });
      for (let index = 0; index < populated.length; index += 1) {
        await notifyNewClosureImpacts(populated[index].closure, populated[index].newSessionIds);
      }
    }

    return { added: nextItems.length, closures };
  },

  async update(id: string, updates: any) {
    const result = await withClosureWriteLock(async (tx) => {
      const closures = await readClosures(tx);
      const index = closures.findIndex((closure) => closure.id === id);
      if (index === -1) return null;
      const normalized = normalizeClosure({ ...closures[index], ...updates, id }, closures[index].createdBy);
      const refreshed = await refreshClosureImpacts(normalized);
      closures[index] = refreshed.closure;
      await writeClosures(sortClosures(closures), tx);
      return refreshed;
    });
    if (!result) return null;
    const { closure, newSessionIds } = result;
    if (updates.notify !== false) {
      await sendClosureNotification(
        closure,
        closure.isActive
          ? `${newSessionIds.length} sesi terdampak baru dicatat untuk tindak lanjut admin.`
          : "Jadwal off center dinonaktifkan dan center kembali aktif sesuai jadwal operasional.",
      );
      if (closure.isActive) await notifyNewClosureImpacts(closure, newSessionIds);
    }
    return closure;
  },

  async delete(id: string) {
    return withClosureWriteLock(async (tx) => {
      const closures = await readClosures(tx);
      const target = closures.find((closure) => closure.id === id);
      if (!target) return null;
      if (target.impacts.some((impact) => impact.status === "rescheduled_manual" || impact.status === "rescheduled_auto")) {
        throw new Error("Jadwal off yang sudah menghasilkan sesi pengganti tidak dapat dihapus. Nonaktifkan agar riwayat tetap tersimpan.");
      }
      await writeClosures(closures.filter((closure) => closure.id !== id), tx);
      return { deleted: true, id };
    });
  },

  async recordContact(closureId: string, sessionId: string, data: any, actorId?: string) {
    const channel = String(data?.channel || "").trim();
    if (!VALID_CONTACT_CHANNELS.has(channel)) throw new Error("Kanal konfirmasi tidak valid.");
    return mutateImpact(closureId, sessionId, (impact) => {
      if (isResolvedImpact(impact)) throw new Error("Sesi terdampak ini sudah diselesaikan.");
      if (isProcessingImpact(impact) && !isStaleProcessing(impact)) {
        throw new Error("Sesi terdampak sedang diproses. Muat ulang beberapa saat lagi.");
      }
      const now = new Date().toISOString();
      return {
        ...impact,
        status: "contacted",
        contactChannel: channel,
        contactNote: String(data?.note || "").trim(),
        contactedAt: now,
        contactedBy: actorId,
        updatedAt: now,
      };
    });
  },

  async rescheduleImpact(closureId: string, sessionId: string, data: any, actorId?: string) {
    const replacementDate = String(data?.date || "").trim();
    const replacementStartTime = String(data?.startTime || "").trim();
    if (!isIsoDate(replacementDate)) throw new Error("Tanggal sesi pengganti wajib diisi.");
    if (!isHalfHourClock(replacementStartTime)) throw new Error("Jam sesi pengganti wajib memakai interval 30 menit.");
    const claimed = await claimImpact(closureId, sessionId, "manual_processing");
    try {
      const result = await sessionService.cancelWithPolicy(sessionId, {
        policy: "replacement",
        cancelReason: `Dipindahkan admin setelah konfirmasi orang tua karena center off: ${claimed.closure.title}.`,
        replacement: {
          date: replacementDate,
          startTime: replacementStartTime,
          note: String(data?.note || "").trim() || `Sesi pengganti karena center off ${claimed.closure.title}.`,
        },
      });
      if (!result?.replacement) throw new Error("Sesi pengganti tidak berhasil dibuat.");
      return completeImpact(closureId, sessionId, "rescheduled_manual", {
        actorId,
        replacement: result.replacement,
      });
    } catch (error) {
      await restoreManualImpact(closureId, sessionId, claimed.previousStatus, error);
      throw error;
    }
  },

  async processDueAutomaticReplacements(limit = 5) {
    const today = todayDateKey();
    const closures = await readClosures();
    const due = closures.flatMap((closure) => (
      closure.isActive
        ? closure.impacts
          .filter((impact) => !isResolvedImpact(impact))
          .filter((impact) => !isProcessingImpact(impact) || isStaleProcessing(impact))
          .filter(shouldRetryAutomaticImpact)
          .filter((impact) => addDays(impact.originalDate, -1) <= today)
          .map((impact) => ({ closureId: closure.id, sessionId: impact.sessionId }))
        : []
    )).slice(0, Math.max(1, Math.min(20, limit)));

    const results = [];
    for (const item of due) {
      results.push(await processAutomaticImpact(item.closureId, item.sessionId));
    }
    return {
      checkedAt: new Date().toISOString(),
      due: due.length,
      rescheduled: results.filter((item) => item.status === "rescheduled").length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      results,
    };
  },
};
