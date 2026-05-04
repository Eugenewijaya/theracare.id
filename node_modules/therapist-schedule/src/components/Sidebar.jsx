import React from 'react';

const Sidebar = () => {
    return (
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0">
            <div className="h-20 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
                <span className="material-symbols-outlined text-primary text-3xl mr-3">medical_services</span>
                <h2 className="text-xl font-bold tracking-tight">TheraDash</h2>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold" href="#">
                    <span className="material-symbols-outlined text-xl">dashboard</span> Dashboard
                </a>
                <a className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold" href="#">
                    <span className="material-symbols-outlined text-xl">calendar_month</span> My Schedule
                </a>
                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold" href="#">
                    <span className="material-symbols-outlined text-xl">checklist</span> Attendance
                </a>
                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold" href="#">
                    <span className="material-symbols-outlined text-xl">description</span> Daily Reports
                </a>
                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold" href="#">
                    <span className="material-symbols-outlined text-xl">group</span> Patients
                </a>
                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold" href="#">
                    <span className="material-symbols-outlined text-xl">person</span> Profile
                </a>
            </nav>
        </aside>
    );
};

export default Sidebar;
