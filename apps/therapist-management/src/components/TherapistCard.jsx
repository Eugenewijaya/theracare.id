import React, { useEffect, useRef, useState } from 'react';

const TherapistCard = ({ name, id, avatar, specializations, status, statusColor, sessionsToday, inactive, onDelete, onEdit, onView, onPerformance }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const dotColor = statusColor === 'green'
        ? 'bg-green-500'
        : statusColor === 'orange'
            ? 'bg-orange-500'
            : 'bg-slate-400';

    useEffect(() => {
        if (!menuOpen) return undefined;
        const handleClickOutside = (event) => {
            if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    return (
        <div className={`bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/20 rounded-xl p-5 flex flex-col hover:border-primary/50 transition-colors ${inactive ? 'opacity-75' : ''}`}>
            {/* Top Row */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex gap-4 items-center">
                    <div
                        className={`w-14 h-14 rounded-full bg-cover bg-center border-2 border-primary/30 ${inactive ? 'grayscale' : ''}`}
                        title={name}
                        style={{ backgroundImage: `url('${avatar}')` }}
                    ></div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">NIT: {id}</p>
                    </div>
                </div>
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen(open => !open)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-primary/10 dark:hover:text-slate-200"
                        aria-label={`Buka menu ${name}`}
                        aria-expanded={menuOpen}
                    >
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                            <button
                                type="button"
                                onClick={() => { setMenuOpen(false); onView?.(id); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span className="material-symbols-outlined text-[17px]">person</span>
                                Lihat Profil
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMenuOpen(false); onEdit?.(id); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span className="material-symbols-outlined text-[17px]">edit</span>
                                Edit Terapis
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMenuOpen(false); onDelete?.({ id, name }); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                                <span className="material-symbols-outlined text-[17px]">delete</span>
                                Hapus
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Specialization Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
                {specializations.map((spec, i) => (
                    <span key={i} className="bg-slate-100 dark:bg-primary/10 text-slate-700 dark:text-primary text-xs font-semibold px-2.5 py-1 rounded-md">{spec}</span>
                ))}
            </div>

            {/* Status & Sessions */}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-primary/10">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                    <span className={`text-sm font-medium ${inactive ? 'text-slate-700 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{status}</span>
                </div>
                <div className="text-sm">
                    <span className="font-bold text-slate-900 dark:text-white">{sessionsToday}</span>
                    <span className="text-slate-500 dark:text-slate-400"> Sesi Hari Ini</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-primary/10">
                {[
                    { icon: 'person', label: 'Profil' },
                    { icon: 'edit', label: 'Edit' },
                    { icon: 'insights', label: 'Kinerja' },
                ].map((action) => (
                    <button
                        key={action.label}
                        onClick={() => action.label === 'Profil' ? onView?.(id) : action.label === 'Edit' ? onEdit?.(id) : onPerformance?.(id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary transition-colors hover:bg-slate-50 dark:hover:bg-primary/10 rounded-lg"
                    >
                        <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TherapistCard;
