import React, { useState, useEffect } from 'react';
import { sessionsApi } from '../../../shared/api/client';

const todayString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Timeline = () => {
    const [sessions, setSessions] = useState([]);
    const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const today = todayString();
                const res = await sessionsApi.getAll({ from: today, to: today });
                const allSessions = res.data?.data || [];
                setSessions(allSessions.filter(s => s.date === today && s.status !== 'cancelled').sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
            } catch {}
            setLoading(false);
        };
        load();
        const interval = setInterval(() => setCurrentTimeMs(Date.now()), 60000);
        const refresh = setInterval(load, 120000);
        return () => { clearInterval(interval); clearInterval(refresh); };
    }, []);

    const now = new Date(currentTimeMs);
    const currHour = now.getHours();
    const currMin = now.getMinutes();

    const grouped = sessions.reduce((acc, session) => {
        const h = (session.startTime || '00:00').split(':')[0];
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
        const hStr = parseInt(h) > 12 ? parseInt(h) - 12 : parseInt(h) === 0 ? 12 : parseInt(h);
        const hourLabel = `${String(hStr).padStart(2, '0')}:00 ${ampm}`;
        if (!acc[hourLabel]) acc[hourLabel] = [];
        acc[hourLabel].push(session);
        return acc;
    }, {});

    if (Object.keys(grouped).length === 0) {
        grouped["09:00 AM"] = [];
        grouped["10:00 AM"] = [];
        grouped["11:00 AM"] = [];
    }

    const formatCurrentTime = () => {
        let h = currHour;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12; h = h ? h : 12;
        const m = currMin < 10 ? '0' + currMin : currMin;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="h-5 bg-slate-200 rounded w-40 mb-4 animate-pulse" />
                <div className="space-y-4">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Timeline Hari Ini</h2>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-100 border border-teal-200"></span> OT</div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-100 border border-indigo-200"></span> ST/SI</div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-200"></span> Lainnya</div>
                </div>
            </div>
            <div className="p-4 sm:p-6 flex-1">
                <div className="flex flex-col gap-6 relative">
                    <div className="absolute left-1/2 sm:left-[20%] top-0 bottom-0 w-px bg-red-400 z-10 border-l border-dashed border-red-400">
                        <div className="absolute -top-2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{formatCurrentTime()}</div>
                    </div>
                    {Object.entries(grouped).map(([hourLabel, hourSessions]) => (
                        <div key={hourLabel} className="flex flex-col sm:flex-row gap-2 sm:gap-4 relative">
                            <div className="w-auto sm:w-16 text-xs font-semibold text-slate-400 sm:text-right pt-2 shrink-0">{hourLabel}</div>
                            <div className="flex-1 flex flex-col sm:flex-row gap-2 border-t border-slate-100 pt-3 sm:pt-2 min-h-[60px]">
                                {hourSessions.length === 0 ? (
                                    <div className="flex-1 border border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                                        <span className="text-xs text-slate-400 font-medium">Tersedia</span>
                                    </div>
                                ) : hourSessions.map(session => {
                                    let bgClass = "bg-amber-50 border-amber-200", textClass = "text-amber-900", subTextClass = "text-amber-700";
                                    if (session.focus?.includes('OT')) { bgClass = "bg-teal-50 border-teal-200"; textClass = "text-teal-900"; subTextClass = "text-teal-700"; }
                                    else if (session.focus?.includes('Speech') || session.focus?.includes('ST') || session.focus?.includes('SI')) { bgClass = "bg-indigo-50 border-indigo-200"; textClass = "text-indigo-900"; subTextClass = "text-indigo-700"; }
                                    const h = parseInt((session.startTime || '0:0').split(':')[0]);
                                    const m = parseInt((session.startTime || '0:0').split(':')[1]);
                                    const startMins = h * 60 + m;
                                    const currMins = currHour * 60 + currMin;
                                    const isPast = session.status === 'done' || (currMins > startMins + parseInt(session.duration || 60));
                                    const inProgress = session.status !== 'done' && currMins >= startMins && currMins < startMins + parseInt(session.duration || 60);
                                    return (
                                        <div key={session.id} className={`${bgClass} border rounded-lg p-2 flex-1 relative ${isPast ? 'opacity-60' : ''} ${inProgress ? 'border-2 shadow-sm z-20' : ''}`}>
                                            {session.status === 'done' && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold bg-white/50 px-1.5 rounded">
                                                    <span className="material-symbols-outlined text-[12px]">check_circle</span> Selesai
                                                </div>
                                            )}
                                            {inProgress && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold bg-white px-1.5 rounded animate-pulse">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Berjalan
                                                </div>
                                            )}
                                            <p className={`text-sm font-bold ${textClass}`}>{session.focus || 'Terapi'} {session.startTime}</p>
                                            <p className={`text-xs ${subTextClass}`}>{session.child?.name || session.childId || 'Anak'} • {session.therapist?.name || session.therapistId || 'Terapis'}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Timeline;
