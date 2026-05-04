import React from 'react';

const TherapistCard = ({ name, id, avatar, specializations, status, statusColor, sessionsToday, inactive }) => {
    const dotColor = statusColor === 'green'
        ? 'bg-green-500'
        : statusColor === 'orange'
            ? 'bg-orange-500'
            : 'bg-slate-400';

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
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <span className="material-symbols-outlined">more_vert</span>
                </button>
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
                    <span className="text-slate-500 dark:text-slate-400"> Sessions Today</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-primary/10">
                {[
                    { icon: 'person', label: 'Profile' },
                    { icon: 'edit', label: 'Edit' },
                    { icon: 'insights', label: 'Perf' },
                ].map((action) => (
                    <button key={action.label} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary transition-colors hover:bg-slate-50 dark:hover:bg-primary/10 rounded-lg">
                        <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TherapistCard;
