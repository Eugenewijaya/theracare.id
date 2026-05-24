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
};

const PUBLIC_KEYS = Object.keys(DEFAULT_CLINIC_SETTINGS);

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

export function normalizeClinicSettings(raw = {}) {
  const settings = { ...DEFAULT_CLINIC_SETTINGS };
  for (const key of PUBLIC_KEYS) {
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
  const res = await adminApi.updateSettings(next);
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
