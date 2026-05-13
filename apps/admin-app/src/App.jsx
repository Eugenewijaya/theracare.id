import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useAdmin } from './context/AdminContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import LegalPage from '../../shared/ui/LegalPage';
import ClinicLogoMark from '../../shared/ui/ClinicLogoMark';
import NotificationToastHost from '../../shared/ui/NotificationToastHost';
import AutoRefreshHost from '../../shared/ui/AutoRefreshHost';
import FriendlyLoader from '../../shared/ui/FriendlyLoader';
import { setClinicPortalTitle } from '../../shared/clinicSettings';

const ClinicAdmin = lazy(() => import('../../clinic-admin/src/App'));
const AdminScheduling = lazy(() => import('../../admin-scheduling/src/App'));
const BulkSchedule = lazy(() => import('../../bulk-schedule/src/App'));
const AdminRequests = lazy(() => import('../../admin-requests/src/App'));
const ParentsMeeting = lazy(() => import('../../parents-meeting/src/App'));
const AdminAttendance = lazy(() => import('../../admin-attendance/src/App'));
const TherapistRegistration = lazy(() => import('../../therapist-registration/src/App'));
const AdminReports = lazy(() => import('../../admin-reports/src/App'));
const MonitoringProgress = lazy(() => import('../../monitoring-progress/src/App'));
const ChildManagement = lazy(() => import('../../child-management/src/App'));
const ChildRegistration = lazy(() => import('../../child-registration/src/App'));
const ProgramEnrollment = lazy(() => import('../../child-management/src/ProgramEnrollmentPage'));
const TherapistManagement = lazy(() => import('../../therapist-management/src/App'));
const NotificationCenter = lazy(() => import('../../notification-center/src/App'));
const ClinicBranding = lazy(() => import('../../clinic-branding-settings/src/App'));
const AdminRooms = lazy(() => import('../../admin-rooms/src/App'));
const AdminPrograms = lazy(() => import('../../admin-programs/src/App'));
const UserManagement = lazy(() => import('./pages/UserManagementPage'));
const TherapistLeaveRequests = lazy(() => import('./pages/TherapistLeaveRequestsPage'));

function Loading() {
  return (
    <FriendlyLoader compact variant="cat" title="Sebentar ya" message="Dashboard admin sedang disiapkan." />
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50">
        <FriendlyLoader variant="cat" title="Kami cek aksesmu dulu" message="Sebentar, ruang admin akan terbuka setelah sesi aman." />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function MobileTopBar({ onMenuOpen }) {
  const { clinicName, brandColor, logoUrl } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.pathname !== '/';
  return (
    <header className="lg:hidden sticky top-0 z-[120] flex min-h-[64px] shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-3 pt-[max(env(safe-area-inset-top),0px)] shadow-sm transition-colors dark:border-slate-800/80 dark:bg-slate-900">
      <button
        onClick={onMenuOpen}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClinicLogoMark logoUrl={logoUrl} name={clinicName || 'TheraCare'} color={brandColor || '#3b82f6'} className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="min-w-0 truncate text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{clinicName || 'TheraCare'}</span>
        <span className="hidden shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sm:inline">Dashboard Admin</span>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <MobileTopBar onMenuOpen={() => setSidebarOpen(true)} />
        <AutoRefreshHost
          user={user}
          role="admin"
          onRefresh={() => setRefreshKey((key) => key + 1)}
        />
        <NotificationToastHost user={user} role="admin" onOpenNotifications={() => navigate('/notifications')} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <Suspense fallback={<Loading />}>
            <Routes key={refreshKey}>
              <Route index element={<ClinicAdmin />} />
              <Route path="scheduling" element={<AdminScheduling />} />
              <Route path="bulk-schedule" element={<BulkSchedule />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="parent-meetings" element={<ParentsMeeting mode="admin" />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="therapist-registration" element={<TherapistRegistration />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="monitoring" element={<MonitoringProgress />} />
              <Route path="children" element={<ChildManagement />} />
              <Route path="children/register" element={<ChildRegistration />} />
              <Route path="children/program-registration" element={<ProgramEnrollment />} />
              <Route path="therapists" element={<TherapistManagement />} />
              <Route path="rooms" element={<AdminRooms />} />
              <Route path="programs" element={<AdminPrograms />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="settings/branding" element={<ClinicBranding />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="therapist-leave-requests" element={<TherapistLeaveRequests />} />
              <Route path="announcements" element={<Navigate to="/notifications" replace />} />
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
    setClinicPortalTitle('Dashboard Admin');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<LegalPage type="privacy" portalName="Admin Portal" />} />
        <Route path="/terms" element={<LegalPage type="terms" portalName="Admin Portal" />} />
        <Route path="/copyright" element={<LegalPage type="copyright" portalName="Admin Portal" />} />
        <Route path="/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
