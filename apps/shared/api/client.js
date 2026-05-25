/**
 * TheraCare Shared API Client
 * Central HTTP client for all micro-apps to communicate with the backend.
 */
import { emitTheraCareUpdate, shouldBroadcastApiMutation } from '../autoRefresh.js';

const LOCAL_API_BASE = 'http://localhost:3000/api';
const PRODUCTION_API_BASE = 'https://theracare-id-server.vercel.app/api';
const LEGACY_API_HOSTS = new Set(['theracare-api.vercel.app']);

function getDefaultApiBase() {
  if (typeof window === 'undefined') return LOCAL_API_BASE;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.vercel.app') || host.endsWith('.theracare.id') || host === 'theracare.id') {
    return PRODUCTION_API_BASE;
  }
  return LOCAL_API_BASE;
}

function normalizeApiBase(value) {
  const raw = (value || getDefaultApiBase()).trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('localhost') || raw.startsWith('127.0.0.1')) return `http://${raw}`;
  return `https://${raw}`;
}

function resolveApiBase(value) {
  const normalized = normalizeApiBase(value);
  try {
    const parsed = new URL(normalized);
    if (LEGACY_API_HOSTS.has(parsed.hostname.toLowerCase())) {
      return PRODUCTION_API_BASE;
    }
  } catch {}
  return normalized;
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);
const REQUEST_TIMEOUT_MS = 20000;
const AUTH_TOKEN_KEY = 'theracare_session_token';

function readAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function storeAuthToken(token, rememberMe = true) {
  if (!token) return;
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    if (rememberMe) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {}
}

function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {}
}

/**
 * Make an API request with automatic session cookie handling.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/parents')
 * @param {object} [body] - Request body
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function request(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null;
  const headers = { 'Content-Type': 'application/json' };
  const authToken = readAuthToken();
  if (authToken) headers['x-theracare-session-token'] = authToken;

  const options = {
    method,
    headers,
    credentials: 'include', // Send cookies for Better Auth session
    ...(controller ? { signal: controller.signal } : {}),
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (res.ok && shouldBroadcastApiMutation(method, path)) {
      emitTheraCareUpdate({ source: 'api-client', method, path });
    }
    
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`[API] ${method} ${path} failed:`, err);
    const message = err?.name === 'AbortError'
      ? 'Koneksi ke server terlalu lama. Coba refresh atau login ulang.'
      : err.message;
    return { ok: false, status: 0, data: { error: message } };
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }
}

// ── Convenience methods ──────────────────────────────────────────
export const api = {
  get:    (path) => request('GET', path),
  post:   (path, body) => request('POST', path, body),
  patch:  (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

// ── Auth API ─────────────────────────────────────────────────────
export const authApi = {
  /** Login with email + password */
  signIn: async (email, password, rememberMe = true) => {
    const res = await request('POST', '/auth/sign-in/email', { email, password, rememberMe });
    if (res.ok && res.data?.token) storeAuthToken(res.data.token, rememberMe);
    return res;
  },
  
  /** Get current session (check if logged in) */
  getSession: () => request('GET', '/auth/get-session'),
  
  /** Logout */
  signOut: async () => {
    const res = await request('POST', '/auth/sign-out');
    clearAuthToken();
    return res;
  },

  /** Change password for the current signed-in user */
  changePassword: (currentPassword, newPassword, revokeOtherSessions = true) =>
    request('POST', '/auth/change-password', { currentPassword, newPassword, revokeOtherSessions }),
};

// ── Parents API ──────────────────────────────────────────────────
export const parentsApi = {
  getAll: () => api.get('/parents'),
  getById: (id) => api.get(`/parents/${id}`),
  getMe: () => api.get('/parents/me/profile'),
  getLoginIdentity: (identifier) => api.get(`/parents/login-identity/${encodeURIComponent(identifier)}`),
  portalLogin: async (identifier, password, rememberMe = true) => {
    const res = await api.post('/parents/portal-login', { identifier, password });
    if (res.ok && res.data?.data?.token) storeAuthToken(res.data.data.token, rememberMe);
    return res;
  },
  create: (data) => api.post('/parents', data),
  update: (id, data) => api.patch(`/parents/${id}`, data),
  updateStatus: (id, status) => api.patch(`/parents/${id}/status`, { status }),
  resetPassword: (id) => api.post(`/parents/${id}/reset-password`),
  delete: (id) => api.delete(`/parents/${id}`),
};

