import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import ChildProfile from './pages/ChildProfile';
import AttendanceLog from './pages/AttendanceLog';
import ProgressSummary from './pages/ProgressSummary';
import Announcements from './pages/Announcements';
import Meetings from './pages/Meetings';
import Settings from './pages/Settings';
import { useClinicSettings } from '../../shared/clinicSettings';
import LegalPage from '../../shared/ui/LegalPage';
import ClinicLogoMark from '../../shared/ui/ClinicLogoMark';

const ParentWebDashboard = lazy(() => import('../../parent-web-dashboard/src/App'));
const ParentReportsArchive = lazy(() => import('../../parent-reports-archive/src/App'));
const ParentReschedule = lazy(() => import('../../parent-reschedule/src/App'));

function Loading() {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
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
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClinicLogoMark logoUrl={logoUrl} name={clinicName} color={primaryColor} className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-white">{clinicName}</span>
        <span className="hidden shrink-0 text-[10px] font-semibold text-slate-500 dark:text-slate-400 sm:inline">Parent Portal</span>
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
              <Route index element={<ParentWebDashboard />} />
              <Route path="reports" element={<ParentReportsArchive />} />
              <Route path="reschedule" element={<ParentReschedule />} />
              <Route path="profile" element={<ChildProfile />} />
              <Route path="attendance" element={<AttendanceLog />} />
              <Route path="progress" element={<ProgressSummary />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="settings" element={<Settings />} />
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
        <Route path="/privacy" element={<LegalPage type="privacy" portalName="Parent Portal" />} />
        <Route path="/terms" element={<LegalPage type="terms" portalName="Parent Portal" />} />
        <Route path="/copyright" element={<LegalPage type="copyright" portalName="Parent Portal" />} />
        <Route path="/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
