export const ADMIN_GATE_PASSWORD = 'awasdiomelinevid';

export const ADMIN_SUPER_UNLOCK_KEY = 'admin_super_unlocked';
export const USER_MANAGEMENT_UNLOCK_KEY = 'admin_user_management_unlocked';
export const LEAVE_REQUESTS_UNLOCK_KEY = 'admin_leave_requests_unlocked';

function readUnlock(storage, key) {
  try {
    return storage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeUnlock(storage, key) {
  try {
    storage.setItem(key, 'true');
  } catch {}
}

export function getSessionUnlockState(key) {
  return (
    readUnlock(sessionStorage, key) ||
    readUnlock(localStorage, key) ||
    readUnlock(sessionStorage, ADMIN_SUPER_UNLOCK_KEY) ||
    readUnlock(localStorage, ADMIN_SUPER_UNLOCK_KEY)
  );
}

export function markSessionUnlocked(key) {
  writeUnlock(sessionStorage, key);
  writeUnlock(localStorage, key);
  writeUnlock(sessionStorage, ADMIN_SUPER_UNLOCK_KEY);
  writeUnlock(localStorage, ADMIN_SUPER_UNLOCK_KEY);
}
