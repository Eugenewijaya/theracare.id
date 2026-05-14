export const THERACARE_DATA_UPDATED_EVENT = 'theracareDataUpdated';
export const THERACARE_UPDATE_STORAGE_KEY = 'theracare:data-refresh';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

export function shouldBroadcastApiMutation(method, path = '') {
  const normalizedMethod = String(method || '').toUpperCase();
  if (!MUTATING_METHODS.has(normalizedMethod)) return false;
  if (path.startsWith('/sync')) return false;
  if (path.startsWith('/auth/sign-in') || path.startsWith('/auth/sign-out') || path.startsWith('/auth/get-session')) {
    return false;
  }
  if (path === '/notifications/read-all' || /^\/notifications\/[^/]+\/read$/.test(path)) {
    return false;
  }
  return true;
}

export function getRefreshEventsForPath(path = '') {
  const events = new Set([THERACARE_DATA_UPDATED_EVENT, 'notificationsUpdated']);
  const source = String(path || '');

  if (source.includes('/notifications') || source.includes('/announcements')) {
    events.add('notificationsUpdated');
  }
  if (source.includes('/reports')) {
    events.add('reportUpdated');
  }
  if (source.includes('/children') || source.includes('/parents') || source.includes('/therapy-periods')) {
    events.add('childUpdated');
  }
  if (source.includes('/therapists')) {
    events.add('therapistUpdated');
  }
  if (
    source.includes('/sessions')
    || source.includes('/reschedule')
    || source.includes('/therapy-periods')
    || source.includes('/substitute-requests')
    || source.includes('/center-closures')
  ) {
    events.add('sessionUpdated');
    events.add('scheduleUpdated');
  }
  if (source.includes('/center-closures')) {
    events.add('centerClosuresUpdated');
  }
  if (source.includes('/reschedule')) {
    events.add('rescheduleUpdated');
  }
  if (source.includes('/leave-requests')) {
    events.add('leaveRequestsUpdated');
  }
  if (source.includes('/substitute-requests')) {
    events.add('substituteRequestsUpdated');
  }
  if (source.includes('/meetings')) {
    events.add('meetingsUpdated');
  }
  if (source.includes('/rooms')) {
    events.add('roomsUpdated');
  }
  if (source.includes('/programs') || source.includes('/therapy-periods')) {
    events.add('programsUpdated');
  }
  if (source.includes('/settings') || source.includes('/branding') || source.includes('/uploads')) {
    events.add('clinicSettingsUpdated');
  }

  return [...events];
}

export function emitTheraCareUpdate(detail = {}) {
  if (typeof window === 'undefined') return;
  const payload = {
    source: detail.source || 'unknown',
    method: detail.method || '',
    path: detail.path || '',
    version: detail.version || '',
    timestamp: detail.timestamp || Date.now(),
  };
  const events = getRefreshEventsForPath(payload.path);
  events.forEach((eventName) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  });
  if (payload.source !== 'storage') {
    try {
      localStorage.setItem(THERACARE_UPDATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }
}