// ── Children API ─────────────────────────────────────────────────
export const childrenApi = {
  getAll: () => api.get('/children'),
  getById: (id) => api.get(`/children/${id}`),
  getByParent: (parentId) => api.get(`/children/by-parent/${parentId}`),
  create: (data) => api.post('/children', data),
  update: (id, data) => api.patch(`/children/${id}`, data),
  updatePhoto: (id, photoUrl) => api.patch(`/children/${id}/photo`, { photoUrl }),
  delete: (id) => api.delete(`/children/${id}`),
};

// ── Therapists API ───────────────────────────────────────────────
export const therapistsApi = {
  getAll: () => api.get('/therapists'),
  getById: (id) => api.get(`/therapists/${id}`),
  getMe: () => api.get('/therapists/me/profile'),
  getLoginIdentity: (nit) => api.get(`/therapists/login-identity/${encodeURIComponent(nit)}`),
  portalLogin: async (nit, password, rememberMe = true) => {
    const res = await api.post('/therapists/portal-login', { nit, password });
    if (res.ok && res.data?.data?.token) storeAuthToken(res.data.data.token, rememberMe);
    return res;
  },
  create: (data) => api.post('/therapists', data),
  updateProfile: (id, data) => api.patch(`/therapists/${id}`, data),
  updateStatus: (id, status) => api.patch(`/therapists/${id}/status`, { status }),
  resetPassword: (id) => api.post(`/therapists/${id}/reset-password`),
  delete: (id) => api.delete(`/therapists/${id}`),
};

// ── Sessions API ─────────────────────────────────────────────────
export const sessionsApi = {
  getAll: () => api.get('/sessions'),
  getById: (id) => api.get(`/sessions/${id}`),
  getForTherapist: (id, date) => api.get(`/sessions/therapist/${id}${date ? `?date=${date}` : ''}`),
  getUpcomingForChild: (id) => api.get(`/sessions/child/${id}/upcoming`),
  getCompletedForChild: (id) => api.get(`/sessions/child/${id}/completed`),
  create: (data) => api.post('/sessions', data),
  createBulk: (sessions) => api.post('/sessions/bulk', { sessions }),
  updateStatus: (id, status, cancelReason) => api.patch(`/sessions/${id}/status`, { status, cancelReason }),
  saveNotes: (id, notes) => api.patch(`/sessions/${id}/notes`, { notes }),
  getRating: (id) => api.get(`/sessions/${id}/rating`),
  addRating: (id, data) => api.post(`/sessions/${id}/rating`, data),
  update: (id, data) => api.patch(`/sessions/${id}`, data),
  delete: (id) => api.delete(`/sessions/${id}`),
};

// ── Reports API ──────────────────────────────────────────────────
export const therapyPeriodsApi = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.childId) params.set('childId', filters.childId);
    if (filters.status) params.set('status', filters.status);
    const query = params.toString();
    return api.get(`/therapy-periods${query ? `?${query}` : ''}`);
  },
  getDeletionRequests: () => api.get('/therapy-periods/deletion-requests'),
  getById: (id) => api.get(`/therapy-periods/${id}`),
  getForChild: (childId) => api.get(`/therapy-periods/child/${childId}`),
  create: (data) => api.post('/therapy-periods', data),
  requestDeletion: (id, data = {}) => api.post(`/therapy-periods/${id}/deletion-requests`, data),
  respondDeletionRequest: (requestId, data = {}) => api.patch(`/therapy-periods/deletion-requests/${requestId}/respond`, data),
  update: (id, data) => api.patch(`/therapy-periods/${id}`, data),
  generateSessions: (id, data = {}) => api.post(`/therapy-periods/${id}/generate-sessions`, data),
  complete: (id, data = {}) => api.post(`/therapy-periods/${id}/complete`, data),
  renew: (id, data = {}) => api.post(`/therapy-periods/${id}/renew`, data),
};

