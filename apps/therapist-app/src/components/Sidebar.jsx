import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../../../shared/api/client';
import { useClinicSettings } from '../../../shared/clinicSettings';
import ClinicLogoMark from '../../../shared/ui/ClinicLogoMark';

const navItems = [
  { path: '/', icon: 'space_dashboard', label: 'Dasbor', end: true },
  { path: '/schedule', icon: 'calendar_today', label: 'Jadwal Terapi' },
  { path: '/schedule-updates', icon: 'event_repeat', label: 'Pembaruan Jadwal', badgeType: 'schedule' },
  { path: '/leave-requests', icon: 'event_busy', label: 'Pengajuan Cuti' },
  { path: '/availability', icon: 'date_range', label: 'Ketersediaan' },
  { path: '/reports', icon: 'description', label: 'Laporan Anak' },
  { path: '/performance', icon: 'insights', label: 'Kinerja' },
  { path: '/meetings', icon: 'groups', label: 'Pertemuan Orang Tua' },
  { path: '/child-progress', icon: 'trending_up', label: 'Kemajuan Anak' },
  { path: '/announcements', icon: 'notifications', label: 'Notifikasi', badgeType: 'notification' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicName, primaryColor, logoUrl } = useClinicSettings();
  const [badgeCounts, setBadgeCounts] = useState({ schedule: 0, notification: 0 });
  const [totalUnread, setTotalUnread] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  // Compute notification badges
  useEffect(() => {
    const computeBadges = async () => {
      if (!user?.id) return;
      try {
        const res = await notificationsApi.getAll();
        const allNotifs = res.data?.data || [];
        const unread = allNotifs.filter(n => !n.isRead && !(n.readBy || []).includes(user.id));
        setTotalUnread(unread.length);
        
        const scheduleCount = unread.filter(n => ['schedule_change', 'schedule_change_confirmation', 'program_change_confirmation', 'new_session', 'program_enrollment', 'substitute_confirmation', 'substitute_result'].includes(n.type)).length;
        const notifCount = unread.length - scheduleCount;
        setBadgeCounts({ schedule: scheduleCount, notification: notifCount });
      } catch (err) {
      console.error('Failed to load notifications', err);
      }
    };
    computeBadges();
    window.addEventListener('notificationsUpdated', computeBadges);
    const interval = window.setInterval(computeBadges, 30000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('notificationsUpdated', computeBadges);
    };
  }, [user, location.pathname]);

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
      const next = Math.min(360, Math.max(260, startWidth + moveEvent.clientX - startX));
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
      className="relative flex-shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col h-full font-sans transition-colors duration-300"
      style={{ width: `${sidebarWidth}px`, minWidth: 260, maxWidth: 360 }}
    >
      <div className="p-5 flex flex-col gap-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Brand Header */}
        <div className="flex min-w-0 items-center gap-3.5 pb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="relative group">
            <div className="absolute inset-0 rounded-xl blur opacity-40 group-hover:opacity-70 transition-opacity" style={{ backgroundColor: primaryColor }}></div>
            <ClinicLogoMark logoUrl={logoUrl} name={clinicName} color={primaryColor} icon="psychology" className="relative h-10 w-10 ring-1 ring-white/20" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight truncate">{clinicName}</h1>
            <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Therapist</p>
          </div>
          {/* Close btn on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* User Profile Hook */}
        <NavLink to="/performance" className="flex min-w-0 items-center gap-3.5 bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
          <div className="size-10 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-lg ring-2 ring-white dark:ring-slate-900 shadow-sm relative overflow-hidden">
            {user?.avatar ? <img src={user.avatar} alt={user?.name || 'Therapist'} className="w-full h-full object-cover" /> : user?.name?.charAt(0) || 'T'}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white dark:ring-slate-950"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name || 'Therapist'}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{user?.specialty || 'Clinical Team'}</p>
          </div>
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black min-w-[20px] h-[20px] px-1.5 rounded-full flex items-center justify-center leading-none animate-pulse">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </NavLink>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 mt-2">
          {navItems.map(item => {
            const badgeNum = item.badgeType ? badgeCounts[item.badgeType] : 0;
            return (
              <NavLink key={item.path} to={item.path} end={item.end}
                className={({ isActive }) => `group relative flex min-w-0 items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 shadow-sm border border-teal-100/50 dark:border-teal-800/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}`}>
                {({ isActive }) => (
                  <>
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-500 dark:bg-teal-400 rounded-r-md"></div>}
                    <span className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} style={isActive ? {fontVariationSettings: "'FILL' 1"} : {}}>{item.icon}</span>
                    <span className="min-w-0 flex-1 break-words leading-snug">{item.label}</span>
                    {badgeNum > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none animate-pulse">
                        {badgeNum > 9 ? '9+' : badgeNum}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <div
        className="absolute right-0 top-0 hidden h-full w-1.5 cursor-ew-resize bg-transparent transition-colors hover:bg-teal-300/60 active:bg-teal-400/80 lg:block"
        onPointerDown={startResize}
        title="Geser untuk menyesuaikan lebar sidebar"
      />

      {/* Footer / Logout */}
      <div className="p-5 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50">
        <button onClick={handleLogout} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30 w-full group">
          <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">logout</span>
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
