import React from 'react';
import { getTherapistSlotAvailability, getTherapistWorkWindowForDate } from '../therapistSchedule';

const DAY_COLUMNS = [
  { key: 'Senin', english: 'Monday', short: 'SEN', offset: 0, aliases: ['senin', 'sen', 'monday', 'mon'] },
  { key: 'Selasa', english: 'Tuesday', short: 'SEL', offset: 1, aliases: ['selasa', 'sel', 'tuesday', 'tue', 'tues'] },
  { key: 'Rabu', english: 'Wednesday', short: 'RAB', offset: 2, aliases: ['rabu', 'rab', 'wednesday', 'wed'] },
  { key: 'Kamis', english: 'Thursday', short: 'KAM', offset: 3, aliases: ['kamis', 'kam', 'thursday', 'thu', 'thur', 'thurs'] },
  { key: 'Jumat', english: 'Friday', short: 'JUM', offset: 4, aliases: ['jumat', 'jum', 'friday', 'fri'] },
  { key: 'Sabtu', english: 'Saturday', short: 'SAB', offset: 5, aliases: ['sabtu', 'sab', 'saturday', 'sat'] },
];

const DEFAULT_SLOTS = [
  { start: '10:00', duration: 90 },
  { start: '12:30', duration: 90 },
  { start: '14:30', duration: 90 },
  { start: '16:30', duration: 90 },
];

