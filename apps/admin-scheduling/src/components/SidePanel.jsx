import React, { useState, useEffect } from 'react';
import { childrenApi, therapistsApi } from '../../../shared/api/client';

const PROGRAM_COLORS = {
    'Occupational Therapy (OT)': { bg: 'bg-blue-100 dark:bg-blue-900/30', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    'Speech & Language Therapy (ST)': { bg: 'bg-red-100 dark:bg-red-900/30', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
    'Applied Behavior Analysis (ABA)': { bg: 'bg-purple-100 dark:bg-purple-900/30', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
    'Physical Therapy (PT)': { bg: 'bg-orange-100 dark:bg-orange-900/30', dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
    'Sensory Integration (SI)': { bg: 'bg-green-100 dark:bg-green-900/30', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300' },
    'Social Skills Group (SSG)': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', dot: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300' },
    default: { bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-400' }
};

const getEventColor = (focus) => PROGRAM_COLORS[focus] || PROGRAM_COLORS.default;
const getShortFocus = (focus) => focus?.match(/\((.*?)\)/)?.[1] || focus?.substring(0, 3).toUpperCase() || 'SES';

const SidePanel = ({
    onClose,
    selectedDate,
    sessions = [],
    onAddSession,
    onEditSession,
    childrenList: providedChildren = [],
    therapistsList: providedTherapists = [],
}) => {
    const targetDate = selectedDate || new Date();
    const dateTitle = targetDate.toLocaleDateString('id-ID', { weekday: 'long', month: 'short', day: 'numeric' });
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const [loadedChildren, setLoadedChildren] = useState([]);
    const [loadedTherapists, setLoadedTherapists] = useState([]);
    const childrenList = providedChildren.length ? providedChildren : loadedChildren;
    const therapistsList = providedTherapists.length ? providedTherapists : loadedTherapists;

    useEffect(() => {
        if (providedChildren.length && providedTherapists.length) return;

        const load = async () => {
            try {
                const [childRes, therRes] = await Promise.all([
                    childrenApi.getAll(),
                    therapistsApi.getAll()
                ]);
                setLoadedChildren(childRes.data?.data || []);
                setLoadedTherapists(therRes.data?.data || []);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, [providedChildren.length, providedTherapists.length]);

    const daySessions = sessions.filter(s => s.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));

    const getChild = (session) => {
        if (session.isOneTime) return { name: session.visitorName || session.child?.name || 'One-time visit' };
        return session.child || childrenList.find(c => c.id === session.childId) || { name: 'Pasien tidak dikenal' };
    };

    return (
        <>
            <div className="md:hidden fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
            <aside className="fixed right-0 top-0 bottom-0 z-30 flex w-[90vw] max-w-[390px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-background-dark md:relative md:inset-auto md:z-20 md:w-[380px] md:max-w-none md:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:md:shadow-none">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg capitalize truncate">{dateTitle}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{daySessions.length} sesi terjadwal</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                        {daySessions.length > 0 ? daySessions.map((session, i) => {
                            const child = getChild(session);
                            const therapist = therapistsList.find(t => t.id === session.therapistId) || { name: 'Terapis tidak dikenal' };
                            const colors = getEventColor(session.focus);
                            const shortFocus = session.isOneTime ? 'OTV' : getShortFocus(session.focus);

                            return (
                                <div key={session.id || i} className="relative">
                                    <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${colors.dot} ring-4 ring-white dark:ring-background-dark`} />
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between gap-3">
                                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>{shortFocus}</span>
                                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1 whitespace-nowrap">
                                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                {session.startTime} ({session.duration})
                                            </span>
                                        </div>

                                        <h4 className="mt-3 font-bold text-sm text-slate-900 dark:text-white break-words">{child.name}</h4>
                                        {session.isOneTime && <p className="mt-1 text-[11px] text-slate-500">One-time visit, tidak tersimpan sebagai data anak.</p>}

                                        <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                            <p className="flex items-start gap-1.5">
                                                <span className="material-symbols-outlined text-[14px] shrink-0">person</span>
                                                <span className="break-words">{therapist.name}</span>
                                            </p>
                                            <p className="flex items-start gap-1.5">
                                                <span className="material-symbols-outlined text-[14px] shrink-0">medical_services</span>
                                                <span className="break-words">{session.focus || 'Program belum diisi'}</span>
                                            </p>
                                        </div>

                                        {onEditSession && (
                                            <button
                                                onClick={() => onEditSession(session)}
                                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-black text-white transition hover:bg-primary/90"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">{session.isOneTime ? 'info' : 'edit'}</span>
                                                {session.isOneTime ? 'Lihat Detail' : 'Edit Sesi'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-sm text-slate-500 pt-10 text-center flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined text-[32px] opacity-40">event_busy</span>
                                <p>Tidak ada sesi di tanggal ini.</p>
                                {onAddSession && (
                                    <button
                                        onClick={() => onAddSession(targetDate)}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-primary/90"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                        Tambah Jadwal
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2">
                    {onAddSession && (
                        <button
                            onClick={() => onAddSession(targetDate)}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white shadow-sm hover:bg-primary/90"
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Tambah Jadwal di Tanggal Ini
                        </button>
                    )}
                    <p className="text-[11px] text-slate-400 text-center">
                        Klik tanggal untuk melihat detail. Edit tersedia dari tombol pada kartu sesi.
                    </p>
                </div>
            </aside>
        </>
    );
};

export default SidePanel;
