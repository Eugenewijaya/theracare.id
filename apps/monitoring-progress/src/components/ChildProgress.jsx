import React from 'react';

const ChildProgress = ({ store }) => {
    // Collect stats from store
    const children = store?.children || [];
    const sessions = store?.sessions || [];
    
    if (children.length === 0) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Pergres Anak (Data Kosong)</h2>
                </div>
                <p className="text-slate-500">Belum ada anak yang terdaftar di klinik.</p>
            </div>
        );
    }

    // Calculate per-child sessions
    const progressData = children.map(child => {
        const childSessions = sessions.filter(s => s.childId === child.id);
        const completed = childSessions.filter(s => s.status === 'done' || s.status === 'completed').length;
        const total = childSessions.length;
        
        let primaryProgram = 'General Therapy';
        if (child.programs && child.programs.length > 0) {
            primaryProgram = child.programs.map(p => p.name || p).join(', ');
        } else if (child.program) {
            primaryProgram = child.program;
        }

        const percentage = total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;
        
        const name = child.name || `${child.firstName} ${child.lastName}`;
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'C';

        return { id: child.id, name, initials, program: primaryProgram, completed, total, percentage };
    }).sort((a, b) => b.percentage - a.percentage).slice(0, 5); // Show top 5 progressing children

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Progres Anak</h2>
            </div>
            <div className="flex flex-col gap-4">
                {progressData.map(data => {
                    const isCritical = data.percentage >= 90;
                    const bgClass = isCritical ? 'bg-red-500/10 border-red-500/30' : 'bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark';
                    const iconBg = isCritical ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500';
                    const textName = isCritical ? 'text-red-500' : 'text-slate-900 dark:text-slate-100';
                    const textSec = isCritical ? 'text-red-400' : 'text-text-light-secondary dark:text-text-dark-secondary';
                    const barColor = isCritical ? 'bg-red-500' : 'bg-primary';

                    return (
                        <div key={data.id} className={`flex flex-col gap-4 p-4 rounded-lg border sm:flex-row sm:items-center sm:justify-between ${bgClass}`}>
                            <div className="flex min-w-0 items-center gap-4">
                                <div className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center font-bold text-lg ${iconBg}`}>{data.initials}</div>
                                <div className="min-w-0">
                                    <p className={`break-words font-medium text-base ${textName}`}>{data.name}</p>
                                    <p className={`break-words text-sm ${textSec}`}>{data.program} - {data.completed}/{data.total} sesi</p>
                                </div>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-1/3 sm:items-end">
                                <div className="w-full bg-border-light dark:bg-border-dark rounded-full h-2">
                                    <div className={`${barColor} h-2 rounded-full`} style={{ width: `${data.percentage}%` }}></div>
                                </div>
                                <span className={`text-sm font-medium sm:text-right ${textSec}`}>
                                    {data.percentage}% Selesai {isCritical && `- ${(data.total - data.completed)} Sisa`}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChildProgress;
