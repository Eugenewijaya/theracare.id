const ATTENDANCE_CONFIRMED_STATUSES = new Set(['confirmed', 'checked_in', 'present']);
const FINISHED_STATUSES = new Set(['done', 'completed']);

export function getSessionStatus(session) {
  return String(session?.status || session?.raw?.status || '').toLowerCase();
}

export function parseDurationMinutes(value, fallback = 45) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSessionDurationSeconds(session, fallbackMinutes = 45) {
  return parseDurationMinutes(session?.duration || session?.raw?.duration, fallbackMinutes) * 60;
}

export function getSessionStartDate(session) {
  const rawDate = session?.date || session?.raw?.date;
  const date = rawDate ? String(rawDate).split('T')[0] : new Date().toISOString().split('T')[0];
  const time = session?.startTime || session?.start || session?.time || session?.raw?.startTime || '00:00';
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function getSessionEndDate(session) {
  const startedAt = session?.startedAt || session?.raw?.startedAt;
  const start = startedAt ? new Date(startedAt) : getSessionStartDate(session);
  if (!start || Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + getSessionDurationSeconds(session) * 1000);
}

export function isAttendanceConfirmed(session) {
  const status = getSessionStatus(session);
  return ATTENDANCE_CONFIRMED_STATUSES.has(status) || status === 'active' || FINISHED_STATUSES.has(status);
}

export function shouldAutoStartSession(session, now = new Date()) {
  const status = getSessionStatus(session);
  if (!ATTENDANCE_CONFIRMED_STATUSES.has(status)) return false;
  if (session?.startedAt || session?.raw?.startedAt) return false;
  const start = getSessionStartDate(session);
  const end = getSessionEndDate(session);
  if (!start || !end) return false;
  return now >= start && now < end;
}

export function shouldAutoFinishSession(session, now = new Date()) {
  const live = getLiveSessionState(session, now);
  return Boolean(
    live.hasAdminApproval
    && !live.isDone
    && !live.isCancelled
    && live.endAt
    && now >= live.endAt
  );
}

export function getLiveSessionState(session, now = new Date()) {
  const status = getSessionStatus(session);
  const isDone = FINISHED_STATUSES.has(status);
  const isCancelled = status === 'cancelled';
  const isActiveStored = status === 'active';
  const hasAdminApproval = isAttendanceConfirmed(session);
  const startAt = getSessionStartDate(session);
  const endAt = getSessionEndDate(session);
  const startedAtRaw = session?.startedAt || session?.raw?.startedAt;
  const startedAt = startedAtRaw ? new Date(startedAtRaw) : null;
  const activeEndAt = startedAt && !Number.isNaN(startedAt.getTime())
    ? new Date(startedAt.getTime() + getSessionDurationSeconds(session) * 1000)
    : endAt;

  const isInScheduledWindow = Boolean(startAt && endAt && now >= startAt && now < endAt);
  const isAutoRunning = hasAdminApproval && !isDone && !isCancelled && !isActiveStored && isInScheduledWindow;
  const isRunning = !isDone && !isCancelled && (isActiveStored || isAutoRunning);
  const countdownSeconds = hasAdminApproval && startAt && now < startAt
    ? Math.max(0, Math.ceil((startAt.getTime() - now.getTime()) / 1000))
    : 0;
  const remainingSeconds = isRunning && activeEndAt
    ? Math.max(0, Math.ceil((activeEndAt.getTime() - now.getTime()) / 1000))
    : 0;
  const isOvertime = !isDone && !isCancelled && hasAdminApproval && activeEndAt && now >= activeEndAt;

  let state = 'waiting';
  if (isCancelled) state = 'cancelled';
  else if (isDone) state = 'done';
  else if (isOvertime) state = 'overtime';
  else if (isRunning) state = 'running';
  else if (hasAdminApproval && countdownSeconds > 0) state = 'countdown';
  else if (hasAdminApproval) state = 'ready';

  return {
    status,
    state,
    hasAdminApproval,
    isDone,
    isCancelled,
    isActiveStored,
    isAutoRunning,
    isRunning,
    isCountdown: state === 'countdown',
    isOvertime,
    startAt,
    endAt: activeEndAt,
    countdownSeconds,
    remainingSeconds,
  };
}

export function formatSessionClock(seconds = 0) {
  const safe = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
