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
