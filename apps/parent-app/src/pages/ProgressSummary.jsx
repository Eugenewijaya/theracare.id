import React, { useState, useEffect } from 'react';
import { childrenApi } from '../../../shared/api/client';

export default function ProgressSummary() {
    const [children, setChildren] = useState([]);

    useEffect(() => {
        const load = async () => {
            const saved = sessionStorage.getItem('parent_user');
            if (!saved) return;
            const user = JSON.parse(saved);
            const parentId = user.parentId;
            if (!parentId) return;

            try {
                const res = await childrenApi.getByParent(parentId);
                setChildren(res.data?.data || []);
            } catch(e) {}
        };
        load();
    }, []);

    // Helper to get initials
    const getInitials = (name) => {
        if (!name) return 'CH';
        const parts = name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900">
            {/* Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <span className="material-symbols-outlined text-3xl text-sky-500">monitoring</span>
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Child Progress Summary</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ikhtisar persentase penyelesaian sesi terapi.</p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm">
                        
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Per-Program Progress Tracking</h2>
                        </div>

                        <div className="flex flex-col gap-4">
                            {children.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    <span className="material-symbols-outlined text-4xl mb-2">child_friendly</span>
                                    <p>Belum ada anak yang terdaftar.</p>
                                </div>
                            ) : (
                                children.map(child => (
                                    <React.Fragment key={child.id}>
                                        {(!child.periods || child.periods.length === 0) && (!child.therapyPrograms || child.therapyPrograms.length === 0) && (
                                            <div className="flex items-center justify-between p-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-slate-500/20 text-slate-500 flex items-center justify-center font-bold text-lg">
                                                        {getInitials(child.name)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-base">{child.name}</p>
                                                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-sm">Belum ada program aktif</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {(child.periods?.length ? child.periods : child.therapyPrograms || []).map((prog, idx) => {
                                            const total = prog.totalSessions || 1;
                                            const completed = prog.completedSessions ?? prog.sessionsCompleted ?? 0;
                                            const pct = prog.progress ?? Math.min(100, Math.round((completed / total) * 100));
                                            
                                            // Matching identical visual styles to therapist's dashboard
                                            // Blue for regular, Red for Critical (>90% or defined so)
                                            let bgCard = "bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark";
                                            let textName = "text-text-light-primary dark:text-text-dark-primary";
                                            let textSub = "text-text-light-secondary dark:text-text-dark-secondary";
                                            let bgAvatar = idx % 2 === 0 ? "bg-blue-500/20 text-blue-500" : "bg-purple-500/20 text-purple-500";
                                            let barColor = idx % 2 === 0 ? "bg-primary" : "bg-blue-400";
                                            
                                            if (pct > 90) {
                                                bgCard = "bg-red-500/10 border-red-500/30";
                                                textName = "text-red-500";
                                                textSub = "text-red-400";
                                                bgAvatar = "bg-red-500/20 text-red-500";
                                                barColor = "bg-red-500";
                                            }

                                            return (
                                                <div key={`${child.id}-${idx}`} className={`flex items-center justify-between p-4 rounded-lg border ${bgCard}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${bgAvatar}`}>
                                                            {getInitials(child.name)}
                                                        </div>
                                                        <div>
                                                            <p className={`font-medium text-base ${textName}`}>{child.name}</p>
                                                            <p className={`text-sm ${textSub}`}>{prog.programName || prog.type || prog.name} - {completed}/{total} sessions</p>
                                                            {prog.name && <p className={`text-xs ${textSub}`}>{prog.name}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 w-1/3">
                                                        <div className="w-full bg-border-light dark:bg-border-dark rounded-full h-2">
                                                            <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                        <span className={`text-sm font-medium ${pct > 90 ? 'text-red-400' : 'text-text-light-secondary dark:text-text-dark-secondary'}`}>
                                                            {pct}% Complete {pct > 90 && `- ${total - completed} Left`}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
