import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, rooms, therapists, therapySessions } from "../db/schema.js";
import { parseScheduleDurationMinutes } from "./scheduling-guard.service.js";

export type SlotAvailabilityStatus = "available" | "conflict";
export type SlotConflictKind = "operational" | "therapist" | "child" | "room";

export type SlotAvailability = {
  date: string;
  time: string;
  duration?: string;
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

type TherapistScheduleValue = string | Array<unknown> | {
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
  start_time?: string;
  end_time?: string;
  from?: string;
  to?: string;
  open?: string;
  close?: string;
  clockIn?: string;
  clockOut?: string;
  jamMulai?: string;
  jamSelesai?: string;
  mulai?: string;
  selesai?: string;
  begin?: string;
  finish?: string;
  workStart?: string;
  workEnd?: string;
  work_start?: string;
  work_end?: string;
  availableFrom?: string;
  availableUntil?: string;
  available_from?: string;
  available_until?: string;
  until?: string;
  active?: boolean;
  enabled?: boolean;
  isActive?: boolean;
  available?: boolean;
  isAvailable?: boolean;
  off?: boolean;
  isOff?: boolean;
  closed?: boolean;
  isClosed?: boolean;
  hours?: TherapistScheduleValue;
  workingHours?: TherapistScheduleValue;
  time?: TherapistScheduleValue;
  window?: TherapistScheduleValue;
  range?: TherapistScheduleValue;
} | null | undefined;

type TherapistSchedule = Record<string, TherapistScheduleValue>;

type TherapistLeaveRequest = {
  therapistId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
};

const DAY_SCHEDULE_KEYS: Record<number, string[]> = {
  0: ["Minggu", "Min", "Sunday", "Sun"],
  1: ["Senin", "Sen", "Monday", "Mon"],
  2: ["Selasa", "Sel", "Tuesday", "Tue", "Tues"],
  3: ["Rabu", "Rab", "Wednesday", "Wed"],
  4: ["Kamis", "Kam", "Thursday", "Thu", "Thur", "Thurs"],
  5: ["Jumat", "Jum", "Friday", "Fri"],
  6: ["Sabtu", "Sab", "Saturday", "Sat"],
};

function parseJsonArray(value?: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseVisitStatus(value?: string | null) {
  return String(value || "upcoming").toLowerCase();
}

function normalizeClockValue(value?: string | null) {
  const raw = String(value || "").trim();
  const shortHour = raw.match(/^(\d{1,2})$/);
  const match = shortHour
    ? [raw, shortHour[1], "00"]
    : raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseMinutes(value?: string | null) {
  const normalized = normalizeClockValue(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseDurationMinutes(value?: string | null) {
  return parseScheduleDurationMinutes(value);
}

function parseOperatingWindow(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return { start: 8 * 60, end: 17 * 60 };
  if (/tutup|closed|libur/i.test(raw)) return null;

  const match = raw.match(/(\d{1,2}[:.]\d{2}).*?(\d{1,2}[:.]\d{2})/);
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

function overlaps(startA: number, durationA: number, startB: number, durationB: number) {
  return startA < startB + durationB && startB < startA + durationA;
}

function operationalConflict(settings: Record<string, string | null>, date: string, time: string, duration?: string) {
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
  const durationMinutes = parseDurationMinutes(duration);
  if (minutes === null || minutes < window.start || minutes >= window.end || minutes + durationMinutes > window.end) {
    return "Slot berada di luar jam operasional center.";
  }

  return "";
}

function getLeaveTypeLabel(type?: string) {
  if (type === "sakit") return "sakit";
  if (type === "unpaid_leave") return "unpaid leave";
  return "cuti";
}

function therapistLeaveConflict(settings: Record<string, string | null>, therapistId: string, date: string) {
  const requests = parseJsonArray(settings.therapistLeaveRequests) as TherapistLeaveRequest[];
  const activeLeave = requests.find((request) => (
    request?.status === "approved"
    && request?.therapistId === therapistId
    && typeof request.startDate === "string"
    && date >= request.startDate
    && date <= (request.endDate || request.startDate)
  ));
  if (!activeLeave) return "";
  return `Terapis sedang ${getLeaveTypeLabel(activeLeave.type)} pada tanggal tersebut.`;
}

function normalizeScheduleKey(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/hari/g, "")
    .replace(/[^a-z]/g, "");
}

function parseWorkWindow(value: TherapistScheduleValue): { start?: string; end?: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseWorkWindow(item as TherapistScheduleValue);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof value === "string") {
    if (/off|libur|tutup|inactive|closed/i.test(value)) return null;
    const match = value.match(/(\d{1,2}(?:[:.]\d{1,2})?).*?(\d{1,2}(?:[:.]\d{1,2})?)/);
    return match ? { start: normalizeClockValue(match[1]), end: normalizeClockValue(match[2]) } : null;
  }
  if (typeof value === "object") {
    if (value.active === false || value.enabled === false || value.isActive === false
      || value.available === false || value.isAvailable === false
      || value.off === true || value.isOff === true || value.closed === true || value.isClosed === true) return null;
    const nested = value.hours || value.workingHours || value.time || value.window || value.range;
    const start = value.start || value.startTime || value.start_time || value.from || value.open || value.clockIn || value.jamMulai || value.mulai || value.begin || value.workStart || value.work_start || value.availableFrom || value.available_from;
    const end = value.end || value.endTime || value.end_time || value.to || value.close || value.clockOut || value.jamSelesai || value.selesai || value.finish || value.workEnd || value.work_end || value.availableUntil || value.available_until || value.until;
    if ((!start || !end) && nested) return parseWorkWindow(nested);
    return {
      start: normalizeClockValue(start),
      end: normalizeClockValue(end),
    };
  }
  return null;
}

function hasRecognizedSchedule(schedule: TherapistSchedule | null | undefined) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return false;
  const recognizedKeys = new Set(Object.values(DAY_SCHEDULE_KEYS).flat().map(normalizeScheduleKey));
  return Object.keys(schedule).some((key) => recognizedKeys.has(normalizeScheduleKey(key)));
}

function getTherapistScheduleForDate(schedule: TherapistSchedule | null | undefined, date: string) {
  if (!hasRecognizedSchedule(schedule)) return null;
  const day = new Date(`${date}T00:00:00`).getDay();
  const keys = (DAY_SCHEDULE_KEYS[day] || []).map(normalizeScheduleKey);
  const direct = (DAY_SCHEDULE_KEYS[day] || []).map((key) => schedule?.[key]).find(Boolean);
  if (direct) return parseWorkWindow(direct);
  const entry = Object.entries(schedule || {}).find(([key, value]) => (
    keys.includes(normalizeScheduleKey(key)) && Boolean(parseWorkWindow(value))
  ));
  return entry ? parseWorkWindow(entry[1]) : undefined;
}

function therapistScheduleConflict(schedule: TherapistSchedule | null | undefined, slot: { date: string; time: string; duration?: string }) {
  if (!hasRecognizedSchedule(schedule)) return "";

  const daySchedule = getTherapistScheduleForDate(schedule, slot.date);
  if (!daySchedule) return "Terapis sedang off pada hari tersebut.";

  const start = parseMinutes(daySchedule.start);
  const end = parseMinutes(daySchedule.end);
  const slotStart = parseMinutes(slot.time);
  const duration = parseDurationMinutes(slot.duration);
  if (start === null || end === null || slotStart === null || end <= start) return "";
  if (slotStart < start || slotStart + duration > end) {
    return "Slot berada di luar jadwal kerja terapis.";
  }
  return "";
}

async function findSessionOverlap(
  field: "therapistId" | "childId" | "roomId",
  entityId: string,
  slot: { date: string; time: string; duration?: string },
  excludeSessionId?: string,
) {
  const start = parseMinutes(slot.time);
  if (start === null) return null;
  const duration = parseDurationMinutes(slot.duration);
  const sessions = await db.query.therapySessions.findMany({
    where: and(
      eq(therapySessions[field], entityId),
      eq(therapySessions.date, slot.date),
      sql`${therapySessions.status} not in ('cancelled', 'canceled', 'done', 'completed')`,
      excludeSessionId ? sql`${therapySessions.id} != ${excludeSessionId}` : sql`true`,
    ),
  });

  const sessionConflict = sessions.find((session) => {
    const otherStart = parseMinutes(session.startTime);
    if (otherStart === null) return false;
    return overlaps(start, duration, otherStart, parseDurationMinutes(session.duration));
  });
  if (sessionConflict) return sessionConflict;

  if (field === "therapistId") {
    const settings = await getSettingsMap();
    const oneTimeVisits = parseJsonArray(settings.oneTimeVisitLog);
    const visitConflict = oneTimeVisits.find((visit: any) => {
      if (visit?.therapistId !== entityId || visit?.date !== slot.date || visit?.id === excludeSessionId) return false;
      if (["cancelled", "canceled", "done", "completed"].includes(parseVisitStatus(visit?.status))) return false;
      const otherStart = parseMinutes(visit?.startTime);
      if (otherStart === null) return false;
      return overlaps(start, duration, otherStart, parseDurationMinutes(visit?.duration));
    });
    if (visitConflict) {
      return {
        id: visitConflict.id,
        childId: visitConflict.visitorName || "one-time visit",
        startTime: visitConflict.startTime,
        duration: visitConflict.duration,
      } as any;
    }
  }

  return null;
}

export async function evaluateOperationalSlot(slot: { date: string; time: string; duration?: string }): Promise<SlotAvailability> {
  const settings = await getSettingsMap();
  const reason = operationalConflict(settings, slot.date, slot.time, slot.duration);
  if (reason) {
    return { ...slot, status: "conflict", reason, kind: "operational" };
  }
  return { ...slot, status: "available" };
}

export async function evaluateTherapistSlot(
  therapistId: string,
  slot: { date: string; time: string; duration?: string },
  excludeSessionId?: string,
): Promise<SlotAvailability> {
  const operational = await evaluateOperationalSlot(slot);
  if (operational.status === "conflict") return operational;

  const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, therapistId) });
  if (!therapist) {
    return { ...slot, status: "conflict", reason: "Terapis tidak ditemukan.", kind: "therapist" };
  }

  const settings = await getSettingsMap();
  const leaveReason = therapistLeaveConflict(settings, therapistId, slot.date);
  if (leaveReason) {
    return { ...slot, status: "conflict", reason: leaveReason, kind: "therapist" };
  }

  const scheduleReason = therapistScheduleConflict(therapist.schedule, slot);
  if (scheduleReason) {
    return { ...slot, status: "conflict", reason: scheduleReason, kind: "therapist" };
  }

  const conflict = await findSessionOverlap("therapistId", therapistId, slot, excludeSessionId);

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

export async function evaluateChildSlot(
  childId: string,
  slot: { date: string; time: string; duration?: string },
  excludeSessionId?: string,
): Promise<SlotAvailability> {
  const operational = await evaluateOperationalSlot(slot);
  if (operational.status === "conflict") return operational;

  const conflict = await findSessionOverlap("childId", childId, slot, excludeSessionId);
  if (conflict) {
    return {
      ...slot,
      status: "conflict",
      reason: `Anak sudah memiliki sesi pada jam tersebut (${conflict.id}).`,
      kind: "child",
    };
  }

  return { ...slot, status: "available" };
}

export async function evaluateRoomSlot(
  roomId: string,
  slot: { date: string; time: string; duration?: string },
  excludeSessionId?: string,
): Promise<SlotAvailability> {
  const operational = await evaluateOperationalSlot(slot);
  if (operational.status === "conflict") return operational;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) {
    return { ...slot, status: "conflict", reason: "Ruangan tidak ditemukan.", kind: "room" };
  }
  if (room.status && room.status !== "active") {
    return { ...slot, status: "conflict", reason: "Ruangan sedang tidak aktif.", kind: "room" };
  }

  const conflict = await findSessionOverlap("roomId", roomId, slot, excludeSessionId);
  if (conflict) {
    return {
      ...slot,
      status: "conflict",
      reason: `Ruangan sudah dipakai pada jam tersebut (${conflict.id}).`,
      kind: "room",
    };
  }

  return { ...slot, status: "available" };
}

