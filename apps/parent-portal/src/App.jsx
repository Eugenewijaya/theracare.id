import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

const ParentWebDashboard = lazy(() => import('../../parent-web-dashboard/src/App.jsx'));
const ParentReportsArchive = lazy(() => import('../../parent-reports-archive/src/App.jsx'));
const ParentReschedule = lazy(() => import('../../parent-reschedule/src/App.jsx'));
const ChildProfile = lazy(() => import('../../parent-app/src/pages/ChildProfile.jsx'));
const Announcements = lazy(() => import('../../parent-app/src/pages/Announcements.jsx'));
const Settings = lazy(() => import('../../parent-app/src/pages/Settings.jsx'));

function Loading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background-light text-slate-500 dark:bg-background-dark dark:text-slate-400">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                <p className="text-sm font-semibold">Memuat Parent Portal...</p>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Suspense fallback={<Loading />}>
                <Routes>
                    <Route path="/" element={<ParentWebDashboard />} />
                    <Route path="/reports" element={<ParentReportsArchive />} />
                    <Route path="/reschedule" element={<ParentReschedule />} />
                    <Route path="/profile" element={<ChildProfile />} />
                    <Route path="/announcements" element={<Announcements />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}
