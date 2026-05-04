import React from 'react';

const ActivePrograms = () => {
    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">local_activity</span>
                    Active Programs
                </h3>
                <a href="#" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center">
                    View all <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
                </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Program Card 1 */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <span className="material-symbols-outlined">extension</span>
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg">Occupational Therapy</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Dr. Emily Chen</p>
                            </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            On Track
                        </span>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">Progress</span>
                            <span className="font-bold text-primary">60%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: '60%' }}></div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-right">12 of 20 sessions completed</p>
                    </div>
                </div>

                {/* Program Card 2 */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <span className="material-symbols-outlined">record_voice_over</span>
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg">Speech Therapy</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Sarah Jenkins, SLP</p>
                            </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            On Track
                        </span>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">Progress</span>
                            <span className="font-bold text-primary">30%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: '30%' }}></div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-right">6 of 20 sessions completed</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ActivePrograms;
