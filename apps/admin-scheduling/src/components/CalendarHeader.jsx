import React, { useState, useRef, useEffect } from 'react';
import { therapistsApi, childrenApi, adminApi } from '../../../shared/api/client';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const OPTION_LABELS = {
    'All Therapists': 'Semua Terapis',
    'All Children': 'Semua Anak',
    'All Programs': 'Semua Program',
};

const VIEW_LABELS = {
    Month: 'Bulan',
    Week: 'Minggu',
    Day: 'Hari',
};

function displayOption(value) {
    return OPTION_LABELS[value] || value;
}

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
                className={`flex h-10 w-full items-center justify-between gap-x-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:h-9 sm:w-auto sm:justify-center ${
                    isFiltered
                        ? 'border-primary bg-primary/10 text-primary dark:border-primary/50'
                        : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
            >
                <span className="max-w-[180px] truncate sm:max-w-[120px]">{displayOption(value)}</span>
                <span className="material-symbols-outlined text-[18px]">{open ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
            </button>
            {open && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl duration-150 animate-in fade-in zoom-in-95 dark:border-slate-700 dark:bg-slate-900 sm:w-auto">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onChange(opt); setOpen(false); }}
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                                value === opt
                                    ? 'bg-primary/10 font-semibold text-primary'
                                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                        >
                            {value === opt && <span className="material-symbols-outlined text-[16px]">check</span>}
                            {value !== opt && <span className="inline-block w-4" />}
                            <span>{displayOption(opt)}</span>
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
        <div className="flex shrink-0 flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
            <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
                    <h1 className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:whitespace-nowrap">Jadwal Terapi</h1>
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:flex-none">
                            <button
                                onClick={onPrev}
                                className="shrink-0 rounded p-1 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                                title="Bulan sebelumnya"
                            >
                                <span className="material-symbols-outlined text-xl">chevron_left</span>
                            </button>
                            <span className="min-w-0 flex-1 truncate px-2 text-center text-base font-semibold sm:min-w-[140px]">
                                {MONTH_NAMES[currentMonth]} {currentYear}
                            </span>
                            <button
                                onClick={onNext}
                                className="shrink-0 rounded p-1 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                                title="Bulan berikutnya"
                            >
                                <span className="material-symbols-outlined text-xl">chevron_right</span>
                            </button>
                        </div>
                        <button
                            onClick={onToday}
                            className="h-10 shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 sm:h-9"
                            title="Lompat ke hari ini"
                        >
                            Hari ini
                        </button>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
                    <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3 xl:flex xl:flex-wrap">
                        <FilterDropdown
                            label="Terapis"
                            options={therapistsList}
                            value={filters.therapist}
                            onChange={v => setFilters(f => ({ ...f, therapist: v }))}
                        />
                        <FilterDropdown
                            label="Anak"
                            options={childrenList}
                            value={filters.child}
                            onChange={v => setFilters(f => ({ ...f, child: v }))}
                        />
                        <FilterDropdown
                            label="Program"
                            options={programsList}
                            value={filters.program}
                            onChange={v => setFilters(f => ({ ...f, program: v }))}
                        />
                    </div>

                    <div className="flex h-10 w-full items-center justify-center rounded-lg bg-slate-200 p-1 dark:bg-slate-800 sm:h-9 sm:w-auto">
                        {['Month', 'Week', 'Day'].map((viewName) => (
                            <label key={viewName} className={`flex h-full flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-all sm:flex-none ${currentView === viewName ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                                <span>{VIEW_LABELS[viewName]}</span>
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