export async function evaluateSessionSlot(
  session: { therapistId: string; childId: string; roomId?: string | null; date: string; startTime: string; duration?: string | null },
  excludeSessionId?: string,
): Promise<SlotAvailability> {
  const slot = { date: session.date, time: session.startTime, duration: session.duration || undefined };
  const therapist = await evaluateTherapistSlot(session.therapistId, slot, excludeSessionId);
  if (therapist.status === "conflict") return therapist;
  const child = await evaluateChildSlot(session.childId, slot, excludeSessionId);
  if (child.status === "conflict") return child;
  if (session.roomId) {
    const room = await evaluateRoomSlot(session.roomId, slot, excludeSessionId);
    if (room.status === "conflict") return room;
  }
  return { ...slot, status: "available" };
}

export async function annotateSlotsForTherapist(
  therapistId: string,
  slots: Array<{ date: string; time: string; duration?: string }>,
  excludeSessionId?: string,
) {
  const normalized = slots
    .filter((slot) => slot?.date && slot?.time)
    .map((slot) => ({ date: slot.date, time: slot.time, duration: slot.duration }));
  return Promise.all(normalized.map((slot) => evaluateTherapistSlot(therapistId, slot, excludeSessionId)));
}

export async function getAvailableTherapistsForSlot(
  date: string,
  time: string,
  options: { duration?: string; excludeTherapistId?: string; excludeSessionId?: string } = {},
) {
  const allTherapists = await db.query.therapists.findMany({ with: { user: true } });
  const rows = await Promise.all(allTherapists
    .filter((therapist) => therapist.id !== options.excludeTherapistId)
    .map(async (therapist) => ({
      therapist,
      availability: await evaluateTherapistSlot(therapist.id, { date, time, duration: options.duration }, options.excludeSessionId),
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
