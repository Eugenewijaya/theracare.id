import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { todayDateKey } from "../utils/date-key.js";
import { notificationService } from "./notification.service.js";
import { notifyCenterClosureSessionConflicts } from "./schedule-conflict-notification.service.js";

const CENTER_CLOSURES_KEY = "centerClosures";
const VALID_TYPES = new Set(["public_holiday", "manual_off", "temporary_closure"]);

type CenterClosureType = "public_holiday" | "manual_off" | "temporary_closure";
type CenterClosureSource = "auto" | "manual";

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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isIsoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    createdAt: input.createdAt || now,
    updatedAt: now,
    createdBy: input.createdBy || createdBy,
  };
}

async function readClosures() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, CENTER_CLOSURES_KEY),
  });
  return parseClosures(row?.value);
}

async function writeClosures(closures: CenterClosure[]) {
  await db.insert(clinicSettings)
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

function sortClosures(closures: CenterClosure[]) {
  return [...closures].sort((a, b) => {
    const date = b.startDate.localeCompare(a.startDate);
    if (date !== 0) return date;
    return b.createdAt.localeCompare(a.createdAt);
  });
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
    const closure = normalizeClosure(data, createdBy);
    const closures = await readClosures();
    await writeClosures(sortClosures([closure, ...closures]));
    if (data.notify !== false) {
      await sendClosureNotification(closure, "Pengumuman otomatis dikirim ke portal admin, terapis, dan orang tua.");
      if (closure.isActive) {
        await notifyCenterClosureSessionConflicts(
          closure.startDate,
          closure.endDate,
          `center off: ${closure.title}`,
        );
      }
    }
    return closure;
  },

  async applyHolidays(data: { holidays?: HolidayCandidate[]; year?: number; notify?: boolean }, createdBy?: string) {
    const year = Number(data.year || new Date().getFullYear());
    const incoming = Array.isArray(data.holidays) && data.holidays.length > 0
      ? data.holidays
      : await this.getIndonesianHolidays(year);
    const current = await readClosures();
    const existingKeys = new Set(current.map((closure) => `${closure.type}:${closure.startDate}`));
    const createdAt = new Date().toISOString();
    const nextItems = incoming
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

    const closures = sortClosures([...nextItems, ...current]);
    await writeClosures(closures);

    if (nextItems.length > 0 && data.notify !== false) {
      await notificationService.create({
        type: "center_closure",
        icon: "event_busy",
        title: "Tanggal merah Indonesia diterapkan",
        message: `${nextItems.length} tanggal merah tahun ${year} diterapkan sebagai jadwal off center. Jadwal terapi pada tanggal tersebut perlu dikonfirmasi admin.`,
        targetRole: "all",
      });
      for (const closure of nextItems) {
        await notifyCenterClosureSessionConflicts(
          closure.startDate,
          closure.endDate,
          `center off: ${closure.title}`,
        );
      }
    }

    return { added: nextItems.length, closures };
  },

  async update(id: string, updates: any) {
    const closures = await readClosures();
    const index = closures.findIndex((closure) => closure.id === id);
    if (index === -1) return null;
    const closure = normalizeClosure({ ...closures[index], ...updates, id }, closures[index].createdBy);
    closures[index] = closure;
    await writeClosures(sortClosures(closures));
    if (updates.notify !== false) {
      await sendClosureNotification(closure, closure.isActive ? "Jadwal off center diaktifkan." : "Jadwal off center dinonaktifkan dan center kembali aktif sesuai jadwal operasional.");
      if (closure.isActive) {
        await notifyCenterClosureSessionConflicts(
          closure.startDate,
          closure.endDate,
          `center off: ${closure.title}`,
        );
      }
    }
    return closure;
  },

  async delete(id: string) {
    const closures = await readClosures();
    const target = closures.find((closure) => closure.id === id);
    if (!target) return null;
    await writeClosures(closures.filter((closure) => closure.id !== id));
    return { deleted: true, id };
  },
};