const THERAPIST_PALETTES = [
  { row: 'bg-amber-50 text-amber-950', cell: 'bg-amber-50/80', chip: 'bg-amber-100 text-amber-900 border-amber-200' },
  { row: 'bg-blue-50 text-blue-950', cell: 'bg-blue-50/80', chip: 'bg-blue-100 text-blue-900 border-blue-200' },
  { row: 'bg-emerald-50 text-emerald-950', cell: 'bg-emerald-50/80', chip: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  { row: 'bg-rose-50 text-rose-950', cell: 'bg-rose-50/80', chip: 'bg-rose-100 text-rose-900 border-rose-200' },
  { row: 'bg-violet-50 text-violet-950', cell: 'bg-violet-50/80', chip: 'bg-violet-100 text-violet-900 border-violet-200' },
  { row: 'bg-cyan-50 text-cyan-950', cell: 'bg-cyan-50/80', chip: 'bg-cyan-100 text-cyan-900 border-cyan-200' },
];

const OFF_CELL_CLASS = 'bg-red-500 text-white';
const OFF_CHIP_CLASS = 'border-red-200 bg-red-50 text-red-700';

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(value) {
  if (!value) return new Date();
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function getMonday(input) {
  const date = parseDateKey(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function formatDateShort(date) {
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatWeekLabel(monday) {
  const saturday = addDays(monday, 5);
  return `${formatDateShort(monday)} - ${formatDateShort(saturday)} ${saturday.getFullYear()}`;
}

function normalizeClockValue(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function parseMinutes(value) {
  const normalized = normalizeClockValue(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseDurationMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value || '').toLowerCase();
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(h|hour|hours|jam)/);
  if (hourMatch) return Math.max(1, Math.round(Number(hourMatch[1]) * 60));
  const minuteMatch = raw.match(/(\d+)\s*(m|min|mins|minute|minutes|menit)?/);
  if (minuteMatch) return Math.max(1, Number(minuteMatch[1]));
  return 60;
}

function formatClock(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')}`;
}

function formatRange(start, duration) {
  const startMinutes = parseMinutes(start);
  if (startMinutes === null) return start || '-';
  return `${formatClock(startMinutes)} - ${formatClock(startMinutes + duration)}`;
}

function getTherapistId(therapist) {
  return therapist?.id || therapist?.nit || therapist?.therapistId || '';
}

function getTherapistName(therapist) {
  return therapist?.name || therapist?.fullName || therapist?.nit || 'Terapis';
}

function getSessionTherapistId(session) {
  return session?.therapistId || session?.therapist?.id || session?.therapist?.nit || '';
}

function getSessionDateKey(session) {
  return session?.date || session?.sessionDate || '';
}

function getChildName(session, childrenList) {
  if (session?.isOneTime) return session?.visitorName || session?.child?.name || 'One-time visit';
  if (session?.child?.name) return session.child.name;
  if (session?.childName) return session.childName;
  const child = childrenList.find((item) => item.id === session?.childId || item.nita === session?.childId);
  return child?.name || session?.childId || 'Anak';
}

function getSlotKey(start, duration) {
  return `${start}|${duration}`;
}

function normalizeScheduleKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/hari/g, '')
    .replace(/[^a-z]/g, '');
}

function parseWorkWindow(value) {
  if (!value) return null;
  if (Array.isArray(value)) return parseWorkWindow(value.find(Boolean));
  if (typeof value === 'string') {
    if (/off|libur|tutup|inactive/i.test(value)) return null;
    const match = value.match(/(\d{1,2}[:.]\d{2}).*?(\d{1,2}[:.]\d{2})/);
    return match ? { start: normalizeClockValue(match[1]), end: normalizeClockValue(match[2]) } : null;
  }
  if (typeof value === 'object') {
    if (value.active === false || value.enabled === false || value.isActive === false) return null;
    const start = value.start || value.startTime || value.start_time || value.from || value.open || value.clockIn || value.jamMulai || value.mulai || value.begin;
    const end = value.end || value.endTime || value.end_time || value.to || value.close || value.clockOut || value.jamSelesai || value.selesai || value.finish;
    return {
      start: normalizeClockValue(start) || start,
      end: normalizeClockValue(end) || end,
    };
  }
  return null;
}

function getRecognizedScheduleEntries(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return [];
  const recognizedKeys = new Set(DAY_COLUMNS.flatMap((day) => [
    day.key,
    day.english,
    day.short,
    ...(day.aliases || []),
  ].map(normalizeScheduleKey)));

  return Object.entries(schedule).filter(([key, value]) => (
    recognizedKeys.has(normalizeScheduleKey(key)) && Boolean(parseWorkWindow(value))
  ));
}

function getWeekDates(monday) {
  return DAY_COLUMNS.map((day) => ({
    ...day,
    date: addDays(monday, day.offset),
    dateKey: toDateKey(addDays(monday, day.offset)),
  }));
}

function addSlot(slots, start, duration, source = 'session') {
  const normalizedStart = normalizeClockValue(start);
  if (!normalizedStart || !Number.isFinite(duration) || duration <= 0) return;
  slots.set(getSlotKey(normalizedStart, duration), { start: normalizedStart, duration, source });
}

function getSlotsForWeek(sessions, weekDates, therapists = []) {
  const weekDateSet = new Set(weekDates.map((day) => day.dateKey));
  const slots = new Map();
  DEFAULT_SLOTS.forEach((slot) => addSlot(slots, slot.start, slot.duration, 'default'));

  (therapists || []).forEach((therapist) => {
    weekDates.forEach((day) => {
      const { known, window } = getTherapistWorkWindowForDate(therapist, day.date);
      if (!known || !window?.start || !window?.end) return;
      const workStart = parseMinutes(window.start);
      const workEnd = parseMinutes(window.end);
      if (workStart === null || workEnd === null || workEnd <= workStart) return;
      addSlot(slots, window.start, workEnd - workStart, 'workWindow');
    });
  });

  (sessions || []).forEach((session) => {
    const dateKey = getSessionDateKey(session);
    const start = session?.startTime || session?.time;
    if (!weekDateSet.has(dateKey) || !start) return;
    const duration = parseDurationMinutes(session?.duration);
    addSlot(slots, start, duration, 'session');
  });

  return Array.from(slots.values())
    .filter((slot) => parseMinutes(slot.start) !== null)
    .sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));
}

function sessionOverlapsSlot(session, slot) {
  if (slot?.source === 'workWindow') return false;
  const sessionStart = parseMinutes(session?.startTime || session?.time);
  const slotStart = parseMinutes(slot.start);
  if (sessionStart === null || slotStart === null) return false;
  const sessionDuration = parseDurationMinutes(session?.duration);
  const slotDuration = slot.duration;
  return sessionStart < slotStart + slotDuration && slotStart < sessionStart + sessionDuration;
}

function getScheduleForDay(schedule, day) {
  if (!schedule || typeof schedule !== 'object') return null;
  const directKeys = [
    day.key,
    day.english,
    day.short,
    ...(day.aliases || []),
  ];
  const wanted = new Set(directKeys.map(normalizeScheduleKey));
  const direct = directKeys.map((key) => schedule[key]).find(Boolean);
  if (direct) return parseWorkWindow(direct);

  const entry = Object.entries(schedule).find(([key, value]) => (
    wanted.has(normalizeScheduleKey(key)) && Boolean(parseWorkWindow(value))
  ));
  return entry ? parseWorkWindow(entry[1]) : null;
}

function hasRecognizedSchedule(schedule) {
  return getRecognizedScheduleEntries(schedule).length > 0;
}

function isInsideWorkWindow(therapist, day, slot) {
  const availability = getTherapistSlotAvailability(therapist, day.date, slot.start, slot.duration);
  if (!availability.known) return { available: true, severity: 'unknown' };
  if (availability.available) return { available: true, severity: 'work_hours' };
  if (availability.label === 'Off hari ini') return { available: false, label: 'OFF', severity: 'day_off' };
  return { available: false, label: availability.label || 'Di luar jam', severity: 'outside_hours' };
}

function getClosureForDate(centerClosures, dateKey) {
  return (centerClosures || []).find((closure) => (
    closure?.isActive !== false
    && closure?.startDate
    && dateKey >= closure.startDate
    && dateKey <= (closure.endDate || closure.startDate)
  )) || null;
}

function getLeaveForDate(leaveRequests, therapistId, dateKey) {
  return (leaveRequests || []).find((request) => (
    request?.status === 'approved'
    && request?.therapistId === therapistId
    && request?.startDate
    && dateKey >= request.startDate
    && dateKey <= (request.endDate || request.startDate)
  )) || null;
}

function getLeaveLabel(type) {
  if (type === 'sakit') return 'SAKIT';
  if (type === 'unpaid_leave') return 'UNPAID';
  return 'CUTI';
}

function getVisibleTherapists(therapists, sessions) {
  const source = Array.isArray(therapists) ? therapists : [];
  if (source.length > 0) return source;
  const map = new Map();
  (sessions || []).forEach((session) => {
    const id = getSessionTherapistId(session);
    if (!id || map.has(id)) return;
    map.set(id, { id, name: session?.therapist?.name || id });
  });
  return Array.from(map.values());
}

function TherapistWeeklyScheduleTable({
  title = 'Jadwal Terapi Mingguan',
  subtitle = 'Ringkasan jadwal terapis, sesi anak, cuti, dan libur center.',
  sessions = [],
  therapists = [],
  childrenList = [],
  leaveRequests = [],
  centerClosures = [],
  initialDate = new Date(),
  onSelectSession,
  compact = false,
}) {
  const [weekStart, setWeekStart] = React.useState(() => getMonday(initialDate));

  React.useEffect(() => {
    setWeekStart(getMonday(initialDate));
  }, [initialDate]);

  const weekDates = React.useMemo(() => getWeekDates(weekStart), [weekStart]);
  const visibleTherapists = React.useMemo(() => getVisibleTherapists(therapists, sessions), [therapists, sessions]);
  const slots = React.useMemo(() => getSlotsForWeek(sessions, weekDates, visibleTherapists), [sessions, weekDates, visibleTherapists]);
  const weekTitle = formatWeekLabel(weekStart);

  const shiftWeek = (count) => setWeekStart((prev) => addDays(prev, count * 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Jadwal tabel</p>
          <h2 className="mt-0.5 break-words text-base font-black leading-tight text-slate-950 dark:text-white sm:text-lg">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Minggu sebelumnya"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <div className="min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-black text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            {weekTitle}
          </div>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Minggu berikutnya"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-black text-white shadow-sm transition hover:bg-primary/90"
          >
            Hari ini
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full min-w-[720px] table-fixed border-collapse text-[11px] leading-tight sm:min-w-0 ${compact ? 'text-[10px] sm:text-[11px]' : ''}`}>
          <colgroup>
            <col className="w-[34px]" />
            <col className="w-[96px] sm:w-[112px]" />
            <col className="w-[82px] sm:w-[92px]" />
            {weekDates.map((day) => <col key={day.dateKey} />)}
          </colgroup>
          <thead>
            <tr className="bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-white">
              <th className="border border-slate-300 px-1 py-2 text-center font-black dark:border-slate-700">NO</th>
              <th className="border border-slate-300 px-1.5 py-2 text-left font-black dark:border-slate-700">TERAPIS</th>
              <th className="border border-slate-300 px-1.5 py-2 text-center font-black dark:border-slate-700">JAM</th>
              {weekDates.map((day) => (
                <th key={day.dateKey} className="border border-slate-300 px-1 py-2 text-center font-black dark:border-slate-700">
                  <div>{day.short}</div>
                  <div className="mt-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">{formatDateShort(day.date)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTherapists.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-slate-200 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-slate-800">
                  Belum ada data terapis untuk ditampilkan.
                </td>
              </tr>
            ) : visibleTherapists.map((therapist, therapistIndex) => {
              const therapistId = getTherapistId(therapist);
              const palette = THERAPIST_PALETTES[therapistIndex % THERAPIST_PALETTES.length];
              const therapistSessions = (sessions || []).filter((session) => getSessionTherapistId(session) === therapistId);

              return slots.map((slot, slotIndex) => (
                <tr key={`${therapistId || therapistIndex}-${slot.start}-${slot.duration}`} className="align-middle">
                  {slotIndex === 0 && (
                    <>
                      <td rowSpan={slots.length} className="border border-slate-300 bg-white px-1 py-2 text-center text-sm font-black text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {therapistIndex + 1}
                      </td>
                      <td rowSpan={slots.length} className={`border border-slate-300 px-2 py-2 text-center text-xs font-black uppercase dark:border-slate-700 ${palette.row}`}>
                        <div className="break-words">{getTherapistName(therapist)}</div>
                        {therapist?.specialty && (
                          <div className="mt-1 line-clamp-2 text-[9px] font-bold normal-case tracking-normal opacity-70">{therapist.specialty}</div>
                        )}
                      </td>
                    </>
                  )}
                  <td className="border border-slate-300 bg-white px-1 py-1.5 text-center font-black text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <div>{formatRange(slot.start, slot.duration)}</div>
                    {slot.source === 'workWindow' && (
                      <div className="mt-0.5 text-[9px] font-bold normal-case text-primary">Jam kerja</div>
                    )}
                  </td>
                  {weekDates.map((day) => {
                    const dateSessions = therapistSessions.filter((session) => (
                      getSessionDateKey(session) === day.dateKey && sessionOverlapsSlot(session, slot)
                    ));
                    const closure = getClosureForDate(centerClosures, day.dateKey);
                    const leave = getLeaveForDate(leaveRequests, therapistId, day.dateKey);
                    const workWindow = isInsideWorkWindow(therapist, day, slot);
                    const offLabel = closure
                      ? 'CENTER OFF'
                      : leave
                        ? getLeaveLabel(leave.type)
                        : workWindow.severity === 'day_off'
                          ? 'OFF'
                          : '';
                    const outsideHoursLabel = !offLabel && workWindow.severity === 'outside_hours'
                      ? workWindow.label
                      : '';
                    const isOff = Boolean(offLabel);
                    const cellClass = isOff ? OFF_CELL_CLASS : palette.cell;

                    return (
                      <td
                        key={`${therapistId}-${day.dateKey}-${slot.start}`}
                        className={`border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-700 ${cellClass}`}
                      >
                        <div className="flex min-h-[28px] flex-col items-center justify-center gap-0.5">
                          {offLabel && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${dateSessions.length > 0 ? OFF_CHIP_CLASS : 'text-white'}`}>
                              {offLabel}
                            </span>
                          )}
                          {outsideHoursLabel && dateSessions.length > 0 && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                              {outsideHoursLabel}
                            </span>
                          )}
                          {dateSessions.length === 0 && !offLabel && (
                            <span className="text-xs font-semibold text-slate-400">-</span>
                          )}
                          {dateSessions.map((session) => {
                            const isCancelled = session.status === 'cancelled';
                            const chipClass = isCancelled ? OFF_CHIP_CLASS : palette.chip;
                            return (
                              <button
                                type="button"
                                key={session.id || `${day.dateKey}-${session.startTime}`}
                                onClick={() => onSelectSession?.(session)}
                                className={`max-w-full rounded border px-1.5 py-0.5 text-[10px] font-black uppercase leading-tight shadow-sm transition hover:scale-[1.01] ${chipClass}`}
                                title={`${getChildName(session, childrenList)} - ${session.startTime || ''}`}
                              >
                                <span className="line-clamp-2">{getChildName(session, childrenList)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
          <span className="h-2 w-2 rounded-full bg-red-500"></span>
          Off / libur / cuti
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">
          Warna baris membedakan terapis
        </span>
      </div>
    </section>
  );
}

export default TherapistWeeklyScheduleTable;
