import { authApi, parentsApi } from './client.js';

export const PARENT_SESSION_EVENT = 'parentSessionUpdated';
export const PARENT_CHILD_SELECTION_EVENT = 'parentChildSelectionChanged';

let activeParentChildId = '';
let activeParentChildName = '';

function getChildId(child = {}) {
  return child?.id || child?.nita || (typeof child === 'string' ? child : '');
}

function getChildName(child = {}) {
  return child?.name || child?.fullName || (typeof child === 'string' ? child : '');
}

export function normalizeParentProfile(parent = {}) {
  if (!parent) return null;
  const children = Array.isArray(parent.children) ? parent.children : [];
  const preferredChild =
    children.find(child => getChildId(child) === parent.childId || getChildId(child) === activeParentChildId) ||
    children[0] ||
    null;

  return {
    ...parent,
    id: parent.id,
    parentId: parent.parentId || parent.id,
    userId: parent.userId,
    name: parent.name || parent.user?.name || 'Parent',
    role: 'parent',
    avatar: parent.avatar || parent.user?.image || parent.image || '',
    phone: parent.phone || parent.user?.phone || '',
    email: parent.email || parent.user?.email || '',
    status: parent.status || parent.user?.status || 'active',
    children,
    childId: activeParentChildId || parent.childId || getChildId(preferredChild),
    childName: activeParentChildName || parent.childName || getChildName(preferredChild),
  };
}

export async function getCurrentParentProfile() {
  const res = await parentsApi.getMe();
  if (!res.ok || !res.data?.data) return null;
  return normalizeParentProfile(res.data.data);
}

export function getPrimaryChildId(parent = {}) {
  if (activeParentChildId) return activeParentChildId;
  if (parent?.childId) return parent.childId;
  const firstChild = Array.isArray(parent?.children) ? parent.children[0] : null;
  return getChildId(firstChild);
}

export function getPrimaryChildName(parent = {}) {
  if (activeParentChildName) return activeParentChildName;
  if (parent?.childName) return parent.childName;
  const firstChild = Array.isArray(parent?.children) ? parent.children[0] : null;
  return getChildName(firstChild);
}

export function setActiveParentChild(child, parent = null, options = {}) {
  const selected = typeof child === 'string'
    ? (parent?.children || []).find(item => getChildId(item) === child) || { id: child }
    : child;
  activeParentChildId = getChildId(selected);
  activeParentChildName = getChildName(selected);
  const detail = {
    childId: activeParentChildId,
    childName: activeParentChildName,
    child: selected || null,
  };
  if (options.notify !== false && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PARENT_CHILD_SELECTION_EVENT, { detail }));
  }
  return detail;
}

export function publishParentSession(parent) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PARENT_SESSION_EVENT, { detail: parent || null }));
}

export async function logoutParent() {
  try {
    await authApi.signOut();
  } catch {}
  activeParentChildId = '';
  activeParentChildName = '';
  publishParentSession(null);
}
