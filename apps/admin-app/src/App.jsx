import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useAdmin } from './context/AdminContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import LegalPage from '../../shared/ui/LegalPage';
import ClinicLogoMark from '../../shared/ui/ClinicLogoMark';

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
const TherapistManagement = lazy(() => import('../../therapist-management/src/App'));
const NotificationCenter = lazy(() => import('../../notification-center/src/App'));
const ClinicBranding = lazy(() => import('../../clinic-branding-settings/src/App'));
const AdminRooms = lazy(() => import('../../admin-rooms/src/App'));
const AdminPrograms = lazy(() => import('../../admin-programs/src/App'));
const UserManagement = lazy(() => import('./pages/UserManagementPage'));
import AnnouncementsPage from './pages/AnnouncementsPage';

function Loading() {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-sm text-slate-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-slate-500 font-medium">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function MobileTopBar({ onMenuOpen }) {
  const { clinicName, brandColor, logoUrl } = useAdmin();
  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-40 bg-white dark:bg-slate-900 shadow-sm transition-colors">
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <div className="flex items-center gap-2.5">
        <ClinicLogoMark logoUrl={logoUrl} name={clinicName || 'TheraCare'} color={brandColor || '#3b82f6'} className="h-8 w-8 rounded-lg" />
        <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{clinicName || 'TheraCare'}</span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">Admin</span>
      </div>
    </header>
  );
}

function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileTopBar onMenuOpen={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <Suspense fallback={<Loading />}>
            <Routes>
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
              <Route path="therapists" element={<TherapistManagement />} />
              <Route path="rooms" element={<AdminRooms />} />
              <Route path="programs" element={<AdminPrograms />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="settings/branding" element={<ClinicBranding />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function App() {
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
