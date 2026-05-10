import React, { useMemo } from 'react';

const PROGRAM_COLORS = {
    'Occupational Therapy (OT)': { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
    'Speech & Language Therapy (ST)': { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300' },
    'Applied Behavior Analysis (ABA)': { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300' },
    'Physical Therapy (PT)': { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300' },
    'Sensory Integration (SI)': { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
    'Social Skills Group (SSG)': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
    default: { bg: 'bg-slate-100 dark:bg-slate-200', border: 'border-slate-200 dark:border-slate-300', text: 'text-slate-600 dark:text-slate-500' }
};

const getEventColor = (focus, isPast = false) => {
    if (isPast) return { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-500' };
    return PROGRAM_COLORS[focus] || PROGRAM_COLORS.default;
};

const getShortFocus = (focus) => focus?.match(/\((.*?)\)/)?.[1] || focus?.substring(0,3).toUpperCase() || 'SES';

const CalendarGrid = ({ currentView, onDateClick, onEventClick, selectedMonth, selectedYear, sessions = [] }) => {
    const todayReal = new Date();
    const todayDate = todayReal.getDate();
    const todayMonth = todayReal.getMonth();
    const todayYear = todayReal.getFullYear();

    const { daysInMonth, emptyDaysRef } = useMemo(() => {
        const year = selectedYear ?? todayReal.getFullYear();
        const month = selectedMonth ?? todayReal.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 1; i <= lastDate; i++) {
            days.push(new Date(year, month, i));
        }
        const emptyDays = Array.from({ length: firstDay }).fill(null);
        return { daysInMonth: days, emptyDaysRef: emptyDays };
    }, [selectedMonth, selectedYear]);

    if (currentView === 'Week') {
        return (
            <div className="w-full overflow-x-auto pb-2">
            <div className="grid min-w-[620px] grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex-1 min-h-[500px]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                    const isToday = new Date().getDay() === i;
                    return (
                        <div key={day} className={`py-3 text-center text-sm font-semibold border-b border-slate-200 dark:border-slate-800 ${isToday ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}>
                            {day}
                        </div>
                    );
                })}
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={`w-${i}`} className="bg-white dark:bg-background-dark p-2 flex flex-col gap-2" />
                ))}
            </div>
            </div>
        );
    }

    if (currentView === 'Day') {
        const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return (
            <div className="flex flex-col bg-white dark:bg-background-dark rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex-1 min-h-[500px]">
                <div className="bg-slate-50 dark:bg-slate-900 py-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">today</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{todayStr}</h2>
                </div>
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                    {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].map(hour => (
                        <div key={hour} className="flex gap-4 items-start border-b border-slate-100 dark:border-slate-800/50 pb-4">
                            <span className="w-20 text-sm font-medium text-slate-500 shrink-0 pt-1">{hour}</span>
                            <div
                                className="flex-1 min-h-[3rem] rounded-lg bg-slate-50/50 dark:bg-slate-800/20 w-full p-2 flex gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                onClick={() => onDateClick && onDateClick(new Date())}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: Month View
    return (
        <div className="w-full overflow-x-auto pb-2">
        <div className="grid min-w-[620px] grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex-1 shadow-sm">
            {/* Days Header */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-slate-50 dark:bg-slate-900 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    {day}
                </div>
            ))}

            {/* Empty Days before 1st */}
            {emptyDaysRef.map((_, i) => (
                <div key={`empty-${i}`} className="bg-slate-50/50 dark:bg-background-dark/50 min-h-[120px] p-2 opacity-40" />
            ))}

            {/* Actual Days */}
            {daysInMonth.map(dateObj => {
                const dateNum = dateObj.getDate();
                const isToday = dateNum === todayDate && dateObj.getMonth() === todayMonth && dateObj.getFullYear() === todayYear;
                const isPast = dateObj < todayReal && !isToday;

                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                const daySessions = sessions.filter(s => s.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));

                return (
                    <div
                        key={dateNum}
                        onClick={() => onDateClick && onDateClick(dateObj)}
                        className={`min-h-[120px] p-2 flex flex-col gap-1.5 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/80 group ${
                            isToday
                                ? 'bg-primary/5 ring-inset ring-2 ring-primary z-10'
                                : 'bg-white dark:bg-background-dark'
                        }`}
                        title="Klik untuk tambah sesi"
                    >
                        <div className="flex justify-between items-start">
                            <span className={`text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-primary text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                                {dateNum}
                            </span>
                            <span className="material-symbols-outlined text-[18px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">add_circle</span>
                        </div>

                        {/* Event Pills */}
                        <div className="flex flex-col gap-1 mt-1">
                            {daySessions.slice(0, 3).map((session, idx) => {
                                const colors = getEventColor(session.focus, isPast);
                                const shortFocus = getShortFocus(session.focus);
                                return (
                                    <div
                                        key={session.id || idx}
                                        onClick={e => { e.stopPropagation(); onEventClick && onEventClick(session, e); }}
                                        className={`${colors.bg} ${colors.text} text-[11px] font-medium px-1.5 py-0.5 rounded truncate border ${colors.border} hover:opacity-80 hover:shadow-sm transition-all cursor-pointer`}
                                        title={`${session.focus} — Klik untuk edit`}
                                    >
                                        ✏ {shortFocus} • {session.startTime}
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
