import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api/client.js';
import { applyPlatformFavicon } from './platformBrand.js';

export const CLINIC_SETTINGS_EVENT = 'clinicSettingsUpdated';
export const CLINIC_SETTINGS_KEY = 'clinicSettings';
export const LEGACY_ADMIN_SETTINGS_KEY = 'adminSettings';
export const CLINIC_PORTAL_TITLE_KEY = 'theracarePortalTitle';

export const DEFAULT_CLINIC_SETTINGS = {
  clinicName: 'Special Needs Center',
  centerSubtitle: 'Pusat Terapi Anak dan Keluarga',
  centerAddress: 'Jl. Sudirman No. 1, Jakarta Selatan, DKI Jakarta',
  centerPhone: '6281234567890',
  adminWhatsApp: '6281234567890',
  centerEmail: 'admin@specialneedscenter.id',
  centerWebsite: 'specialneedscenter.id',
  operatingHoursWeekday: '08:00 - 17:00',
  operatingHoursWeekend: 'Tutup',
  primaryColor: '#137fec',
  secondaryColor: '#4e7f97',
  logoUrl: '',
  faviconUrl: '',
  centerPhotoUrl: '',
  notificationPreferences: {
    registration_new: { email: false, inApp: true },
    session_reminder: { email: false, inApp: true },
    reschedule_request: { email: false, inApp: true },
    report_uploaded: { email: false, inApp: true },
    center_closure: { email: false, inApp: true },
  },
  notificationChannels: {
    inApp: {
      live: true,
      label: 'In-App',
      status: 'Aktif',
      description: 'Notifikasi portal aktif dan tersinkron untuk admin, terapis, dan orang tua.',
    },
    email: {
      live: false,
      label: 'Email',
      status: 'Dalam Pengembangan',
      description: 'Email belum aktif sampai domain pengirim dan konfigurasi pengiriman siap.',
    },
    sms: {
      live: false,
      label: 'SMS / WhatsApp',
      status: 'Tidak Digunakan',
      description: 'SMS dan WhatsApp otomatis belum menjadi kanal pengiriman sistem.',
    },
  },
};

const PUBLIC_KEYS = Object.keys(DEFAULT_CLINIC_SETTINGS);
const READ_ONLY_SETTINGS_KEYS = new Set(['notificationChannels']);

function hasClinicSettingsPayload(value) {
  if (!value || typeof value !== 'object') return false;
  return PUBLIC_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function parseMaybeJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeNotificationPreferences(value) {
  const input = parseMaybeJson(value);
  const defaults = DEFAULT_CLINIC_SETTINGS.notificationPreferences;
  return Object.fromEntries(Object.entries(defaults).map(([key, channels]) => {
    const row = input?.[key] || {};
    return [
      key,
      {
        email: typeof row.email === 'boolean' ? row.email : channels.email,
        inApp: typeof row.inApp === 'boolean' ? row.inApp : channels.inApp,
      },
    ];
  }));
}

function normalizeNotificationChannels(value) {
  const input = parseMaybeJson(value);
  const defaults = DEFAULT_CLINIC_SETTINGS.notificationChannels;
  return Object.fromEntries(Object.entries(defaults).map(([key, defaultsForChannel]) => {
    const row = input?.[key] || {};
    return [
      key,
      {
        ...defaultsForChannel,
        ...(row && typeof row === 'object' && !Array.isArray(row) ? row : {}),
        live: typeof row?.live === 'boolean' ? row.live : defaultsForChannel.live,
      },
    ];
  }));
}

export function sanitizeNotificationPreferencesForChannels(preferences, channels) {
  const normalized = normalizeNotificationPreferences(preferences);
  const normalizedChannels = normalizeNotificationChannels(channels);
  return Object.fromEntries(Object.entries(normalized).map(([key, value]) => [
    key,
    {
      ...value,
      email: normalizedChannels.email.live ? value.email : false,
      inApp: normalizedChannels.inApp.live ? value.inApp : false,
    },
  ]));
}

export function normalizeClinicSettings(raw = {}) {
  const settings = { ...DEFAULT_CLINIC_SETTINGS };
  for (const key of PUBLIC_KEYS) {
    if (key === 'notificationPreferences') {
      settings.notificationPreferences = normalizeNotificationPreferences(raw[key]);
      continue;
    }
    if (key === 'notificationChannels') {
      settings.notificationChannels = normalizeNotificationChannels(raw[key]);
      continue;
    }
    if (typeof raw[key] === 'string' && raw[key].trim()) {
      settings[key] = raw[key].trim();
    }
  }
  if (raw.brandColor && !raw.primaryColor) {
    settings.primaryColor = raw.brandColor;
  }
  if (raw.centerName && !raw.clinicName) {
    settings.clinicName = String(raw.centerName).trim();
  }
  if (raw.phone && !raw.centerPhone) {
    settings.centerPhone = String(raw.phone).trim();
  }
  if (raw.email && !raw.centerEmail) {
    settings.centerEmail = String(raw.email).trim();
  }
  if (raw.address && !raw.centerAddress) {
    settings.centerAddress = String(raw.address).trim();
  }
  if (raw.website && !raw.centerWebsite) {
    settings.centerWebsite = String(raw.website).trim();
  }
  return settings;
}

export function getCachedClinicSettings() {
  const current = readJson(CLINIC_SETTINGS_KEY);
  const legacy = readJson(LEGACY_ADMIN_SETTINGS_KEY);
  return normalizeClinicSettings({ ...legacy, ...current });
}

export function cacheClinicSettings(settings) {
  const normalized = normalizeClinicSettings(settings);
  localStorage.setItem(CLINIC_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CLINIC_SETTINGS_EVENT, { detail: normalized }));
  return normalized;
}

