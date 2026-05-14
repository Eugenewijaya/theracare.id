import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { meetingsApi, rescheduleApi, notificationsApi, leaveRequestsApi } from '../../../shared/api/client';
import ClinicLogoMark from '../../../shared/ui/ClinicLogoMark';

const navGroups = [
  {
    label: 'Gambaran Umum',
    items: [
      { path: '/', icon: 'dashboard', label: 'Dasbor', end: true },
      { path: '/scheduling', icon: 'calendar_month', label: 'Penjadwalan Tunggal' },
      { path: '/requests', icon: 'assignment', label: 'Permintaan Masuk', badgeKey: 'requests' },
      { path: '/parent-meetings', icon: 'groups', label: 'Parent Meeting' },
      { path: '/therapist-leave-requests', icon: 'event_busy', label: 'Cuti Terapis', badgeKey: 'leaveRequests' },
    ],
  },
  {
    label: 'Manajemen Klinik',
    items: [
      { path: '/children', icon: 'child_care', label: 'Data Anak' },
      { path: '/children/program-registration', icon: 'playlist_add', label: 'Pendaftaran Program' },
      { path: '/therapists', icon: 'group', label: 'Data Terapis' },
      { path: '/rooms', icon: 'meeting_room', label: 'Manajemen Ruangan' },
      { path: '/programs', icon: 'menu_book', label: 'Program Layanan' },
    ],
  },
  {
    label: 'Analitik & Laporan',
    items: [
      { path: '/attendance', icon: 'fact_check', label: 'Kehadiran Anak' },
      { path: '/monitoring', icon: 'monitoring', label: 'Pantau Perkembangan' },
      { path: '/reports', icon: 'analytics', label: 'Laporan Klinik' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { path: '/notifications', icon: 'campaign', label: 'Pengumuman & Notifikasi', badgeKey: 'notifications' },
      { path: '/users', icon: 'manage_accounts', label: 'Manajemen Pengguna' },
      { path: '/settings/branding', icon: 'palette', label: 'Pengaturan & Tampilan' },
    ],
  },
];


export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicName, brandColor, logoUrl, adminProfile, sidebarCollapsed, setSidebarCollapsed } = useAdmin();
  const [badgeCounts, setBadgeCounts] = useState({ requests: 0, notifications: 0, leaveRequests: 0 });

  // Compute notification badges from API
  useEffect(() => {
    const computeBadges = async () => {
      try {
        const [reqResult, meetingResult, unreadResult, leaveResult] = await Promise.allSettled([
          rescheduleApi.getAll(),
          meetingsApi.getAll(),
          notificationsApi.getUnreadCount(),
          leaveRequestsApi.getAll(),
        ]);
        const reqRes = reqResult.status === 'fulfilled' ? reqResult.value : { data: { data: [] } };
        const meetingRes = meetingResult.status === 'fulfilled' ? meetingResult.value : { data: { data: [] } };
        const unreadRes = unreadResult.status === 'fulfilled' ? unreadResult.value : { data: { data: { count: 0 } } };
        const leaveRes = leaveResult.status === 'fulfilled' ? leaveResult.value : { data: { data: [] } };
        const pendingReschedules = (reqRes.data?.data || []).filter(r => r.status === 'pending').length;
        const pendingMeetings = (meetingRes.data?.data || []).filter(r => r.status === 'pending_admin_review').length;
        const pendingCount = pendingReschedules + pendingMeetings;
        const unreadNotifs = unreadRes.data?.data?.count || 0;
        const pendingLeave = (leaveRes.data?.data || []).filter(r => r.status === 'pending').length;
        setBadgeCounts({ requests: pendingCount, notifications: unreadNotifs, leaveRequests: pendingLeave });
      } catch {}
    };
    computeBadges();
    window.addEventListener('notificationsUpdated', computeBadges);
    const interval = setInterval(computeBadges, 30000); // Poll every 30s
    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationsUpdated', computeBadges);
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose?.();
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeStyle = {
    backgroundColor: `${brandColor}20`,
    color: brandColor,
    boxShadow: `inset 3px 0 0 0 ${brandColor}`
  };

  const sidebarContent = (isMobile) => {
    const isCollapsed = !isMobile && sidebarCollapsed;
    const profileImage = user?.image || user?.avatar || (adminProfile?.avatar?.startsWith?.('data:') || adminProfile?.avatar?.startsWith?.('http') ? adminProfile.avatar : '');
    return (
      <aside 
        className={`flex-shrink-0 flex flex-col h-full text-slate-300 transition-all duration-300 border-r border-slate-800/50`}
        style={{ 
          width: isCollapsed ? '5rem' : '15rem',
          backgroundColor: '#101922',
          backgroundImage: `linear-gradient(180deg, ${brandColor}15 0%, #101922 25%)`
        }}
      >
        <div className="p-4 flex flex-col gap-5 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* Branding */}
          <div className={`flex items-center gap-3 pb-4 border-b border-white/10 ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}>
            <ClinicLogoMark logoUrl={logoUrl} name={clinicName || 'TheraCare'} color={brandColor} className="h-10 w-10" />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-white leading-tight truncate">{clinicName || 'TheraCare'}</h1>
                <p className="text-xs opacity-70 truncate" style={{ color: brandColor }}>Admin Panel</p>
              </div>
            )}
            {/* Close btn on mobile */}
            {isMobile && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>

          {/* User */}
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}>
            <div 
              className="size-9 rounded-full flex items-center justify-center font-bold text-sm border flex-shrink-0 overflow-hidden bg-center bg-cover"
              style={{
                backgroundColor: `${brandColor}20`,
                color: brandColor,
                borderColor: `${brandColor}30`,
                ...(profileImage ? { backgroundImage: `url("${profileImage}")` } : {})
              }}
            >
              {!profileImage && (user?.name || adminProfile?.name || 'A').charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || adminProfile?.name || 'Admin'}</p>
                <p className="text-xs text-slate-400 truncate">{adminProfile?.role || 'Administrator'}</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-4 mt-2">
            {navGroups.map(group => (
              <div key={group.label}>
                {!isCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{group.label}</p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.items.map(item => {
                    const badgeNum = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex items-center gap-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-3'} ${
                            isActive ? 'font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
                          }`
                        }
                        style={({ isActive }) => isActive ? activeStyle : {}}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <span className="material-symbols-outlined text-[20px] flex-shrink-0 relative">
                          {item.icon}
                          {/* Dot badge when collapsed */}
                          {isCollapsed && badgeNum > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#101922] animate-pulse"></span>
                          )}
                        </span>
                        {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                        {!isCollapsed && badgeNum > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none animate-pulse">
                            {badgeNum > 9 ? '9+' : badgeNum}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 flex flex-col gap-2">
          {!isMobile && (
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
              className={`flex items-center gap-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {sidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
              </span>
              {!isCollapsed && <span>Collapse Sidebar</span>}
            </button>
          )}

          <button 
            onClick={handleLogout} 
            className={`flex items-center gap-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            {!isCollapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        {sidebarContent(false)}
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
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
