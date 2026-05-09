/**
 * TheraCare Shared API Client
 * Central HTTP client for all micro-apps to communicate with the backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Make an API request with automatic session cookie handling.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/parents')
 * @param {object} [body] - Request body
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function request(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Send cookies for Better Auth session
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`[API] ${method} ${path} failed:`, err);
    return { ok: false, status: 0, data: { error: err.message } };
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
  signIn: (email, password, rememberMe = true) => request('POST', '/auth/sign-in/email', { email, password, rememberMe }),
  
  /** Get current session (check if logged in) */
  getSession: () => request('GET', '/auth/get-session'),
  
  /** Logout */
  signOut: () => request('POST', '/auth/sign-out'),

  /** Change password for the current signed-in user */
  changePassword: (currentPassword, newPassword, revokeOtherSessions = true) =>
    request('POST', '/auth/change-password', { currentPassword, newPassword, revokeOtherSessions }),
};

// ── Parents API ──────────────────────────────────────────────────
export const parentsApi = {
  getAll: () => api.get('/parents'),
  getById: (id) => api.get(`/parents/${id}`),
  getMe: () => api.get('/parents/me/profile'),
  getLoginIdentity: (phone) => api.get(`/parents/login-identity/${encodeURIComponent(phone)}`),
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
export const reportsApi = {
  getById: (id) => api.get(`/reports/${id}`),
  getForTherapist: (id, type) => api.get(`/reports/therapist/${id}${type ? `?type=${type}` : ''}`),
  getForChild: (id, type) => api.get(`/reports/child/${id}${type ? `?type=${type}` : ''}`),
  getSessionReport: (sessionId) => api.get(`/reports/session/${sessionId}`),
  save: (data) => api.post('/reports', data),
  update: (id, data) => api.patch(`/reports/${id}`, data),
  updateStatus: (id, status) => api.patch(`/reports/${id}/status`, { status }),
  delete: (id) => api.delete(`/reports/${id}`),
};

// ── Reschedule API ───────────────────────────────────────────────
export const rescheduleApi = {
  getAll: () => api.get('/reschedule'),
  getByParent: (id) => api.get(`/reschedule/parent/${id}`),
  getForTherapist: (id) => api.get(`/reschedule/therapist/${id}`),
  create: (data) => api.post('/reschedule', data),
  updateStatus: (id, status, updates) => api.patch(`/reschedule/${id}`, { status, ...updates }),
  delete: (id) => api.delete(`/reschedule/${id}`),
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
