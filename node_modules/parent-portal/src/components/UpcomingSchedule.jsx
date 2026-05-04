import React from 'react';

const UpcomingSchedule = () => {
    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">event_upcoming</span>
                    Upcoming Schedule
                </h3>
                <button className="text-slate-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">more_horiz</span>
                </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Schedule Item 1 */}
                <div className="p-5 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                    <div className="flex flex-col items-center justify-center w-12 h-14 rounded-lg bg-primary/10 text-primary shrink-0 border border-primary/20">
                        <span className="text-xs font-bold uppercase tracking-wider">Oct</span>
                        <span className="text-lg font-extrabold leading-none">28</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors">Speech Therapy</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            2:30 PM - 3:30 PM
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[14px]">meeting_room</span>
                            Room 2B (East Wing)
                        </div>
                    </div>
                </div>

                {/* Schedule Item 2 */}
                <div className="p-5 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                    <div className="flex flex-col items-center justify-center w-12 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold uppercase tracking-wider">Oct</span>
                        <span className="text-lg font-extrabold leading-none">30</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors">Occupational Therapy</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            10:00 AM - 11:00 AM
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[14px]">meeting_room</span>
                            Sensory Gym
                        </div>
                    </div>
                </div>

                {/* Schedule Item 3 */}
                <div className="p-5 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                    <div className="flex flex-col items-center justify-center w-12 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold uppercase tracking-wider">Nov</span>
                        <span className="text-lg font-extrabold leading-none">02</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors">Parent Consultation</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            4:00 PM - 4:45 PM
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[14px]">videocam</span>
                            Virtual Link
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                <button className="w-full py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    View Full Calendar
                </button>
            </div>
        </div>
    );
};

export default UpcomingSchedule;
