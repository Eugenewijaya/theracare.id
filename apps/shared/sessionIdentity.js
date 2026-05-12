const LEGACY_KEYS = {
  parent: 'parent_user',
  therapist: 'therapist_user',
  admin: 'admin_user',
};

function modernKey(role) {
  return `theracare_auth_${role || 'user'}`;
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readStorage(key) {
  try {
    return safeJson(localStorage.getItem(key)) || safeJson(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

export function readPortalUser(role) {
  const legacy = LEGACY_KEYS[role];
  return (legacy ? readStorage(legacy) : null) || readStorage(modernKey(role));
}

export function storePortalUser(role, user, remember = true) {
  if (!user) return;
  const payload = JSON.stringify(user);
  const keys = [LEGACY_KEYS[role], modernKey(role)].filter(Boolean);
  try {
    keys.forEach((key) => sessionStorage.setItem(key, payload));
    if (remember) {
      keys.forEach((key) => localStorage.setItem(key, payload));
    } else {
      keys.forEach((key) => localStorage.removeItem(key));
    }
  } catch {}
}

export function updatePortalUser(role, updater, remember = true) {
  const current = readPortalUser(role);
  const next = typeof updater === 'function' ? updater(current || {}) : updater;
  if (next) storePortalUser(role, next, remember);
  return next;
}

export function clearPortalUser(role) {
  const keys = [LEGACY_KEYS[role], modernKey(role)].filter(Boolean);
  try {
    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch {}
}

export const readParentUser = () => readPortalUser('parent');
export const readTherapistUser = () => readPortalUser('therapist');
export const storeParentUser = (user, remember) => storePortalUser('parent', user, remember);
export const storeTherapistUser = (user, remember) => storePortalUser('therapist', user, remember);
export const clearParentUser = () => clearPortalUser('parent');
export const clearTherapistUser = () => clearPortalUser('therapist');
