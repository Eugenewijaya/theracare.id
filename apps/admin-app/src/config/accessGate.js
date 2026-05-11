export const ADMIN_GATE_PASSWORD = 'awasdiomelinevid';

export const USER_MANAGEMENT_UNLOCK_KEY = 'admin_user_management_unlocked';
export const LEAVE_REQUESTS_UNLOCK_KEY = 'admin_leave_requests_unlocked';

export function getSessionUnlockState(key) {
  try {
    return sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function markSessionUnlocked(key) {
  try {
    sessionStorage.setItem(key, 'true');
  } catch {}
}
