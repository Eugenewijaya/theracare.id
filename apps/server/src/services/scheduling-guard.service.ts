import { sql, type SQLWrapper } from "drizzle-orm";
import { httpError } from "../utils/http-error.js";
import { normalizeDateKey } from "../utils/date-key.js";

type DbClient = {
  execute: (query: string | SQLWrapper) => unknown;
};

export type ScheduleGuardSlot = {
  id?: string | null;
  therapistId?: string | null;
  childId?: string | null;
  roomId?: string | null;
  date?: string | Date | null;
  startTime?: string | null;
  duration?: string | number | null;
};

function normalizeClock(value?: string | null) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseMinutes(value?: string | null) {
  const normalized = normalizeClock(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

export function parseScheduleDurationMinutes(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.round(value));
  const raw = String(value || "").trim().toLowerCase();
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(h|hour|hours|jam)/);
  if (hourMatch) return Math.max(1, Math.round(Number(hourMatch[1]) * 60));
  const minuteMatch = raw.match(/(\d+)\s*(m|min|mins|minute|minutes|menit)?/);
  if (minuteMatch) return Math.max(1, Number(minuteMatch[1]));
  return 60;
}

function rangesOverlap(aStart: number, aDuration: number, bStart: number, bDuration: number) {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

function sameNonEmptyValue(a?: string | null, b?: string | null) {
  return Boolean(a && b && a === b);
}

function describeSlot(slot: ScheduleGuardSlot) {
  return `${normalizeDateKey(slot.date)} ${normalizeClock(slot.startTime) || slot.startTime || ""}`.trim();
}

export function getSchedulingLockKeys(slot: ScheduleGuardSlot) {
  const date = normalizeDateKey(slot.date);
  if (!date) return [];
  return [
    slot.therapistId ? `schedule:therapist:${slot.therapistId}:${date}` : "",
    slot.childId ? `schedule:child:${slot.childId}:${date}` : "",
    slot.roomId ? `schedule:room:${slot.roomId}:${date}` : "",
  ].filter(Boolean);
}

export async function lockAdvisoryKeys(client: DbClient, keys: string[]) {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean))).sort();
  for (const key of uniqueKeys) {
    await client.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  }
}

export async function lockSchedulingSlots(client: DbClient, slots: ScheduleGuardSlot[]) {
  await lockAdvisoryKeys(client, slots.flatMap(getSchedulingLockKeys));
}

export function findLocalScheduleConflict(existingSlots: ScheduleGuardSlot[], candidate: ScheduleGuardSlot) {
  const candidateDate = normalizeDateKey(candidate.date);
  const candidateStart = parseMinutes(candidate.startTime);
  if (!candidateDate || candidateStart === null) return null;
  const candidateDuration = parseScheduleDurationMinutes(candidate.duration);

  return existingSlots.find((existing) => {
    if (existing.id && candidate.id && existing.id === candidate.id) return false;
    if (normalizeDateKey(existing.date) !== candidateDate) return false;
    const existingStart = parseMinutes(existing.startTime);
    if (existingStart === null) return false;
    if (!rangesOverlap(candidateStart, candidateDuration, existingStart, parseScheduleDurationMinutes(existing.duration))) {
      return false;
    }
    return sameNonEmptyValue(existing.therapistId, candidate.therapistId)
      || sameNonEmptyValue(existing.childId, candidate.childId)
      || sameNonEmptyValue(existing.roomId, candidate.roomId);
  }) || null;
}

export function assertNoLocalScheduleConflicts(slots: ScheduleGuardSlot[]) {
  const accepted: ScheduleGuardSlot[] = [];
  for (const slot of slots) {
    const conflict = findLocalScheduleConflict(accepted, slot);
    if (conflict) {
      const resources = [
        sameNonEmptyValue(conflict.therapistId, slot.therapistId) ? "terapis" : "",
        sameNonEmptyValue(conflict.childId, slot.childId) ? "anak" : "",
        sameNonEmptyValue(conflict.roomId, slot.roomId) ? "ruangan" : "",
      ].filter(Boolean).join(", ");
      throw httpError(
        409,
        `Payload jadwal memiliki slot tumpang tindih untuk ${resources || "resource yang sama"}: ${describeSlot(conflict)} dan ${describeSlot(slot)}.`,
        { conflict, candidate: slot },
      );
    }
    accepted.push(slot);
  }
}
