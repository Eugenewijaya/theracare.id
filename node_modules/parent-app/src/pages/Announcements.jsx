import React, { useState, useEffect } from 'react';
import { adminApi } from '../../../shared/api/client';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await adminApi.getAnnouncementsForRole('parent');
                setAnnouncements(res.data?.data || []);
            } catch(e) { console.error(e); }
        };
        load();
    }, []);

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900">
            {/* Page Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                    <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Pengumuman Klinik</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Informasi terbaru dari TheraCare untuk Anda.</p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto flex flex-col gap-4">
                    {announcements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-slate-400">notifications_none</span>
                            </div>
                            <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Tidak ada pengumuman</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500">Pengumuman dari klinik akan muncul di sini.</p>
                        </div>
                    ) : (
                        announcements.map((ann) => (
                            <div
                                key={ann.id}
                                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                                            </div>
                                            <div className="flex-1">
                                                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1">{ann.title}</h2>
                                                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                                                        {formatDate(ann.createdAt)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[13px]">admin_panel_settings</span>
                                                        TheraCare Admin
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setExpanded(expanded === ann.id ? null : ann.id)}
                                            className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-slate-400 text-[20px]">
                                                {expanded === ann.id ? 'expand_less' : 'expand_more'}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Preview or full content */}
                                    <div className={`mt-3 ml-14 text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${expanded === ann.id ? '' : 'line-clamp-2'}`}>
                                        {ann.content}
                                    </div>

                                    {expanded === ann.id && (
                                        <div className="mt-4 ml-14 flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs font-bold rounded-full border border-sky-100 dark:border-sky-800/50 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                                Aktif
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
