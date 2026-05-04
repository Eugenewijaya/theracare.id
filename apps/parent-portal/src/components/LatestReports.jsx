import React from 'react';

const LatestReports = () => {
    return (
        <section className="mt-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">assignment</span>
                    Latest Reports
                </h3>
            </div>
            <div className="space-y-4">
                {/* Report Item 1 */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-semibold text-lg">Occupational Therapy Session</h4>
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                <span className="material-symbols-outlined text-base">calendar_today</span>
                                <span>Today, 10:00 AM</span>
                                <span>•</span>
                                <span>Dr. Emily Chen</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-400">
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg">star_half</span>
                        </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                        Leo had a fantastic session today! We focused on fine motor skills using the pegboard exercise. He showed significant improvement in his grip strength and hand-eye coordination compared to last week...
                    </p>
                    <a href="#" className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                        Read Full Report <span className="material-symbols-outlined text-sm ml-1">chevron_right</span>
                    </a>
                </div>

                {/* Report Item 2 */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-semibold text-lg">Speech Therapy Session</h4>
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                <span className="material-symbols-outlined text-base">calendar_today</span>
                                <span>Oct 24, 2:30 PM</span>
                                <span>•</span>
                                <span>Sarah Jenkins, SLP</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-400">
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                            <span className="material-symbols-outlined text-lg fill-current">star</span>
                        </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                        Great progress on articulation of 'R' sounds today. We used visual aids and Leo was very engaged. We also practiced turn-taking during conversation exercises which he handled very well.
                    </p>
                    <a href="#" className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                        Read Full Report <span className="material-symbols-outlined text-sm ml-1">chevron_right</span>
                    </a>
                </div>
            </div>
        </section>
    );
};

export default LatestReports;
