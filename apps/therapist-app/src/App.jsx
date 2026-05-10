import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { useClinicSettings } from '../../shared/clinicSettings';
import LegalPage from '../../shared/ui/LegalPage';
import ClinicLogoMark from '../../shared/ui/ClinicLogoMark';

function Loading() {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        <p className="text-sm text-slate-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <p className="text-sm text-slate-500 font-medium">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }
  return isAuthenticated
    ? children
    : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
}

function MobileTopBar({ onMenuOpen }) {
  const { clinicName, primaryColor, logoUrl } = useClinicSettings();
  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-40">
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <div className="flex items-center gap-2.5">
        <ClinicLogoMark logoUrl={logoUrl} name={clinicName} color={primaryColor} icon="psychology" className="h-8 w-8 rounded-lg" />
        <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{clinicName}</span>
        <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Therapist</span>
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
              <Route index element={<TherapistDashboard />} />
              <Route path="schedule" element={<TherapistSchedule />} />
              <Route path="availability" element={<TherapistAvailability />} />
              <Route path="reports" element={<TherapistWebReport />} />
              <Route path="reports/new" element={<TherapistWebReport />} />
              <Route path="performance" element={<TherapistPerformance />} />
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
