import React, { useMemo } from 'react';
import { getTherapistSlotAvailability } from '../../../shared/therapistSchedule';

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOUR_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const PROGRAM_COLORS = {
    'Occupational Therapy (OT)': { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
    'Speech & Language Therapy (ST)': { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300' },
    'Applied Behavior Analysis (ABA)': { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300' },
    'Physical Therapy (PT)': { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300' },
    'Sensory Integration (SI)': { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
    'Social Skills Group (SSG)': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
    default: { bg: 'bg-slate-100 dark:bg-slate-200', border: 'border-slate-200 dark:border-slate-300', text: 'text-slate-600 dark:text-slate-500' }
};

const OFF_STATUSES = new Set(['cancelled', 'canceled', 'therapist_off', 'center_closed', 'off', 'leave']);

const getEventColor = (focus, isPast = false, status = '') => {
    if (OFF_STATUSES.has(String(status).toLowerCase())) {
        return { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300' };
    }
    if (isPast) return { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-500' };
    return PROGRAM_COLORS[focus] || PROGRAM_COLORS.default;
};

const getSessionDisplayName = (session, childrenList = []) => {
    if (session.isOneTime) return session.visitorName || session.child?.name || 'One-time visit';
    const child = session.child || childrenList.find(c => c.id === session.childId);
    return child?.name || session.childName || 'Nama anak belum tersedia';
};

const toDateKey = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const parseTimeToMinutes = (value = '') => {
    const [h = '0', m = '0'] = String(value).split(':');
    return Number(h) * 60 + Number(m);
};

const parseDurationMinutes = (duration = '') => {
    const match = String(duration).match(/\d+/);
    return match ? Number(match[0]) : 60;
};

const getTherapistSlotIssue = (therapist, dateStr, startTime) => {
    if (!therapist || !dateStr || !startTime) return '';
    const availability = getTherapistSlotAvailability(therapist, dateStr, startTime, 60);
    return availability.known && !availability.available ? availability.label : '';
};

const getSessionsForDate = (sessions, dateObj) =>
    sessions
        .filter(s => s.date === toDateKey(dateObj))
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

const sessionOverlapsSlot = (session, slotStart) => {
    const start = parseTimeToMinutes(session.startTime || '00:00');
    const end = start + parseDurationMinutes(session.duration);
    const slotEnd = slotStart + 60;
    return start < slotEnd && end > slotStart;
};

const formatDateTitle = (dateObj) =>
    dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const CalendarGrid = ({ currentView, onDateClick, onEventClick, selectedMonth, selectedYear, selectedDate, sessions = [], childrenList = [], selectedTherapist = null }) => {
    const todayReal = new Date();
    const todayDate = todayReal.getDate();
    const todayMonth = todayReal.getMonth();
    const todayYear = todayReal.getFullYear();
    const visibleYear = selectedYear ?? todayYear;
    const visibleMonth = selectedMonth ?? todayMonth;

    const { daysInMonth, emptyDaysRef } = useMemo(() => {
        const firstDay = new Date(visibleYear, visibleMonth, 1).getDay();
        const lastDate = new Date(visibleYear, visibleMonth + 1, 0).getDate();
        const days = [];
        for (let i = 1; i <= lastDate; i++) {
            days.push(new Date(visibleYear, visibleMonth, i));
        }
        return { daysInMonth: days, emptyDaysRef: Array.from({ length: firstDay }).fill(null) };
    }, [visibleMonth, visibleYear]);

    const anchorDate = useMemo(() => {
        const selectedIsVisible = selectedDate
            && selectedDate.getMonth() === visibleMonth
            && selectedDate.getFullYear() === visibleYear;
        if (selectedIsVisible) return selectedDate;
        if (todayMonth === visibleMonth && todayYear === visibleYear) return todayReal;
        return new Date(visibleYear, visibleMonth, 1);
    }, [selectedDate, todayMonth, todayReal, todayYear, visibleMonth, visibleYear]);

    const weekDays = useMemo(() => {
        const start = new Date(anchorDate);
        start.setDate(anchorDate.getDate() - anchorDate.getDay());
        return Array.from({ length: 7 }, (_, index) => {
            const dateObj = new Date(start);
            dateObj.setDate(start.getDate() + index);
            return dateObj;
        });
    }, [anchorDate]);

    if (currentView === 'Week') {
        return (
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {weekDays.map((dateObj, i) => {
                    const isToday = toDateKey(dateObj) === toDateKey(todayReal);
                    const daySessions = getSessionsForDate(sessions, dateObj);
                    return (
                        <button
                            key={toDateKey(dateObj)}
                            type="button"
                            onClick={() => onDateClick && onDateClick(dateObj)}
                            className={`min-h-[170px] rounded-xl border p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 ${
                                isToday
                                    ? 'border-primary bg-primary/5'
                                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-background-dark'
                            }`}
                            title="Klik untuk lihat detail sesi tanggal ini"
                        >
                            <div className="mb-3 flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{WEEKDAY_LABELS[i]}</p>
                                    <p className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${isToday ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                                        {dateObj.getDate()}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold text-slate-400">{daySessions.length} sesi</span>
                            </div>
                            <div className="space-y-1.5">
                                {daySessions.slice(0, 5).map((session, idx) => {
                                    const colors = getEventColor(session.focus, false, session.status);
                                    const displayName = getSessionDisplayName(session, childrenList);
                                    return (
                                        <div
                                            key={session.id || idx}
                                            onClick={e => { e.stopPropagation(); onEventClick && onEventClick(session, e); }}
                                            className={`${colors.bg} ${colors.text} ${colors.border} rounded-lg border px-2 py-1 text-xs font-semibold`}
                                            title={`${displayName} - ${session.focus || 'Sesi'}`}
                                        >
                                            <span className="block truncate">{session.startTime} - {displayName}</span>
                                        </div>
                                    );
                                })}
                                {daySessions.length === 0 && (
                                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-semibold text-slate-400 dark:border-slate-800">
                                        Belum ada sesi
                                    </p>
                                )}
                                {daySessions.length > 5 && (
                                    <p className="text-xs font-bold text-primary">+{daySessions.length - 5} sesi lagi</p>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    }

    if (currentView === 'Day') {
        const daySessions = getSessionsForDate(sessions, anchorDate);
        const daySlots = Array.from(new Set([
            ...HOUR_SLOTS,
            ...daySessions.map(session => String(session.startTime || '').slice(0, 5)).filter(Boolean),
        ])).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
        return (
            <div className="flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-background-dark">
                <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                    <span className="material-symbols-outlined text-primary">today</span>
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-black text-slate-900 dark:text-slate-100 sm:text-xl">{formatDateTitle(anchorDate)}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{daySessions.length} sesi terjadwal</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-3">
                        {daySlots.map(hour => {
                            const slotStart = parseTimeToMinutes(hour);
                            const slotSessions = daySessions.filter(session => sessionOverlapsSlot(session, slotStart));
                            const therapistIssue = getTherapistSlotIssue(selectedTherapist, toDateKey(anchorDate), hour);
                            return (
                                <div key={hour} className="grid min-w-0 gap-2 border-b border-slate-100 pb-3 dark:border-slate-800/70 sm:grid-cols-[84px_minmax(0,1fr)]">
                                    <span className="text-sm font-bold text-slate-500 sm:pt-3">{hour}</span>
                                    <div className="min-h-[52px] rounded-xl bg-slate-50 p-2 dark:bg-slate-900/50">
                                        {slotSessions.length > 0 ? (
                                            <div className="space-y-2">
                                                {therapistIssue && (
                                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                                                        {therapistIssue}
                                                    </div>
                                                )}
                                                <div className="grid gap-2 lg:grid-cols-2">
                                                    {slotSessions.map((session, idx) => {
                                                        const colors = getEventColor(session.focus, false, session.status);
                                                        const displayName = getSessionDisplayName(session, childrenList);
                                                        return (
                                                            <button
                                                                key={session.id || idx}
                                                                type="button"
                                                                onClick={e => onEventClick && onEventClick(session, e)}
                                                                className={`${colors.bg} ${colors.text} ${colors.border} rounded-lg border px-3 py-2 text-left text-xs font-semibold transition hover:opacity-80`}
                                                                title="Klik untuk lihat detail sesi"
                                                            >
                                                                <span className="block text-[11px] opacity-80">{session.startTime} ({session.duration})</span>
                                                                <span className="mt-0.5 block truncate text-sm font-black">{displayName}</span>
                                                                <span className="mt-0.5 block truncate">{session.focus || 'Program belum diisi'}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onDateClick && onDateClick(anchorDate)}
                                                disabled={Boolean(therapistIssue)}
                                                className={`flex h-12 w-full items-center justify-center rounded-lg border border-dashed text-sm font-semibold transition ${
                                                    therapistIssue
                                                        ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                                                        : 'border-slate-200 text-slate-400 hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-slate-800'
                                                }`}
                                            >
                                                {therapistIssue || 'Tersedia'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full pb-2">
            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex-1 shadow-sm">
                {WEEKDAY_LABELS.map(day => (
                    <div key={day} className="bg-slate-50 dark:bg-slate-900 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 sm:py-2.5 sm:text-[11px]">
                        {day}
                    </div>
                ))}

                {emptyDaysRef.map((_, i) => (
                    <div key={`empty-${i}`} className="bg-slate-50/50 dark:bg-background-dark/50 min-h-[78px] p-1 opacity-40 sm:min-h-[120px] sm:p-2" />
                ))}

                {daysInMonth.map(dateObj => {
                    const dateNum = dateObj.getDate();
                    const isToday = dateNum === todayDate && dateObj.getMonth() === todayMonth && dateObj.getFullYear() === todayYear;
                    const isPast = dateObj < todayReal && !isToday;
                    const dateStr = toDateKey(dateObj);
                    const daySessions = sessions.filter(s => s.date === dateStr).sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

                    return (
                        <div
                            key={dateNum}
                            onClick={() => onDateClick && onDateClick(dateObj)}
                            className={`min-h-[78px] p-1 flex flex-col gap-1 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/80 group sm:min-h-[120px] sm:gap-1.5 sm:p-2 ${
                                isToday
                                    ? 'bg-primary/5 ring-inset ring-2 ring-primary z-10'
                                    : 'bg-white dark:bg-background-dark'
                            }`}
                            title="Klik untuk lihat detail sesi tanggal ini"
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-xs font-semibold flex items-center justify-center w-6 h-6 rounded-full sm:h-7 sm:w-7 sm:text-sm ${isToday ? 'bg-primary text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                                    {dateNum}
                                </span>
                                <span className="material-symbols-outlined hidden text-[18px] text-primary opacity-0 group-hover:opacity-100 transition-opacity sm:inline">event_note</span>
                            </div>

                            <div className="flex flex-col gap-1 mt-1">
                                {daySessions.slice(0, 3).map((session, idx) => {
                                    const colors = getEventColor(session.focus, isPast, session.status);
                                    const displayName = getSessionDisplayName(session, childrenList);
                                    return (
                                        <div
                                            key={session.id || idx}
                                            onClick={e => { e.stopPropagation(); onEventClick && onEventClick(session, e); }}
                                            className={`${colors.bg} ${colors.text} text-[10px] font-medium px-1 py-0.5 rounded truncate border ${colors.border} hover:opacity-80 hover:shadow-sm transition-all cursor-pointer sm:px-1.5 sm:text-[11px]`}
                                            title={`${displayName} - ${session.focus || 'Sesi'} - Klik untuk lihat detail`}
                                        >
                                            <span className="hidden sm:inline">{displayName} - {session.startTime}</span>
                                            <span className="sm:hidden">{session.startTime}</span>
                                        </div>
                                    );
                                })}
                                {daySessions.length > 3 && (
                                    <div className="text-[10px] text-slate-500 font-medium px-1">+{daySessions.length - 3} lagi</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarGrid;
