import React, { useState, useEffect } from 'react';
import { getAllChildren, getAllTherapists } from '../../../shared/clinicDataStore';

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
const getShortFocus = (focus) => focus?.match(/\((.*?)\)/)?.[1] || focus?.substring(0,3).toUpperCase() || 'SES';

const SidePanel = ({ onClose, selectedDate, sessions = [], onEventClick }) => {
    const targetDate = selectedDate || new Date();
    const dateTitle = targetDate.toLocaleDateString('id-ID', { weekday: 'long', month: 'short', day: 'numeric' });

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const [childrenList, setChildrenList] = useState([]);
    const [therapistsList, setTherapistsList] = useState([]);

    useEffect(() => {
        const load = () => {
            setChildrenList(getAllChildren());
            setTherapistsList(getAllTherapists());
        };
        load();
        window.addEventListener('clinicDataUpdated', load);
        return () => window.removeEventListener('clinicDataUpdated', load);
    }, []);

    const daySessions = sessions.filter(s => s.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));

    return (
        <>
            <div className="md:hidden fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
            <aside className="absolute right-0 top-0 bottom-0 z-30 w-[85vw] sm:w-[360px] md:relative md:w-[360px] md:z-20 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark flex flex-col shrink-0 overflow-hidden shadow-2xl md:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none">

                {/* Panel Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="font-bold text-lg capitalize">{dateTitle}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{daySessions.length} Sesi Terjadwal</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Session Timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                        {daySessions.length > 0 ? daySessions.map((session, i) => {
                            const child = childrenList.find(c => c.id === session.childId) || { name: 'Pasien Tidak Dikenal' };
                            const therapist = therapistsList.find(t => t.id === session.therapistId) || { name: 'Terapis Tidak Dikenal' };
                            const colors = getEventColor(session.focus);
                            const shortFocus = getShortFocus(session.focus);

                            return (
                                <div key={session.id || i} className="relative">
                                    <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${colors.dot} ring-4 ring-white dark:ring-background-dark`} />
                                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>{shortFocus}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                    {session.startTime} ({session.duration})
                                                </span>
                                                {onEventClick && (
                                                    <button
                                                        onClick={() => onEventClick(session, { stopPropagation: () => {} })}
                                                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors"
                                                        title="Edit sesi ini"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <h4 className="font-semibold text-sm mb-1">{child.name}</h4>
                                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                                {therapist.name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-sm text-slate-500 pt-10 text-center flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-[32px] opacity-40">event_busy</span>
                                <p>Tidak ada sesi di tanggal ini.</p>
                                <p className="text-xs opacity-60">Klik tanggal di kalender untuk menambah sesi.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-[11px] text-slate-400 text-center">
                        Klik sesi <span className="material-symbols-outlined text-[12px] align-text-bottom">edit</span> untuk mengedit • Klik tanggal untuk menambah
                    </p>
                </div>

            </aside>
        </>
    );
};

export default SidePanel;
