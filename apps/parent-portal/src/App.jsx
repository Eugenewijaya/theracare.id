import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const ParentWebDashboard = lazy(() => import('../../parent-web-dashboard/src/App'));
const ParentReportsArchive = lazy(() => import('../../parent-reports-archive/src/App'));
const ParentReschedule = lazy(() => import('../../parent-reschedule/src/App'));

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
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}
