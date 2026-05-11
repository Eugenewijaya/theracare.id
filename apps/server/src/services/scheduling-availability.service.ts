import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, therapists, therapySessions } from "../db/schema.js";

export type SlotAvailabilityStatus = "available" | "conflict";
export type SlotConflictKind = "operational" | "therapist";

export type SlotAvailability = {
  date: string;
  time: string;
  status: SlotAvailabilityStatus;
  reason?: string;
  kind?: SlotConflictKind;
};

type CenterClosure = {
  title?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

function parseJsonArray(value?: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMinutes(value?: string | null) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseOperatingWindow(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return { start: 8 * 60, end: 17 * 60 };
  if (/tutup|closed|libur/i.test(raw)) return null;

  const match = raw.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (!match) return { start: 8 * 60, end: 17 * 60 };

  const start = parseMinutes(match[1]);
  const end = parseMinutes(match[2]);
  if (start === null || end === null || end <= start) return { start: 8 * 60, end: 17 * 60 };
  return { start, end };
}

async function getSettingsMap() {
  const rows = await db.select().from(clinicSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function operationalConflict(settings: Record<string, string | null>, date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{1,2}:\d{2}$/.test(time || "")) {
    return "Tanggal atau jam tidak valid.";
  }

  const closures = parseJsonArray(settings.centerClosures) as CenterClosure[];
  const activeClosure = closures.find((closure) => (
    closure?.isActive !== false
    && typeof closure.startDate === "string"
    && date >= closure.startDate
    && date <= (closure.endDate || closure.startDate)
  ));
  if (activeClosure) {
    return `Center sedang off: ${activeClosure.title || "jadwal operasional ditutup"}.`;
  }

  const day = new Date(`${date}T00:00:00`).getDay();
  const windowValue = day === 0 || day === 6
    ? settings.operatingHoursWeekend
    : settings.operatingHoursWeekday;
  const window = parseOperatingWindow(windowValue);
  if (!window) return "Center tutup pada hari tersebut.";

  const minutes = parseMinutes(time);
  if (minutes === null || minutes < window.start || minutes >= window.end) {
    return "Slot berada di luar jam operasional center.";
  }

  return "";
}

export async function evaluateOperationalSlot(slot: { date: string; time: string }): Promise<SlotAvailability> {
  const settings = await getSettingsMap();
  const reason = operationalConflict(settings, slot.date, slot.time);
  if (reason) {
    return { ...slot, status: "conflict", reason, kind: "operational" };
  }
  return { ...slot, status: "available" };
}

export async function evaluateTherapistSlot(
  therapistId: string,
  slot: { date: string; time: string },
  excludeSessionId?: string,
): Promise<SlotAvailability> {
  const operational = await evaluateOperationalSlot(slot);
  if (operational.status === "conflict") return operational;

  const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, therapistId) });
  if (!therapist) {
    return { ...slot, status: "conflict", reason: "Terapis tidak ditemukan.", kind: "therapist" };
  }

  const conflict = await db.query.therapySessions.findFirst({
    where: and(
      eq(therapySessions.therapistId, therapistId),
      eq(therapySessions.date, slot.date),
      eq(therapySessions.startTime, slot.time),
      sql`${therapySessions.status} not in ('cancelled', 'done')`,
      excludeSessionId ? sql`${therapySessions.id} != ${excludeSessionId}` : sql`true`,
    ),
  });

  if (conflict) {
    return {
      ...slot,
      status: "conflict",
      reason: `Bentrok dengan sesi ${conflict.childId || conflict.id}.`,
      kind: "therapist",
    };
  }

  return { ...slot, status: "available" };
}

export async function annotateSlotsForTherapist(
  therapistId: string,
  slots: Array<{ date: string; time: string }>,
  excludeSessionId?: string,
) {
  const normalized = slots
    .filter((slot) => slot?.date && slot?.time)
    .map((slot) => ({ date: slot.date, time: slot.time }));
  return Promise.all(normalized.map((slot) => evaluateTherapistSlot(therapistId, slot, excludeSessionId)));
}

export async function getAvailableTherapistsForSlot(
  date: string,
  time: string,
  options: { excludeTherapistId?: string; excludeSessionId?: string } = {},
) {
  const allTherapists = await db.query.therapists.findMany({ with: { user: true } });
  const rows = await Promise.all(allTherapists
    .filter((therapist) => therapist.id !== options.excludeTherapistId)
    .map(async (therapist) => ({
      therapist,
      availability: await evaluateTherapistSlot(therapist.id, { date, time }, options.excludeSessionId),
    })));

  return rows.map(({ therapist, availability }) => ({
    id: therapist.id,
    nit: therapist.nit,
    name: therapist.user?.name || therapist.nit,
    specialty: therapist.specialty,
    avatar: therapist.avatar || therapist.user?.image,
    status: availability.status,
    reason: availability.reason,
  }));
}
