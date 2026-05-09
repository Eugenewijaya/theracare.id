import React, { useMemo, useState } from 'react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const MiniCalendar = () => {
    const today = new Date();
    const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const days = useMemo(() => {
        const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
        const mondayIndex = (firstDay.getDay() + 6) % 7;
        const gridStart = new Date(firstDay);
        gridStart.setDate(firstDay.getDate() - mondayIndex);

        return Array.from({ length: 35 }, (_, index) => {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + index);
            return date;
        });
    }, [visibleMonth]);

    const moveMonth = (delta) => {
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    };

    const monthLabel = visibleMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900 capitalize">{monthLabel}</h3>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => moveMonth(-1)}
                        aria-label="Bulan sebelumnya"
                        className="text-slate-400 hover:text-slate-900"
                    >
                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => moveMonth(1)}
                        aria-label="Bulan berikutnya"
                        className="text-slate-400 hover:text-slate-900"
                    >
                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="font-medium text-slate-400">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-slate-700">
                {days.map((date) => {
                    const inMonth = date.getMonth() === visibleMonth.getMonth();
                    const isToday = sameDay(date, today);
                    return (
                        <div
                            key={date.toISOString()}
                            className={`p-1.5 rounded-md ${
                                isToday
                                    ? 'bg-primary text-slate-900 font-bold shadow-sm'
                                    : inMonth
                                        ? 'text-slate-700'
                                        : 'text-slate-300'
                            }`}
                        >
                            {date.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MiniCalendar;
