import React, { useState, useEffect } from 'react';
import { adminApi } from '../../../shared/api/client';

const PROGRAM_COLORS = {
    'OT': 'bg-blue-500',
    'SI': 'bg-green-500',
    'ABA': 'bg-purple-500',
    'PT': 'bg-orange-500',
    'ST': 'bg-red-500',
    'SSG': 'bg-indigo-500'
};

const Legend = () => {
    const [programs, setPrograms] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await adminApi.getPrograms();
                setPrograms(res.data?.data || []);
            } catch (e) {}
        };
        load();
    }, []);

    return (
        <div className="flex flex-wrap items-center justify-center gap-6 mt-6 shrink-0 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            {programs.map(prog => (
                <div key={prog.id} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${PROGRAM_COLORS[prog.code] || 'bg-slate-400'}`}></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{prog.name}</span>
                </div>
            ))}
            {programs.length === 0 && (
                <p className="text-xs text-slate-400 italic">No programs defined in Service Management</p>
            )}
        </div>
    );
};

export default Legend;
