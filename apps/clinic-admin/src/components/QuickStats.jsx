import React, { useState, useEffect } from 'react';
import { adminApi, rescheduleApi } from '../../../shared/api/client';

const QuickStats = () => {
    const [stats, setStats] = useState({
        activeChildren: 0, totalSessionsToday: 0, completedSessionsToday: 0,
        totalTherapists: 0, activeTherapists: 0, pendingRequests: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [statsRes, reqRes] = await Promise.all([
                    adminApi.getStats(),
                    rescheduleApi.getAll(),
                ]);
                const s = statsRes.data?.data || {};
                const pendingCount = (reqRes.data?.data || []).filter(r => r.status === 'pending').length;
                setStats({
                    activeChildren: s.activeChildren || 0,
                    totalSessionsToday: s.totalSessionsToday || 0,
                    completedSessionsToday: s.completedSessionsToday || 0,
                    totalTherapists: s.totalTherapists || 0,
                    activeTherapists: s.activeTherapists || 0,
                    pendingRequests: pendingCount,
                });
            } catch {}
            setLoading(false);
        };
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[1,2,3,4].map(i => (
                    <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-24 mb-4"></div>
                        <div className="h-8 bg-slate-200 rounded w-16"></div>
                    </div>
                ))}
            </div>
        );
    }

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
