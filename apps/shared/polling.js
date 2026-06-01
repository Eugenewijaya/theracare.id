export const SYNC_POLL_INTERVAL_MS = 60000;
export const BADGE_POLL_INTERVAL_MS = 120000;
export const NOTIFICATION_POLL_INTERVAL_MS = 120000;

export function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function shouldPollNow({ force = false } = {}) {
  return force || isDocumentVisible();
}
