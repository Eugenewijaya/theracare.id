import React, { useState, useEffect } from 'react';
import { therapistsApi, adminApi } from '../../../shared/api/client';

const colors = {
    emerald: { border: 'border-emerald-500',  bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600' },
    blue:    { border: 'border-blue-500',     bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: 'text-blue-600'    },
    amber:   { border: 'border-amber-500',    bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: 'text-amber-600'   },
    sky:     { border: 'border-sky-500',      bg: 'bg-sky-50 dark:bg-sky-900/20',         icon: 'text-sky-600'     },
    purple:  { border: 'border-purple-500',   bg: 'bg-purple-50 dark:bg-purple-900/20',   icon: 'text-purple-600'  },
};

const DEFAULT_PROGRAM_ICONS = {
    'OT': 'accessibility_new',
    'ST': 'record_voice_over',
    'ABA': 'psychology',
    'PT': 'directions_run',
    'SSG': 'groups',
    'SI': 'waves'
};

const DEFAULT_PROGRAM_COLORS = {
    'OT': 'emerald',
    'ST': 'blue',
    'ABA': 'amber',
    'PT': 'sky',
    'SSG': 'purple',
    'SI': 'blue'
};

const ProgramForm = ({ data, onChange, errors }) => {
    const selected = data.program || '';
    const [therapists, setTherapists] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    
    useEffect(() => {
        const load = async () => {
            try {
                const [tRes, pRes] = await Promise.all([
                    therapistsApi.getAll(),
                    adminApi.getPrograms()
                ]);
                setTherapists(tRes.data?.data || []);
                setProgramsList(pRes.data?.data || []);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, []);

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">Select the therapy program for this child. This will automatically create a monitoring plan upon registration.</p>
            {programsList.map(prog => {
                const isSelected = selected === prog.name;
                const colorKey = prog.color || DEFAULT_PROGRAM_COLORS[prog.code] || 'emerald';
                const icon = prog.icon || DEFAULT_PROGRAM_ICONS[prog.code] || 'star';
                const c = colors[colorKey];
                
                return (
                    <label key={prog.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? `${c.border} ${c.bg}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/30'}`}>
                        <input type="radio" name="program" value={prog.name} checked={isSelected}
                            onChange={(e) => onChange({ ...data, program: e.target.value })} className="sr-only" />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                            <span className={`material-symbols-outlined text-[20px] ${c.icon}`}>{icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{prog.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{prog.target || prog.desc}</p>
                        </div>
                        {isSelected && <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0">check_circle</span>}
                    </label>
                );
            })}
            {errors?.program && <p className="text-xs text-red-500 mt-1">{errors.program}</p>}

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Terapis Utama (Primary Therapist) <span className="text-red-500">*</span>
                </label>
                <select
                    value={data.therapistId || ''}
                    onChange={(e) => onChange({ ...data, therapistId: e.target.value })}
                    className={`w-full h-11 px-3 rounded-lg border ${errors?.therapistId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50 appearance-none cursor-pointer`}
                >
                    <option value="">Pilih Terapis Utama...</option>
                    {therapists.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.specialty})</option>
                    ))}
                </select>
                {errors?.therapistId && <p className="text-xs text-red-500 mt-1">{errors.therapistId}</p>}
                <p className="text-xs text-slate-500 mt-2">Terapis utama akan ditetapkan sebagai terapis default untuk sesi anak ini, namun dapat diubah secara spesifik setiap sessinya.</p>
            </div>
        </div>
    );
};

export default ProgramForm;
