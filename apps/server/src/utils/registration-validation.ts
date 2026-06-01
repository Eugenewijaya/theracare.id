import { httpError } from "./http-error.js";
import { normalizeDateKey } from "./date-key.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_ALIASES: Record<string, string> = {
  sunday: "Minggu",
  sun: "Minggu",
  minggu: "Minggu",
  min: "Minggu",
  monday: "Senin",
  mon: "Senin",
  senin: "Senin",
  sen: "Senin",
  tuesday: "Selasa",
  tue: "Selasa",
  tues: "Selasa",
  selasa: "Selasa",
  sel: "Selasa",
  wednesday: "Rabu",
  wed: "Rabu",
  rabu: "Rabu",
  rab: "Rabu",
  thursday: "Kamis",
  thu: "Kamis",
  thur: "Kamis",
  thurs: "Kamis",
  kamis: "Kamis",
  kam: "Kamis",
  friday: "Jumat",
  fri: "Jumat",
  jumat: "Jumat",
  jum: "Jumat",
  saturday: "Sabtu",
  sat: "Sabtu",
  sabtu: "Sabtu",
  sab: "Sabtu",
};

function normalizeDayKey(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/hari/g, "")
    .replace(/[^a-z]/g, "");
}

function parseMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function normalizePhoneNumber(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  if (digits.startsWith("8")) return `0${digits}`;
  return digits;
}

export function normalizeEmailAddress(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export function assertValidPhone(phone: unknown, fieldLabel = "Nomor HP", required = false) {
  const normalized = normalizePhoneNumber(typeof phone === "string" ? phone : "");
  if (!normalized) {
    if (required) throw httpError(400, `${fieldLabel} wajib diisi.`);
    return "";
  }
  if (!/^0\d{8,14}$/.test(normalized)) {
    throw httpError(400, `${fieldLabel} tidak valid. Gunakan format nomor Indonesia, contoh 081234567890.`);
  }
  return normalized;
}

export function assertValidEmail(email: unknown, fieldLabel = "Email", required = false) {
  const normalized = normalizeEmailAddress(typeof email === "string" ? email : "");
  if (!normalized) {
    if (required) throw httpError(400, `${fieldLabel} wajib diisi.`);
    return "";
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    throw httpError(400, `${fieldLabel} tidak valid.`);
  }
  return normalized;
}

export function assertValidDateKey(value: unknown, fieldLabel: string, required = false) {
  const normalized = normalizeDateKey(typeof value === "string" ? value : "");
  if (!normalized) {
    if (required) throw httpError(400, `${fieldLabel} wajib diisi.`);
    return "";
  }
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${fieldLabel} tidak valid.`);
  return normalized;
}

export function assertAllowedStatus(status: unknown, allowed: string[], fieldLabel = "Status") {
  const normalized = String(status || "").trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    throw httpError(400, `${fieldLabel} tidak valid. Nilai yang diperbolehkan: ${allowed.join(", ")}.`);
  }
  return normalized;
}

export function normalizeClockValue(value: unknown) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function assertPositiveInteger(value: unknown, fieldLabel: string, options: { required?: boolean; min?: number; max?: number } = {}) {
  const { required = false, min = 1, max = 999 } = options;
  if (value === undefined || value === null || value === "") {
    if (required) throw httpError(400, `${fieldLabel} wajib diisi.`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw httpError(400, `${fieldLabel} harus berupa angka ${min} sampai ${max}.`);
  }
  return parsed;
}

export function normalizeTherapistSchedule(input: unknown, options: { required?: boolean } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (options.required) throw httpError(400, "Pilih minimal satu hari kerja terapis.");
    return {};
  }

  const normalized: Record<string, { start: string; end: string }> = {};
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    if (!value) continue;
    const canonicalDay = DAY_ALIASES[normalizeDayKey(key)];
    if (!canonicalDay) {
      throw httpError(400, `Hari kerja terapis tidak valid: ${key}.`);
    }
    const start = normalizeClockValue(value?.start || value?.startTime || value?.mulai);
    const end = normalizeClockValue(value?.end || value?.endTime || value?.selesai);
    if (!start || !end) {
      throw httpError(400, `Jam kerja ${canonicalDay} wajib berformat HH:MM.`);
    }
    if (parseMinutes(end) <= parseMinutes(start)) {
      throw httpError(400, `Jam selesai ${canonicalDay} harus lebih besar dari jam mulai.`);
    }
    normalized[canonicalDay] = { start, end };
  }

  if (options.required && Object.keys(normalized).length === 0) {
    throw httpError(400, "Pilih minimal satu hari kerja terapis.");
  }
  return normalized;
}
