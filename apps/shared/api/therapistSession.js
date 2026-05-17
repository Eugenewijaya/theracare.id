import { authApi, therapistsApi } from './client.js';

export const THERAPIST_SESSION_EVENT = 'therapistSessionUpdated';

export function normalizeTherapistProfile(therapist = {}) {
  if (!therapist) return null;
  return {
    ...therapist,
    id: therapist.id,
    nit: therapist.nit || therapist.id,
    userId: therapist.userId,
    name: therapist.name || therapist.user?.name || 'Therapist',
    role: 'therapist',
    specialty: therapist.specialty || therapist.specialization || 'Clinical Team',
    bio: therapist.bio || '',
    avatar: therapist.avatar || therapist.user?.image || '',
    email: therapist.email || therapist.user?.email || '',
    phone: therapist.phone || therapist.user?.phone || '',
    educationLevel: therapist.educationLevel || '',
    educationField: therapist.educationField || '',
    educationInstitution: therapist.educationInstitution || '',
    graduationYear: therapist.graduationYear || '',
    strNumber: therapist.strNumber || '',
    strExpiry: therapist.strExpiry || '',
    yearsExperience: therapist.yearsExperience || '',
    languages: therapist.languages || '',
    certifications: Array.isArray(therapist.certifications) ? therapist.certifications : [],
    schedule: therapist.schedule || {},
    primaryRoom: therapist.primaryRoom || '',
    maxClients: therapist.maxClients ?? null,
  };
}

export async function getCurrentTherapistProfile() {
  const res = await therapistsApi.getMe();
  if (!res.ok || !res.data?.data) return null;
  return normalizeTherapistProfile(res.data.data);
}

export function publishTherapistSession(user) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(THERAPIST_SESSION_EVENT, { detail: user || null }));
}

export async function logoutTherapist() {
  try {
    await authApi.signOut();
  } catch {}
  publishTherapistSession(null);
}