export function setClinicPortalTitle(title = '') {
  if (typeof document === 'undefined') return;
  const clean = String(title || '').trim();
  document.documentElement.dataset.portalTitle = clean;
  try {
    if (clean) sessionStorage.setItem(CLINIC_PORTAL_TITLE_KEY, clean);
    else sessionStorage.removeItem(CLINIC_PORTAL_TITLE_KEY);
  } catch {}
  applyClinicTheme(getCachedClinicSettings());
}

function getClinicPortalTitle() {
  if (typeof document === 'undefined') return '';
  const fromDataset = document.documentElement.dataset.portalTitle || '';
  if (fromDataset) return fromDataset;
  try {
    return sessionStorage.getItem(CLINIC_PORTAL_TITLE_KEY) || '';
  } catch {
    return '';
  }
}

export async function fetchClinicSettings() {
  const cached = getCachedClinicSettings();
  try {
    const res = await adminApi.getPublicSettings();
    if (res.ok && res.data?.data) {
      return cacheClinicSettings({ ...cached, ...res.data.data });
    }
  } catch {}
  return cached;
}

export async function saveClinicSettings(updates) {
  const next = normalizeClinicSettings({ ...getCachedClinicSettings(), ...updates });
  next.notificationPreferences = sanitizeNotificationPreferencesForChannels(next.notificationPreferences, next.notificationChannels);
  const apiPayload = Object.fromEntries(Object.entries(next)
    .filter(([key]) => !READ_ONLY_SETTINGS_KEYS.has(key))
    .map(([key, value]) => [
      key,
      value && typeof value === 'object' ? JSON.stringify(value) : value,
    ]));
  const res = await adminApi.updateSettings(apiPayload);
  if (!res.ok) {
    throw new Error(res.data?.error || res.data?.message || 'Gagal menyimpan pengaturan pusat terapi');
  }
  return cacheClinicSettings(next);
}

export function applyClinicTheme(settings) {
  if (typeof document === 'undefined') return;
  const normalized = normalizeClinicSettings(settings);
  document.documentElement.style.setProperty('--clinic-primary', normalized.primaryColor);
  document.documentElement.style.setProperty('--clinic-secondary', normalized.secondaryColor);
  const portalTitle = getClinicPortalTitle();
  document.title = portalTitle ? `${normalized.clinicName} - ${portalTitle}` : normalized.clinicName;
  applyPlatformFavicon(normalized.faviconUrl || normalized.logoUrl);
}

export function useClinicSettings() {
  const [settings, setSettings] = useState(() => getCachedClinicSettings());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchClinicSettings();
    setSettings(next);
    applyClinicTheme(next);
    setLoading(false);
    return next;
  }, []);

  const save = useCallback(async (updates) => {
    const next = await saveClinicSettings(updates);
    setSettings(next);
    applyClinicTheme(next);
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchClinicSettings().then((next) => {
      if (!mounted) return;
      setSettings(next);
      applyClinicTheme(next);
      setLoading(false);
    });

    const onSettings = (event = {}) => {
      const hasSettingsPayload = hasClinicSettingsPayload(event.detail);
      if (!hasSettingsPayload) {
        refresh();
        return;
      }
      const next = normalizeClinicSettings(event.detail);
      setSettings(next);
      applyClinicTheme(next);
    };
    const onStorage = (event) => {
      if ([CLINIC_SETTINGS_KEY, LEGACY_ADMIN_SETTINGS_KEY].includes(event.key)) {
        onSettings({});
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener(CLINIC_SETTINGS_EVENT, onSettings);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted = false;
      window.removeEventListener(CLINIC_SETTINGS_EVENT, onSettings);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return {
    ...settings,
    brandColor: settings.primaryColor,
    settings,
    loading,
    refresh,
    save,
  };
}
