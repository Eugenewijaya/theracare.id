import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { childrenApi, notificationsApi } from '../api/client';
import {
  getCurrentParentProfile,
  getPrimaryChildId,
  logoutParent,
  PARENT_CHILD_SELECTION_EVENT,
  PARENT_SESSION_EVENT,
  setActiveParentChild,
} from '../api/parentSession';
import PortalProfileMenu from './PortalProfileMenu';

const getChildId = (child = {}) => child?.id || child?.nita || '';

const formatNotifDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ParentPortalHeader({ title = 'Dashboard', icon = 'sentiment_satisfied', className = '' }) {
  const [children, setChildren] = useState([]);
  const [activeChildId, setActiveChildId] = useState('');
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [parentUser, setParentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    const res = await notificationsApi.getAll();
    if (res.ok) {
      setNotifications((res.data?.data || []).slice(0, 8));
    }
  };

  const loadParent = async () => {
    setLoading(true);
    const user = await getCurrentParentProfile();
    setParentUser(user);
    if (!user?.parentId) {
      setChildren([]);
      setActiveChildId('');
      setLoading(false);
      return;
    }

    const childRes = await childrenApi.getByParent(user.parentId);
    if (childRes.ok) {
      const list = childRes.data?.data || [];
      setChildren(list);
      const selectedId = getPrimaryChildId(user) || getChildId(list[0]);
      setActiveChildId(selectedId);
      if (selectedId) {
        const selected = list.find(child => getChildId(child) === selectedId);
        if (selected) setActiveParentChild(selected, { ...user, children: list }, { notify: false });
      }
    }
    await loadNotifications();
    setLoading(false);
  };

  useEffect(() => {
    loadParent();
    const onNotif = () => loadNotifications();
    const onSession = (event) => {
      if (!event.detail) {
        setParentUser(null);
        setChildren([]);
        setActiveChildId('');
      } else {
        loadParent();
      }
    };
    window.addEventListener('notificationsUpdated', onNotif);
    window.addEventListener(PARENT_SESSION_EVENT, onSession);
    const onChild = (event) => {
      if (event.detail?.childId) setActiveChildId(event.detail.childId);
    };
    window.addEventListener(PARENT_CHILD_SELECTION_EVENT, onChild);
    return () => {
      window.removeEventListener('notificationsUpdated', onNotif);
      window.removeEventListener(PARENT_SESSION_EVENT, onSession);
      window.removeEventListener(PARENT_CHILD_SELECTION_EVENT, onChild);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const unreadCount = notifications.filter(item => !item.isRead).length;

  const handleChildChange = (event) => {
    const childId = event.target.value;
    const selected = children.find(child => getChildId(child) === childId);
    setActiveChildId(childId);
    if (selected) {
      setActiveParentChild(selected, { ...parentUser, children });
    } else {
      window.dispatchEvent(new CustomEvent(PARENT_CHILD_SELECTION_EVENT, { detail: { childId } }));
    }
  };

  const markRead = async (notification) => {
    if (!notification?.id || notification.isRead) return;
    const res = await notificationsApi.markRead(notification.id);
    if (!res.ok) return;
    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, isRead: true } : item));
    window.dispatchEvent(new Event('notificationsUpdated'));
  };

  const markAllRead = async () => {
    const res = await notificationsApi.markAllRead();
    if (!res.ok) return;
    setNotifications(prev => prev.map(item => ({ ...item, isRead: true })));
    window.dispatchEvent(new Event('notificationsUpdated'));
  };

  const handleLogout = async () => {
    await logoutParent();
    navigate('/login');
  };

  return (
    <header className={`flex flex-col sm:flex-row items-center justify-between border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 py-4 flex-shrink-0 gap-4 mb-4 ${className}`}>
      <div className="flex items-center gap-3 text-primary">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
        {children.length > 0 && (
          <div className="relative min-w-[180px] shrink-0 flex-1 sm:flex-none">
            <select
              value={activeChildId}
              onChange={handleChildChange}
              className="appearance-none w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-slate-700 dark:text-slate-200 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
            >
              {children.map(child => (
                <option key={getChildId(child)} value={getChildId(child)}>{child.name}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[20px] pointer-events-none">child_care</span>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto sm:ml-0 shrink-0">
          <div className="relative" ref={notifRef}>
            <button
              id="parent-header-bell"
              type="button"
              onClick={() => setShowNotif(prev => !prev)}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all"
              title="Notifikasi"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-80 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[200]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Notifikasi</h3>
                    {unreadCount > 0 && (
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-sky-500 hover:text-sky-600 transition-colors">
                      Tandai semua dibaca
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Memuat notifikasi...</div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">notifications_off</span>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Belum ada notifikasi</p>
                    </div>
                  ) : notifications.map(notification => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={async () => {
                        await markRead(notification);
                        setShowNotif(false);
                        navigate('/announcements');
                      }}
                      className={`flex w-full gap-3 px-4 py-3 text-left border-b border-slate-50 dark:border-slate-700/50 last:border-b-0 cursor-pointer transition-colors ${notification.isRead ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40' : 'bg-sky-50/60 dark:bg-sky-900/10 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.isRead ? 'bg-slate-200 dark:bg-slate-600' : 'bg-sky-500'}`} />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-xs leading-snug truncate ${notification.isRead ? 'font-medium text-slate-600 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                          {notification.title || notification.subject || 'Notifikasi Baru'}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5 truncate">
                          {notification.message || notification.content || ''}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {formatNotifDate(notification.createdAt || notification.date)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setShowNotif(false); navigate('/announcements'); }}
                    className="w-full py-2 text-xs font-bold text-center text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    Lihat Semua Pengumuman
                  </button>
                </div>
              </div>
            )}
          </div>

          <PortalProfileMenu
            user={parentUser}
            role="parent"
            childrenCount={children.length}
            onLogout={handleLogout}
            onNavigateProfile={() => navigate('/profile')}
            onNavigateAnnouncements={() => navigate('/announcements')}
            onNavigateSettings={() => navigate('/settings')}
          />
        </div>
      </div>
    </header>
  );
}
