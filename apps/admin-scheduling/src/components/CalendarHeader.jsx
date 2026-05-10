import React, { useState, useRef, useEffect } from 'react';
import { therapistsApi, childrenApi, adminApi } from '../../../shared/api/client';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function FilterDropdown({ label, options, value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isFiltered = value !== options[0];

    return (
        <div className="relative w-full sm:w-auto" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                aria-label={label}
                className={`flex h-10 w-full items-center justify-between gap-x-2 rounded-lg border px-3 transition-colors text-sm font-medium sm:h-9 sm:w-auto sm:justify-center ${
                    isFiltered
                        ? 'border-primary bg-primary/10 text-primary dark:border-primary/50'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
                <span className="max-w-[180px] truncate sm:max-w-[110px]">{value}</span>
                <span className="material-symbols-outlined text-[18px]">{open ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
            </button>
            {open && (
                <div className="absolute top-full mt-1.5 left-0 z-50 w-full min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 sm:w-auto">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onChange(opt); setOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                                value === opt
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            {value === opt && <span className="material-symbols-outlined text-[16px]">check</span>}
                            {value !== opt && <span className="w-4 inline-block" />}
                            <span>{opt}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const CalendarHeader = ({ currentView, setCurrentView, currentMonth, currentYear, onPrev, onNext, onToday, filters, setFilters }) => {
    const [therapistsList, setTherapistsList] = useState(['All Therapists']);
    const [childrenList, setChildrenList] = useState(['All Children']);
    const [programsList, setProgramsList] = useState(['All Programs']);

    useEffect(() => {
        const load = async () => {
            try {
                const [therRes, childRes, progRes] = await Promise.all([
                    therapistsApi.getAll(),
                    childrenApi.getAll(),
                    adminApi.getPrograms()
                ]);
                const t = (therRes.data?.data || []).map(t => t.name);
                const c = (childRes.data?.data || []).map(c => c.name);
                const p = (progRes.data?.data || []).map(p => p.name);
                setTherapistsList(['All Therapists', ...t]);
                setChildrenList(['All Children', ...c]);
                setProgramsList(['All Programs', ...p]);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, []);
    return (
        <div className="flex flex-col px-4 py-4 gap-4 border-b border-slate-200 dark:border-slate-800 shrink-0 sm:px-6">

            {/* Month Navigation */}
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                <h1 className="text-2xl font-bold leading-tight tracking-normal text-slate-900 dark:text-slate-100 sm:whitespace-nowrap">Clinic Schedule</h1>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                <div className="flex min-w-0 flex-1 items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 sm:flex-none">
                    <button
                        onClick={onPrev}
                        className="shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        title="Previous month"
                    >
                        <span className="material-symbols-outlined text-xl">chevron_left</span>
                    </button>
                    <span className="min-w-0 flex-1 truncate px-2 text-center text-base font-semibold sm:min-w-[140px]">
                        {MONTH_NAMES[currentMonth]} {currentYear}
                    </span>
                    <button
                        onClick={onNext}
                        className="shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        title="Next month"
                    >
                        <span className="material-symbols-outlined text-xl">chevron_right</span>
                    </button>
                </div>
                <button
                    onClick={onToday}
                    className="h-10 shrink-0 whitespace-nowrap px-3 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors sm:h-9"
                    title="Jump to today"
                >
                    Today
                </button>
                </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                    <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3 lg:flex lg:flex-wrap">
                        <FilterDropdown
                            label="Therapists"
                            options={therapistsList}
                            value={filters.therapist}
                            onChange={v => setFilters(f => ({ ...f, therapist: v }))}
                        />
                        <FilterDropdown
                            label="Children"
                            options={childrenList}
                            value={filters.child}
                            onChange={v => setFilters(f => ({ ...f, child: v }))}
                        />
                        <FilterDropdown
                            label="Programs"
                            options={programsList}
                            value={filters.program}
                            onChange={v => setFilters(f => ({ ...f, program: v }))}
                        />
                    </div>

                    {/* View Segmented Control */}
                    <div className="flex h-10 w-full items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 p-1 sm:h-9 sm:w-auto">
                        {['Month', 'Week', 'Day'].map((viewName) => (
                            <label key={viewName} className={`flex h-full flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-all sm:flex-none ${currentView === viewName ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                                <span>{viewName}</span>
                                <input
                                    type="radio"
                                    name="view-toggle"
                                    value={viewName}
                                    checked={currentView === viewName}
                                    onChange={(e) => setCurrentView(e.target.value)}
                                    className="sr-only"
                                />
                            </label>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default CalendarHeader;
