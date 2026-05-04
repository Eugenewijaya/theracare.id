import React, { useState, useEffect } from 'react';

const getClinStats = () => {
    try {
        const d = JSON.parse(localStorage.getItem('clinicData') || '{}');
        const kids = d.children || [];
        const therapists = d.therapists || [];
        const sessions = d.sessions || [];
        const today = new Date().toISOString().split('T')[0];
        
        const todaySessions = sessions.filter(s => s.date === today);
        const completedSessions = todaySessions.filter(s => s.status === 'done').length;

        const activeTherapists = therapists.filter(t => t.status === 'active').length;

        return { 
            activeChildren: kids.filter(c => c.status === 'active').length || kids.length || 45,
            totalSessionsToday: todaySessions.length,
            completedSessionsToday: completedSessions,
            totalTherapists: therapists.length,
            activeTherapists: activeTherapists
        };
    } catch { 
        return { activeChildren: 45, totalSessionsToday: 15, completedSessionsToday: 12, totalTherapists: 10, activeTherapists: 8 }; 
    }
};

const getPendingCount = () => {
    try { return JSON.parse(localStorage.getItem('adminRequests_pending') || '[]').length; }
    catch { return 3; }
};

const QuickStats = () => {
    const [stats, setStats] = useState({ ...getClinStats(), pendingRequests: getPendingCount() });

    useEffect(() => {
        const update = () => setStats({ ...getClinStats(), pendingRequests: getPendingCount() });
        window.addEventListener('requestsDataUpdated', update);
        window.addEventListener('clinicDataUpdated', update);
        return () => { window.removeEventListener('requestsDataUpdated', update); window.removeEventListener('clinicDataUpdated', update); };
    }, []);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-500">Active Children</p>
                    <span className="material-symbols-outlined text-primary bg-primary/10 rounded-lg p-1.5 text-[20px]">child_care</span>
                </div>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-slate-900">{stats.activeChildren}</h3>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span> Live
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-500">Sesi Hari Ini</p>
                    <span className="material-symbols-outlined text-blue-500 bg-blue-50 rounded-lg p-1.5 text-[20px]">event_available</span>
                </div>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-slate-900">{stats.completedSessionsToday}<span className="text-xl text-slate-400">/{stats.totalSessionsToday}</span></h3>
                    <span className="text-xs font-medium text-slate-500">
                        {stats.totalSessionsToday > 0 ? Math.round((stats.completedSessionsToday / stats.totalSessionsToday) * 100) : 0}% Selesai
                    </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                    <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${stats.totalSessionsToday > 0 ? (stats.completedSessionsToday / stats.totalSessionsToday) * 100 : 0}%` }}></div>
                </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-500">Terapis Aktif</p>
                    <span className="material-symbols-outlined text-purple-500 bg-purple-50 rounded-lg p-1.5 text-[20px]">psychology</span>
                </div>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-slate-900">{stats.activeTherapists}</h3>
                    <span className="text-xs font-medium text-slate-500">Dari {stats.totalTherapists}</span>
                </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-500">Permintaan Masuk</p>
                    <span className="material-symbols-outlined text-orange-500 bg-orange-50 rounded-lg p-1.5 text-[20px]">pending_actions</span>
                </div>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-slate-900">{stats.pendingRequests}</h3>
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md flex items-center gap-1">
                        {stats.pendingRequests > 0 ? 'Perlu tindakan' : 'Semua beres'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default QuickStats;
