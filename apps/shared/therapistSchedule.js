const DAY_SCHEDULE_KEYS = {
  0: ['Minggu', 'Min', 'Sunday', 'Sun'],
  1: ['Senin', 'Sen', 'Monday', 'Mon'],
  2: ['Selasa', 'Sel', 'Tuesday', 'Tue', 'Tues'],
  3: ['Rabu', 'Rab', 'Wednesday', 'Wed'],
  4: ['Kamis', 'Kam', 'Thursday', 'Thu', 'Thur', 'Thurs'],
  5: ['Jumat', 'Jum', 'Friday', 'Fri'],
  6: ['Sabtu', 'Sab', 'Saturday', 'Sat'],
};

const START_KEYS = [
  'start',
  'startTime',
  'start_time',
  'from',
  'open',
  'clockIn',
  'jamMulai',
  'mulai',
  'begin',
  'workStart',
  'work_start',
  'availableFrom',
  'available_from',
];

const END_KEYS = [
  'end',
  'endTime',
  'end_time',
  'to',
  'close',
  'clockOut',
  'jamSelesai',
  'selesai',
  'finish',
  'workEnd',
  'work_end',
  'availableUntil',
  'available_until',
  'until',
];

const SCHEDULE_SOURCE_KEYS = [
  'schedule',
  'workingHours',
  'workHours',
  'workSchedule',
  'workingSchedule',
  'availability',
  'availabilityRules',
  'workDays',
];

const ARRAY_DAY_KEYS = ['day', 'hari', 'weekday', 'weekDay', 'dayName'];

const KNOWN_DAY_KEYS = new Set(
  Object.values(DAY_SCHEDULE_KEYS).flat().map(normalizeScheduleKey),
);

export function normalizeScheduleKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/hari/g, '')
    .replace(/[^a-z]/g, '');
}

export function normalizeClockValue(value = '') {
  const raw = String(value || '').trim();
  const shortHour = raw.match(/^(\d{1,2})$/);
  const match = shortHour
    ? [raw, shortHour[1], '00']
    : raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseMinutes(value = '') {
  const normalized = normalizeClockValue(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function parseDurationMinutes(value = '') {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value || '').toLowerCase();
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(h|hour|hours|jam)/);
  if (hourMatch) return Math.max(1, Math.round(Number(hourMatch[1]) * 60));
  const minuteMatch = raw.match(/(\d+)\s*(m|min|mins|minute|minutes|menit)?/);
  if (minuteMatch) return Math.max(1, Number(minuteMatch[1]));
  return 60;
}

function pickValue(source, keys) {
  return keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null && value !== '');
}

function isExplicitlyOff(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return value.active === false
    || value.enabled === false
    || value.isActive === false
    || value.available === false
    || value.isAvailable === false
    || value.off === true
    || value.isOff === true
    || value.closed === true
    || value.isClosed === true;
}

export function parseWorkWindow(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseWorkWindow(item);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof value === 'string') {
    if (/off|libur|tutup|inactive|closed/i.test(value)) return null;
    const match = value.match(/(\d{1,2}(?:[:.]\d{1,2})?).*?(\d{1,2}(?:[:.]\d{1,2})?)/);
    return match ? { start: normalizeClockValue(match[1]), end: normalizeClockValue(match[2]) } : null;
  }
  if (typeof value === 'object') {
    if (isExplicitlyOff(value)) return null;
    const nested = value.hours || value.workingHours || value.time || value.window || value.range;
    const start = pickValue(value, START_KEYS);
    const end = pickValue(value, END_KEYS);
    if ((start === undefined || end === undefined) && nested) return parseWorkWindow(nested);
    return {
      start: normalizeClockValue(start),
      end: normalizeClockValue(end),
    };
  }
  return null;
}

function hasDayScheduleKey(schedule) {
  if (!schedule || typeof schedule !== 'object') return false;
  if (Array.isArray(schedule)) {
    return schedule.some((rule) => getRuleDayIndex(rule) !== null);
  }
  return Object.keys(schedule).some((key) => KNOWN_DAY_KEYS.has(normalizeScheduleKey(key)));
}

export function resolveTherapistSchedule(source) {
  if (!source || typeof source !== 'object') return null;
  const candidates = [
    ...SCHEDULE_SOURCE_KEYS.map((key) => source[key]),
    source.raw && typeof source.raw === 'object' ? resolveTherapistSchedule(source.raw) : null,
    source.profile && typeof source.profile === 'object' ? resolveTherapistSchedule(source.profile) : null,
    source.user && typeof source.user === 'object' ? resolveTherapistSchedule(source.user) : null,
    hasDayScheduleKey(source) ? source : null,
  ].filter(Boolean);

  return candidates.find((candidate) => hasDayScheduleKey(candidate)) || null;
}

function getRuleDayIndex(rule) {
  if (!rule || typeof rule !== 'object') return null;
  if (Number.isInteger(rule.dayOfWeek) && rule.dayOfWeek >= 0 && rule.dayOfWeek <= 6) return Number(rule.dayOfWeek);
  for (const key of ARRAY_DAY_KEYS) {
    const normalized = normalizeScheduleKey(rule[key]);
    const day = Object.entries(DAY_SCHEDULE_KEYS).find(([, aliases]) => aliases.map(normalizeScheduleKey).includes(normalized));
    if (day) return Number(day[0]);
  }
  return null;
}

function getWindowFromArraySchedule(schedule, day) {
  const matching = schedule.find((rule) => getRuleDayIndex(rule) === day);
  return matching ? parseWorkWindow(matching) : null;
}

export function getTherapistWorkWindowForDate(therapistOrSchedule, dateValue) {
  const schedule = Array.isArray(therapistOrSchedule)
    ? therapistOrSchedule
    : resolveTherapistSchedule(therapistOrSchedule);
  if (!schedule) return { known: false, window: null };

  const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue}T00:00:00`);
  const day = Number.isNaN(date.getTime()) ? null : date.getDay();
  if (day === null) return { known: false, window: null };

  if (Array.isArray(schedule)) {
    return { known: schedule.some((rule) => getRuleDayIndex(rule) !== null), window: getWindowFromArraySchedule(schedule, day) };
  }

  const keys = (DAY_SCHEDULE_KEYS[day] || []).map(normalizeScheduleKey);
  const entry = Object.entries(schedule).find(([key]) => keys.includes(normalizeScheduleKey(key)));
  return { known: hasDayScheduleKey(schedule), window: entry ? parseWorkWindow(entry[1]) : null };
}

export function getTherapistSlotAvailability(therapist, dateValue, startTime, duration = 60) {
  if (!therapist || !dateValue || !startTime) return { known: false, available: true, label: '', window: null };
  const { known, window } = getTherapistWorkWindowForDate(therapist, dateValue);
  if (!known) return { known: false, available: true, label: '', window: null };
  if (!window?.start || !window?.end) return { known: true, available: false, label: 'Off hari ini', window };

  const slotStart = parseMinutes(startTime);
  const workStart = parseMinutes(window.start);
  const workEnd = parseMinutes(window.end);
  if (slotStart === null || workStart === null || workEnd === null || workEnd <= workStart) {
    return { known: true, available: true, label: '', window };
  }
  const slotEnd = slotStart + parseDurationMinutes(duration);
  if (slotStart < workStart) return { known: true, available: false, label: `Mulai ${window.start}`, window };
  if (slotEnd > workEnd) return { known: true, available: false, label: `Off mulai ${window.end}`, window };
  return { known: true, available: true, label: '', window };
}
