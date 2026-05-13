export const ADMIN_GATE_PASSWORD = 'awasdiomelinevid';

export const ADMIN_SUPER_UNLOCK_KEY = 'admin_super_unlocked';
export const USER_MANAGEMENT_UNLOCK_KEY = 'admin_user_management_unlocked';
export const LEAVE_REQUESTS_UNLOCK_KEY = 'admin_leave_requests_unlocked';
export const ADMIN_GATE_TTL_MS = 5 * 60 * 1000;

function getExpiryPayload() {
  const now = Date.now();
  return JSON.stringify({
    unlockedAt: now,
    expiresAt: now + ADMIN_GATE_TTL_MS,
  });
}

function readUnlock(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return false;
    if (raw === 'true') {
      storage.removeItem(key);
      return false;
    }
    const parsed = JSON.parse(raw);
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!expiresAt || expiresAt <= Date.now()) {
      storage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    try { storage.removeItem(key); } catch {}
    return false;
  }
}

function writeUnlock(storage, key) {
  try {
    storage.setItem(key, getExpiryPayload());
  } catch {}
}

function clearUnlock(storage, key) {
  try {
    storage.removeItem(key);
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

export function clearSessionUnlockState(key) {
  clearUnlock(sessionStorage, key);
  clearUnlock(localStorage, key);
  clearUnlock(sessionStorage, ADMIN_SUPER_UNLOCK_KEY);
  clearUnlock(localStorage, ADMIN_SUPER_UNLOCK_KEY);
}

export function markSessionUnlocked(key) {
  writeUnlock(sessionStorage, key);
  writeUnlock(localStorage, key);
  writeUnlock(sessionStorage, ADMIN_SUPER_UNLOCK_KEY);
  writeUnlock(localStorage, ADMIN_SUPER_UNLOCK_KEY);
}