export const reportsApi = {
  getById: (id) => api.get(`/reports/${id}`),
  getAll: (status) => api.get(`/reports${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getForTherapist: (id, type) => api.get(`/reports/therapist/${id}${type ? `?type=${type}` : ''}`),
  getForChild: (id, type) => api.get(`/reports/child/${id}${type ? `?type=${type}` : ''}`),
  getSessionReport: (sessionId) => api.get(`/reports/session/${sessionId}`),
  save: (data) => api.post('/reports', data),
  update: (id, data) => api.patch(`/reports/${id}`, data),
  updateStatus: (id, status, reviewNote = '') => api.patch(`/reports/${id}/status`, { status, reviewNote }),
  delete: (id) => api.delete(`/reports/${id}`),
};

// ── Reschedule API ───────────────────────────────────────────────
export const syncApi = {
  getVersion: () => api.get('/sync/version'),
};

export const rescheduleApi = {
  getAll: () => api.get('/reschedule'),
  getByParent: (id) => api.get(`/reschedule/parent/${id}`),
  getForTherapist: (id) => api.get(`/reschedule/therapist/${id}`),
  previewSlots: (data) => api.post('/reschedule/preview-slots', data),
  create: (data) => api.post('/reschedule', data),
  updateStatus: (id, status, updates) => api.patch(`/reschedule/${id}`, { status, ...updates }),
  therapistResponse: (id, data) => api.patch(`/reschedule/${id}/therapist-response`, data),
  delete: (id) => api.delete(`/reschedule/${id}`),
};

export const leaveRequestsApi = {
  getAll: () => api.get('/leave-requests'),
  getMine: () => api.get('/leave-requests/therapist/me'),
  create: (data) => api.post('/leave-requests', data),
  updateStatus: (id, status, reviewNote) => api.patch(`/leave-requests/${id}`, { status, reviewNote }),
};

export const substituteRequestsApi = {
  getAll: () => api.get('/substitute-requests'),
  getMine: () => api.get('/substitute-requests/therapist/me'),
  create: (data) => api.post('/substitute-requests', data),
  createSessionUpdate: (data) => api.post('/substitute-requests/session-update', data),
  therapistResponse: (id, data) => api.patch(`/substitute-requests/${id}/therapist-response`, data),
};

export const meetingsApi = {
  getAll: () => api.get('/meetings'),
  getForTherapist: () => api.get('/meetings/therapist/me'),
  getForParent: () => api.get('/meetings/parent/me'),
  create: (data) => api.post('/meetings', data),
  adminReview: (id, data) => api.patch(`/meetings/${id}/admin-review`, data),
  parentResponse: (id, data) => api.patch(`/meetings/${id}/parent-response`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
};

// ── Notifications API ────────────────────────────────────────────
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  create: (data) => api.post('/notifications', data),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const auditLogsApi = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.entityId) params.set('entityId', filters.entityId);
    const query = params.toString();
    return api.get(`/audit-logs${query ? `?${query}` : ''}`);
  },
};

export const uploadsApi = {
  image: (data) => api.post('/uploads/image', data),
};

// ── Admin API (rooms, programs, settings, stats, announcements) ──
export const adminApi = {
  // Stats
  getStats: () => api.get('/admin/stats'),
  // Settings
  getSettings: () => api.get('/admin/settings'),
  getPublicSettings: () => api.get('/admin/public-settings'),
  updateSettings: (data) => api.patch('/admin/settings', data),
  uploadBrandAsset: (data) => api.post('/admin/uploads/branding', data),
  getCenterClosures: () => api.get('/admin/center-closures'),
  getIndonesianHolidays: (year) => api.get(`/admin/center-closures/indonesia-holidays?year=${encodeURIComponent(year)}`),
  applyCenterHolidays: (data) => api.post('/admin/center-closures/apply-holidays', data),
  createCenterClosure: (data) => api.post('/admin/center-closures', data),
  updateCenterClosure: (id, data) => api.patch(`/admin/center-closures/${id}`, data),
  deleteCenterClosure: (id) => api.delete(`/admin/center-closures/${id}`),
  // Rooms
  getRooms: () => api.get('/admin/rooms'),
  createRoom: (data) => api.post('/admin/rooms', data),
  updateRoom: (id, data) => api.patch(`/admin/rooms/${id}`, data),
  deleteRoom: (id) => api.delete(`/admin/rooms/${id}`),
  // Programs
  getPrograms: () => api.get('/admin/programs'),
  createProgram: (data) => api.post('/admin/programs', data),
  updateProgram: (id, data) => api.patch(`/admin/programs/${id}`, data),
  deleteProgram: (id) => api.delete(`/admin/programs/${id}`),
  // Announcements
  getAnnouncements: () => api.get('/admin/announcements'),
  getAnnouncementsForRole: (role) => api.get(`/admin/announcements/role/${role}`),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  updateAnnouncement: (id, data) => api.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
};

export default api;
