const PARENT_PREFERENCES_KEY = 'theracare_parent_portal_preferences';

const DEFAULT_PARENT_PREFERENCES = {
  theme: 'light',
};

export const PARENT_PREFERENCES_UPDATED_EVENT = 'parentPreferencesUpdated';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readParentPreferences() {
  if (!canUseStorage()) return { ...DEFAULT_PARENT_PREFERENCES };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PARENT_PREFERENCES_KEY) || '{}');
    return {
      ...DEFAULT_PARENT_PREFERENCES,
      theme: getResolvedParentThemePreference(parsed?.theme),
    };
  } catch {
    return { ...DEFAULT_PARENT_PREFERENCES };
  }
}

export function getResolvedParentThemePreference(preferredTheme) {
  if (preferredTheme === 'dark' || preferredTheme === 'light') return preferredTheme;
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  return 'light';
}

export function applyParentThemePreference(preferredTheme) {
  const resolvedTheme = getResolvedParentThemePreference(preferredTheme);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }
  return resolvedTheme;
}

export function writeParentPreferences(preferences) {
  const next = {
    theme: getResolvedParentThemePreference(preferences.theme),
    updatedAt: new Date().toISOString(),
  };

  if (canUseStorage()) {
    window.localStorage.setItem(PARENT_PREFERENCES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PARENT_PREFERENCES_UPDATED_EVENT, { detail: next }));
  }

  return next;
}
