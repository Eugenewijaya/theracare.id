export function getNotificationTimestamp(notification) {
  const raw = notification?.createdAt || notification?.date || notification?.time || '';
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getNotificationTitle(notification) {
  return notification?.title || notification?.subject || 'Notifikasi baru';
}

export function getNotificationMessage(notification) {
  return notification?.message || notification?.content || notification?.desc || '';
}

export function getNotificationIcon(notification) {
  return notification?.icon || 'notifications';
}

export function isNotificationRead(notification) {
  return Boolean(notification?.isRead || notification?.read || notification?.unread === false);
}

export function formatNotificationTime(notification) {
  return getNotificationTimestamp(notification).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sortNotifications(notifications = []) {
  return [...notifications].sort((a, b) => getNotificationTimestamp(b) - getNotificationTimestamp(a));
}

export function getNotificationActor(notification) {
  const role = String(notification?.actorRole || notification?.createdByRole || notification?.senderRole || '').toLowerCase();
  const name = notification?.actorName || notification?.createdByName || notification?.senderName || '';
  if (role === 'admin') return { role, label: name ? `Admin: ${name}` : 'Admin' };
  if (role === 'therapist') return { role, label: name ? `Terapis: ${name}` : 'Terapis' };
  if (role === 'parent') return { role, label: name ? `Orang Tua: ${name}` : 'Orang Tua' };
  if (role === 'system') return { role, label: 'Sistem' };
  return { role: 'system', label: 'Sistem' };
}

export function getNotificationDestination(notification, role = 'user') {
  const type = String(notification?.type || '').toLowerCase();
  const icon = String(notification?.icon || '').toLowerCase();
  const userRole = String(role || '').toLowerCase();

  if (type.includes('account') || type.includes('security') || type.includes('developer') || type.includes('system')) {
    if (userRole === 'admin') return '/notifications';
    return '/announcements?tab=system';
  }

  if (type.startsWith('announcement')) {
    if (userRole === 'admin') return '/notifications';
    return '/announcements';
  }

  if (type.startsWith('report_') || type.includes('report') || icon.includes('summarize')) {
    return userRole === 'parent' ? '/reports' : '/reports';
  }

  if (type.includes('leave') || type.includes('cuti')) {
    return userRole === 'admin' ? '/therapist-leave-requests' : '/leave-requests';
  }

  if (type.includes('meeting')) {
    if (userRole === 'admin') return '/parent-meetings';
    return '/meetings';
  }

  if (type.includes('reschedule')) {
    if (userRole === 'parent') return '/reschedule';
    if (userRole === 'therapist') return '/schedule-updates';
    return '/requests';
  }

  if (type.startsWith('session_')) {
    if (userRole === 'parent') return '/';
    if (userRole === 'therapist') return '/schedule';
    return '/attendance';
  }

  if (type.includes('substitute') || type.includes('schedule') || type.includes('session') || type.includes('center_closure')) {
    if (userRole === 'parent') return '/reschedule';
    if (userRole === 'therapist') return '/schedule-updates';
    return '/scheduling';
  }

  if (type.includes('program')) {
    if (userRole === 'admin') return '/programs';
    return '/announcements';
  }

  if (type.includes('child') || type.includes('registration')) {
    return userRole === 'admin' ? '/children' : '/announcements';
  }

  return userRole === 'admin' ? '/notifications' : '/announcements';
}
