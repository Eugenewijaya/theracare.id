import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import { getSessionsForTherapist } from '../../shared/clinicDataStore';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 10 }, (_, index) => 8 + index);

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() - next.getDay());
    return next;
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMonthTitle(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function calculateEndTime(startTime, durationStr) {
    if (!startTime) return '00:00';
    const [hour, minute] = startTime.split(':').map(Number);
    const durationMinutes = parseInt(durationStr, 10) || 45;
    const date = new Date();
    date.setHours(hour, minute + durationMinutes, 0, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getStatusStyle(status) {
    if (status === 'done') {
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300';
    }
    if (status === 'active') {
        return 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/20 dark:border-sky-800/50 dark:text-sky-300';
    }
    return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300';
}

function getStatusLabel(status) {
    if (status === 'done') return 'Selesai';
    if (status === 'active') return 'Berlangsung';
    return 'Terjadwal';
}

function toCalendarEvent(session) {
    const [hour, minute] = (session.startTime || '08:00').split(':').map(Number);
    const top = ((hour - 8) + (minute / 60)) * 60;
    const height = Math.max((parseInt(session.duration, 10) || 45), 35);

    return {
        id: session.id,
        key: session.date,
        childName: session.child?.name || 'Unknown Patient',
        focus: session.focus || 'Therapy Session',
        date: session.date,
        startTime: session.startTime,
        endTime: calculateEndTime(session.startTime, session.duration),
        status: session.status,
        room: session.roomId || 'Clinic Room',
        top,
        height,
    };
}

function EmptyState({ title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">calendar_month</span>
            <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
    );
}

function App() {
    const [currentUser] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('therapist_user')); } catch { return null; }
    });
    const [viewMode, setViewMode] = useState('week');
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const loadEvents = () => {
            if (!currentUser?.id) {
                setEvents([]);
                return;
            }

            const mapped = getSessionsForTherapist(currentUser.id)
                .map(toCalendarEvent)
                .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

            setEvents(mapped);
        };

        loadEvents();
        window.addEventListener('clinicDataUpdated', loadEvents);
        return () => window.removeEventListener('clinicDataUpdated', loadEvents);
    }, [currentUser]);

    const weekDates = useMemo(() => {
        const firstDay = startOfWeek(anchorDate);
        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(firstDay);
            date.setDate(firstDay.getDate() + index);
            return date;
        });
    }, [anchorDate]);

    const monthDays = useMemo(() => {
        const first = startOfMonth(anchorDate);
        const last = endOfMonth(anchorDate);
        const leading = first.getDay();
        const days = [];

        for (let i = 0; i < leading; i += 1) {
            days.push(null);
        }

        for (let day = 1; day <= last.getDate(); day += 1) {
            days.push(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), day));
        }

        while (days.length % 7 !== 0) {
            days.push(null);
        }

        return days;
    }, [anchorDate]);

    const eventsByDate = useMemo(() => {
        const map = new Map();
        events.forEach(event => {
            const existing = map.get(event.key) || [];
            existing.push(event);
            map.set(event.key, existing);
        });
        return map;
    }, [events]);

    const visibleWeekEvents = useMemo(() => {
        const keys = new Set(weekDates.map(formatDateKey));
        return events.filter(event => keys.has(event.key));
    }, [events, weekDates]);

    const visibleMonthEvents = useMemo(() => {
        const month = anchorDate.getMonth();
        const year = anchorDate.getFullYear();
        return events.filter(event => {
            const date = new Date(`${event.date}T00:00:00`);
            return date.getMonth() === month && date.getFullYear() === year;
        });
    }, [events, anchorDate]);

    const totalScheduled = viewMode === 'week' ? visibleWeekEvents.length : visibleMonthEvents.length;
    const completedCount = (viewMode === 'week' ? visibleWeekEvents : visibleMonthEvents).filter(event => event.status === 'done').length;
    const activeCount = (viewMode === 'week' ? visibleWeekEvents : visibleMonthEvents).filter(event => event.status === 'active').length;

    const handlePrevious = () => {
        const next = new Date(anchorDate);
        if (viewMode === 'week') {
            next.setDate(next.getDate() - 7);
        } else {
            next.setMonth(next.getMonth() - 1);
        }
        setAnchorDate(next);
    };

    const handleNext = () => {
        const next = new Date(anchorDate);
        if (viewMode === 'week') {
            next.setDate(next.getDate() + 7);
        } else {
            next.setMonth(next.getMonth() + 1);
        }
        setAnchorDate(next);
    };

    const handleToday = () => setAnchorDate(new Date());

    return (
        <div className="relative flex h-screen w-full overflow-hidden text-slate-900 dark:text-slate-100 font-sans">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <Header />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex size-12 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500 ring-2 ring-teal-500/20 dark:bg-slate-900"
                                        style={currentUser?.avatar ? { backgroundImage: `url("${currentUser.avatar}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                                        title={currentUser?.name || 'Profile'}
                                    >
                                        {!currentUser?.avatar && (currentUser?.name?.charAt(0) || 'T')}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentUser?.name || 'Therapist'}</p>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{currentUser?.specialty || 'Clinical Team'}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-900/60">
                                        <button onClick={() => setViewMode('week')} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${viewMode === 'week' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Minggu</button>
                                        <button onClick={() => setViewMode('month')} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Bulan</button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button onClick={handlePrevious} className="rounded-full border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                                            <span className="material-symbols-outlined">chevron_left</span>
                                        </button>
                                        <div className="min-w-[180px] text-center">
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{viewMode === 'week' ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : formatMonthTitle(anchorDate)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Data nyata dari jadwal terapi yang sudah tersimpan</p>
                                        </div>
                                        <button onClick={handleNext} className="rounded-full border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                                            <span className="material-symbols-outlined">chevron_right</span>
                                        </button>
                                    </div>

                                    <button onClick={handleToday} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                                        Hari Ini
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Jadwal</p>
                                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{totalScheduled}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{viewMode === 'week' ? 'Dalam minggu aktif' : 'Dalam bulan aktif'}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sesi Selesai</p>
                                <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">{completedCount}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status `done` pada periode yang tampil</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sedang Berlangsung</p>
                                <p className="mt-2 text-3xl font-black text-sky-600 dark:text-sky-400">{activeCount}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status `active` pada periode yang tampil</p>
                            </div>
                        </div>

                        {viewMode === 'week' ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                {visibleWeekEvents.length === 0 ? (
                                    <EmptyState
                                        title="Tidak ada sesi pada minggu ini"
                                        subtitle="Pindah minggu untuk melihat jadwal lain, atau tunggu admin menjadwalkan sesi baru."
                                    />
                                ) : (
                                    <>
                                        <div className="grid grid-cols-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <div className="border-b border-r border-slate-200 bg-slate-50 p-3 text-center text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-900/50">Time</div>
                                            {weekDates.map(date => {
                                                const isToday = formatDateKey(date) === formatDateKey(new Date());
                                                return (
                                                    <div key={formatDateKey(date)} className={`border-b border-slate-200 p-3 text-center ${isToday ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-slate-50 dark:bg-slate-900/50'} dark:border-slate-700`}>
                                                        <p className={`text-[11px] font-bold uppercase tracking-widest ${isToday ? 'text-sky-600 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>{WEEK_DAYS[date.getDay()]}</p>
                                                        <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{date.getDate()}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="grid grid-cols-8 overflow-hidden rounded-b-2xl border-x border-b border-slate-200 dark:border-slate-700">
                                            <div className="border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
                                                {HOURS.map(hour => (
                                                    <div key={hour} className="flex h-[60px] items-start justify-end border-b border-slate-100 px-3 pt-2 text-[11px] font-bold text-slate-400 last:border-b-0 dark:border-slate-800">
                                                        {`${String(hour).padStart(2, '0')}:00`}
                                                    </div>
                                                ))}
                                            </div>

                                            {weekDates.map(date => {
                                                const key = formatDateKey(date);
                                                const dayEvents = eventsByDate.get(key) || [];

                                                return (
                                                    <div key={key} className="relative border-r border-slate-200 bg-white last:border-r-0 dark:border-slate-700 dark:bg-slate-800">
                                                        {HOURS.map(hour => (
                                                            <div key={hour} className="h-[60px] border-b border-slate-100 last:border-b-0 dark:border-slate-800" />
                                                        ))}

                                                        {dayEvents.map(event => (
                                                            <div
                                                                key={event.id}
                                                                className={`absolute left-2 right-2 overflow-hidden rounded-xl border px-3 py-2 shadow-sm ${getStatusStyle(event.status)}`}
                                                                style={{ top: `${event.top}px`, minHeight: `${event.height}px` }}
                                                            >
                                                                <p className="text-[11px] font-black uppercase tracking-wide">{getStatusLabel(event.status)}</p>
                                                                <p className="mt-1 text-sm font-bold leading-tight">{event.childName}</p>
                                                                <p className="mt-1 text-[11px] font-medium opacity-80">{event.startTime} - {event.endTime}</p>
                                                                <p className="mt-1 text-[11px] leading-snug opacity-80">{event.focus}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-2"><span className="size-3 rounded bg-amber-100 dark:bg-amber-900/30" /> Terjadwal</span>
                                            <span className="flex items-center gap-2"><span className="size-3 rounded bg-sky-100 dark:bg-sky-900/30" /> Berlangsung</span>
                                            <span className="flex items-center gap-2"><span className="size-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> Selesai</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                {visibleMonthEvents.length === 0 ? (
                                    <EmptyState
                                        title="Tidak ada sesi pada bulan ini"
                                        subtitle="Kalender bulanan akan terisi otomatis saat sesi terapi dijadwalkan."
                                    />
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="grid grid-cols-7 gap-2">
                                            {WEEK_DAYS.map(day => (
                                                <div key={day} className="px-2 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                                                    {day}
                                                </div>
                                            ))}

                                            {monthDays.map((date, index) => {
                                                if (!date) {
                                                    return <div key={`blank-${index}`} className="min-h-[110px] rounded-2xl border border-transparent" />;
                                                }

                                                const key = formatDateKey(date);
                                                const dayEvents = eventsByDate.get(key) || [];
                                                const isToday = key === formatDateKey(new Date());

                                                return (
                                                    <div key={key} className={`min-h-[110px] rounded-2xl border p-3 ${isToday ? 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20' : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-sm font-black ${isToday ? 'text-sky-700 dark:text-sky-300' : 'text-slate-900 dark:text-slate-100'}`}>{date.getDate()}</span>
                                                            {dayEvents.length > 0 && (
                                                                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
                                                                    {dayEvents.length}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 flex flex-col gap-2">
                                                            {dayEvents.slice(0, 3).map(event => (
                                                                <div key={event.id} className={`rounded-xl border px-2.5 py-2 text-[11px] ${getStatusStyle(event.status)}`}>
                                                                    <p className="font-bold leading-tight">{event.childName}</p>
                                                                    <p className="mt-1 opacity-80">{event.startTime} · {event.focus}</p>
                                                                </div>
                                                            ))}
                                                            {dayEvents.length > 3 && (
                                                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">+{dayEvents.length - 3} sesi lainnya</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
