import React from 'react';

const Sidebar = () => {
    return (
        <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a262d] flex flex-col justify-between h-full">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex gap-3 mb-6 items-center">
                    <div className="bg-primary/20 bg-cover bg-center rounded-full size-10 flex items-center justify-center text-primary font-bold text-lg" title="Clinic Logo">
                        TC
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-slate-900 dark:text-slate-100 text-base font-medium leading-normal">Therapy Clinic</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Therapist Portal</p>
                    </div>
                </div>

                <nav className="flex flex-col gap-2">
                    <a href="/" className="flex items-center gap-3 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[24px]">dashboard</span>
                        <p className="text-sm font-medium leading-normal">Dashboard</p>
                    </a>
                    <a href="/schedule" className="flex items-center gap-3 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[24px]">calendar_month</span>
                        <p className="text-sm font-medium leading-normal">Schedule</p>
                    </a>
                    <a href="/reports" className="flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-lg" aria-current="page">
                        <span className="material-symbols-outlined fill text-[24px]">description</span>
                        <p className="text-sm font-medium leading-normal">Reports</p>
                    </a>
                    <a href="/child-progress" className="flex items-center gap-3 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[24px]">group</span>
                        <p className="text-sm font-medium leading-normal">Patients</p>
                    </a>
                </nav>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <a href="/settings" className="flex items-center gap-3 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[24px]">settings</span>
                    <p className="text-sm font-medium leading-normal">Settings</p>
                </a>
            </div>
        </aside>
    );
};

export default Sidebar;
