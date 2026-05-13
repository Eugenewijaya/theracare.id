import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';

const TherapistDashboard = lazy(() => import('../../therapist-dashboard/src/App'));
const TherapistSchedule = lazy(() => import('../../therapist-schedule/src/App'));
const TherapistAvailability = lazy(() => import('../../therapist-availability-calendar/src/App'));
const TherapistReport = lazy(() => import('../../therapist-report/src/App')); // Deprecated
const TherapistWebReport = lazy(() => import('../../therapist-web-report/src/App')); // Unified Report Dashboard
const TherapistPerformance = lazy(() => import('../../therapist-performance/src/App'));
const ParentsMeeting = lazy(() => import('../../parents-meeting/src/App'));
const ChildProgress = lazy(() => import('../../child-progress/src/App'));
import Announcements from './pages/Announcements';
import ScheduleUpdates from './pages/ScheduleUpdates';
import LeaveRequests from './pages/LeaveRequests';
import { setClinicPortalTitle, useClinicSettings } from '../../shared/clinicSettings';
import LegalPage from '../../shared/ui/LegalPage';
import ClinicLogoMark from '../../shared/ui/ClinicLogoMark';
import NotificationToastHost from '../../shared/ui/NotificationToastHost';
import FriendlyLoader from '../../shared/ui/FriendlyLoader';

function Loading() {
  return (
    <FriendlyLoader compact variant="racoon" title="Sebentar ya" message="Dashboard terapis sedang disiapkan." />
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-slate-900">
        <FriendlyLoader variant="racoon" title="Kami cek aksesmu dulu" message="Sebentar, jadwal terapi akan segera tampil." />
      </div>
    );
  }
  return isAuthenticated
    ? children
    : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
}

function MobileTopBar({ onMenuOpen }) {
  const { clinicName, primaryColor, logoUrl } = useClinicSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.pathname !== '/';
  return (
    <header className="lg:hidden sticky top-0 z-[120] flex min-h-[64px] shrink-0 items-center gap-2 border-b border-slate-200/80 bg-slate-50 px-3 py-3 pt-[max(env(safe-area-inset-top),0px)] dark:border-slate-800/80 dark:bg-slate-900">
      <button
        onClick={onMenuOpen}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClinicLogoMark logoUrl={logoUrl} name={clinicName} color={primaryColor} icon="psychology" className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="min-w-0 truncate text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{clinicName}</span>
        <span className="hidden shrink-0 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider sm:inline">Portal Terapis</span>
      </div>
      {canGoBack ? (
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
          aria-label="Kembali"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          <span className="hidden text-xs font-bold sm:inline">Kembali</span>
        </button>
      ) : (
        <div className="h-10 w-10 shrink-0" aria-hidden="true" />
      )}
    </header>
  );
}

function DashboardLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handlePortalLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  useEffect(() => {
    window.addEventListener('theracare-auth-logout', handlePortalLogout);
    return () => window.removeEventListener('theracare-auth-logout', handlePortalLogout);
  }, [handlePortalLogout]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden" data-build-scope="therapist-progress-refresh">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <MobileTopBar onMenuOpen={() => setSidebarOpen(true)} />
        <NotificationToastHost user={user} role="therapist" onOpenNotifications={() => navigate('/announcements')} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route index element={<TherapistDashboard onLogout={handlePortalLogout} />} />
              <Route path="schedule" element={<TherapistSchedule onLogout={handlePortalLogout} />} />
              <Route path="availability" element={<TherapistAvailability />} />
              <Route path="reports" element={<TherapistWebReport />} />
              <Route path="reports/new" element={<TherapistWebReport />} />
              <Route path="performance" element={<TherapistPerformance onLogout={handlePortalLogout} />} />
              <Route path="meetings" element={<ParentsMeeting />} />
              <Route path="child-progress" element={<ChildProgress />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="schedule-updates" element={<ScheduleUpdates />} />
              <Route path="leave-requests" element={<LeaveRequests />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    setClinicPortalTitle('Portal Terapis');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<LegalPage type="privacy" portalName="Therapist Portal" />} />
        <Route path="/terms" element={<LegalPage type="terms" portalName="Therapist Portal" />} />
        <Route path="/copyright" element={<LegalPage type="copyright" portalName="Therapist Portal" />} />
        <Route path="/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
