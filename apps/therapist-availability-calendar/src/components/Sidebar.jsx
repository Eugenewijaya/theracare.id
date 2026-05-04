import React from 'react';

const Sidebar = () => {
    return (
        <aside className="w-64 flex-shrink-0 border-r border-primary/20 bg-background-light dark:bg-background-dark flex flex-col justify-between h-full">
            <div className="p-4 flex flex-col gap-6 overflow-y-auto">
                <div className="flex items-center gap-3 mb-4">
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 shadow-sm border border-primary/20"
                        title="Therapist Profile Picture"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC60Seusk_PN7355PKi1mJttT17Nd7KEWj2AdktgPKFTP5XyRsLzlAOvLkM5KaH2zt6EJdiZfVEaNxxC6EaZJzi4dtHoQQ3swlUBWat5mz4zmAg5xyR0Oz1Ixce4_XJtBYhvwzPYyf4hoC2TIarN1f0UsmFWnlBC74TkUqZWLBdMEz8O0Yyko6parJSpC7dWlFukgdhwB8T77lFvXralGEeE2tkFHxX2m6dxCrA_O7LcCFnhTm-Gbvx2VTsfWF90tuwk9ORqibGnA")' }}
                    ></div>
                    <div className="flex flex-col">
                        <h1 className="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight">Dr. Smith</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">Therapist</p>
                    </div>
                </div>

                <nav className="flex flex-col gap-2">
                    <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-[24px]">home</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/20 text-primary dark:text-primary">
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                        <span className="text-sm font-medium">Calendar</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-[24px]">group</span>
                        <span className="text-sm font-medium">Patients</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-[24px]">settings</span>
                        <span className="text-sm font-medium">Settings</span>
                    </a>
                </nav>
            </div>

            <div className="p-4 border-t border-primary/20">
                <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-primary/10 transition-colors">
                    <span className="material-symbols-outlined text-[24px]">logout</span>
                    <span className="text-sm font-medium">Log Out</span>
                </a>
            </div>
        </aside>
    );
};

export default Sidebar;
