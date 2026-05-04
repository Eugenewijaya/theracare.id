import React, { useState, useRef, useEffect } from 'react';
import { getAllTherapists, getAllChildren, getAllPrograms } from '../../../shared/clinicDataStore';

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
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex h-9 items-center justify-center gap-x-2 rounded-lg border px-3 transition-colors text-sm font-medium ${
                    isFiltered
                        ? 'border-primary bg-primary/10 text-primary dark:border-primary/50'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
                <span className="max-w-[110px] truncate">{value}</span>
                <span className="material-symbols-outlined text-[18px]">{open ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
            </button>
            {open && (
                <div className="absolute top-full mt-1.5 left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl min-w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

const CalendarHeader = ({ currentView, setCurrentView, currentMonth, currentYear, onPrev, onNext, filters, setFilters }) => {
    const [therapistsList, setTherapistsList] = useState(['All Therapists']);
    const [childrenList, setChildrenList] = useState(['All Children']);
    const [programsList, setProgramsList] = useState(['All Programs']);

    useEffect(() => {
        const load = () => {
            const t = getAllTherapists().map(t => t.name);
            const c = getAllChildren().map(c => c.name);
            const p = getAllPrograms().map(p => p.name);
            setTherapistsList(['All Therapists', ...t]);
            setChildrenList(['All Children', ...c]);
            setProgramsList(['All Programs', ...p]);
        };
        load();
        window.addEventListener('clinicDataUpdated', load);
        return () => window.removeEventListener('clinicDataUpdated', load);
    }, []);
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 gap-4 border-b border-slate-200 dark:border-slate-800 shrink-0">

            {/* Month Navigation */}
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold leading-tight tracking-[-0.015em]">Clinic Schedule</h1>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={onPrev}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        title="Previous month"
                    >
                        <span className="material-symbols-outlined text-xl">chevron_left</span>
                    </button>
                    <span className="text-base font-semibold min-w-[140px] text-center">
                        {MONTH_NAMES[currentMonth]} {currentYear}
                    </span>
                    <button
                        onClick={onNext}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                        title="Next month"
                    >
                        <span className="material-symbols-outlined text-xl">chevron_right</span>
                    </button>
                </div>
                <button
                    onClick={() => {
                        const now = new Date();
                        // handled by parent via separate callback if needed
                    }}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Jump to today"
                >
                    Today
                </button>
            </div>

            {/* Filters and View Toggles */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Filter Dropdowns */}
                <div className="flex gap-2 flex-wrap">
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
                <div className="flex h-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 p-1">
                    {['Month', 'Week', 'Day'].map((viewName) => (
                        <label key={viewName} className={`flex cursor-pointer h-full items-center justify-center rounded-md px-3 text-sm font-medium transition-all ${currentView === viewName ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
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
    );
};

export default CalendarHeader;
