import React, { useState, useEffect } from 'react';
import { getRecentActivityForTherapist } from '../../../shared/clinicDataStore';

const formatActivityTime = (timeStr) => {
    if (!timeStr) return '';
    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Format: "2026-04-16 at 10:00"
    if (timeStr.includes(' at ')) {
        const [datePart, timePart] = timeStr.split(' at ');
        if (datePart === today)     return `Today at ${timePart}`;
        if (datePart === tomorrow)  return `Tomorrow at ${timePart}`;
        if (datePart === yesterday) return `Yesterday at ${timePart}`;
        return timeStr;
    }

    // Plain date
    if (timeStr === today)     return 'Today';
    if (timeStr === yesterday) return 'Yesterday';
    return timeStr;
};

const RecentActivity = () => {
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        const fetchActivities = () => {
            const userStr = sessionStorage.getItem('therapist_user');
            const user    = userStr ? JSON.parse(userStr) : null;
            const nit     = user?.id || 'SARAH260411001';
            const data    = getRecentActivityForTherapist(nit, 5);
            setActivities(data);
        };

        fetchActivities();
        window.addEventListener('clinicDataUpdated', fetchActivities);
        return () => window.removeEventListener('clinicDataUpdated', fetchActivities);
    }, []);

    return (
        <div className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mb-5 flex items-center gap-2 uppercase tracking-widest">
                <span className="material-symbols-outlined text-[18px] text-teal-500">notifications_active</span>
                Recent Activity
            </h3>

            {activities.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-slate-400 dark:text-slate-600 text-center">
                    <span className="material-symbols-outlined text-3xl opacity-50">event_note</span>
                    <p className="text-xs font-semibold">No recent activity yet.</p>
                    <p className="text-xs">Activities will appear once sessions are scheduled.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {activities.map((activity, i) => (
                        <div key={i} className="flex gap-4 items-start group cursor-pointer">
                            <div className={`w-10 h-10 rounded-full ${activity.iconBg} ${activity.iconColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
                                <span className="material-symbols-outlined text-[18px]">{activity.icon}</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-snug">
                                    {activity.message}{' '}
                                    <span className="font-extrabold text-slate-900 dark:text-white">{activity.highlight}</span>
                                </p>
                                {activity.focus && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic truncate max-w-[180px]">{activity.focus}</p>
                                )}
                                <p className="text-xs font-medium text-slate-500 mt-1">{formatActivityTime(activity.time)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecentActivity;
