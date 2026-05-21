import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../../../shared/api/client';
import { isNotificationRead } from '../../../shared/notifications';
import { useClinicSettings } from '../../../shared/clinicSettings';
import ClinicLogoMark from '../../../shared/ui/ClinicLogoMark';

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dasbor', end: true },
  { path: '/progress', icon: 'bar_chart', label: 'Kemajuan Anak' },
  { path: '/profile', icon: 'account_circle', label: 'Profil Anak' },
  { path: '/attendance', icon: 'co_present', label: 'Log Kehadiran' },
  { path: '/reports', icon: 'folder_open', label: 'Daftar Laporan', badgeType: 'reports' },
  { path: '/reschedule', icon: 'swap_horiz', label: 'Penjadwalan Ulang', badgeType: 'reschedule' },
  { path: '/announcements', icon: 'campaign', label: 'Pengumuman', badgeType: 'announcement' },
  { path: '/meetings', icon: 'groups', label: 'Parent Meeting' },
  { path: '/settings', icon: 'settings', label: 'Pengaturan' },
];

function getParentBadgeType(notification) {
  const type = String(notification?.type || '').toLowerCase();
  const icon = String(notification?.icon || '').toLowerCase();

  if (type.startsWith('announcement')) return 'announcement';
  if (type.includes('report') || icon.includes('summarize')) return 'reports';
  if (
    type.includes('reschedule') ||
    type.includes('schedule') ||
    type.includes('session') ||
    type.includes('center_closure') ||
    type.includes('substitute')
  ) {
    return 'reschedule';
  }

  return 'announcement';
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicName, primaryColor, logoUrl } = useClinicSettings();
  const [badgeCounts, setBadgeCounts] = useState({ reports: 0, reschedule: 0, announcement: 0 });
  const [sidebarWidth, setSidebarWidth] = useState(256);

  // Compute notification badges
  useEffect(() => {
    const computeBadges = async () => {
      if (!user?.parentId && !user?.id && !user?.userId) return;
      try {
        const res = await notificationsApi.getAll();
        if (!res.ok) return;

        const nextCounts = { reports: 0, reschedule: 0, announcement: 0 };
        (res.data?.data || [])
          .filter(notification => !isNotificationRead(notification))
          .forEach(notification => {
            nextCounts[getParentBadgeType(notification)] += 1;
          });

        setBadgeCounts(nextCounts);
      } catch(e) {
        console.warn('[ParentSidebar] notifications unavailable', e);
      }
    };
    computeBadges();
    window.addEventListener('notificationsUpdated', computeBadges);
    const interval = window.setInterval(computeBadges, 30000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('notificationsUpdated', computeBadges);
    };
  }, [user]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose?.();
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const startResize = (event) => {
    if (event.pointerType === 'touch') return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent) => {
      const next = Math.min(340, Math.max(240, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const sidebarContent = (
    <aside
      className="relative flex-shrink-0 overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full"
      style={{ width: `${sidebarWidth}px`, minWidth: 240, maxWidth: 340 }}
    >
      <div className="p-4 flex flex-col gap-5 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-w-0 items-center gap-3 px-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <ClinicLogoMark logoUrl={logoUrl} name={clinicName} color={primaryColor} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{clinicName}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Portal Orang Tua</p>
          </div>
          {/* Close btn on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Tutup menu"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <NavLink to="/settings" className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
          <div
            className="size-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm overflow-hidden bg-center bg-cover"
            style={user?.avatar && user.avatar.length > 1 ? { backgroundImage: `url("${user.avatar}")` } : {}}
          >
            {!(user?.avatar && user.avatar.length > 1) && (user?.name || 'P').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name || 'Orang Tua'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 break-words leading-snug">Orang Tua / Wali</p>
          </div>
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[16px] opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </NavLink>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(item => {
            const badgeNum = item.badgeType ? badgeCounts[item.badgeType] : 0;
            return (
              <NavLink key={item.path} to={item.path} end={item.end}
                className={({ isActive }) => `flex min-w-0 items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'}`}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="min-w-0 flex-1 break-words leading-snug">{item.label}</span>
                {badgeNum > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none animate-pulse">
                    {badgeNum > 9 ? '9+' : badgeNum}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <div
        className="absolute right-0 top-0 hidden h-full w-1.5 cursor-ew-resize bg-transparent transition-colors hover:bg-sky-300/60 active:bg-sky-400/80 lg:block"
        onPointerDown={startResize}
        title="Geser untuk menyesuaikan lebar sidebar"
      />

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors w-full">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile overlay + drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative z-10 flex h-full animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
