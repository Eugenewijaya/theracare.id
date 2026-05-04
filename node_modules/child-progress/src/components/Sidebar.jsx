import React from 'react';

const sidebarNav = [
    { icon: 'pie_chart', label: 'Overview', active: false },
    { icon: 'monitoring', label: 'Progress Details', active: true },
    { icon: 'groups', label: 'Therapy Team', active: false },
    { icon: 'history', label: 'Session History', active: false },
    { icon: 'folder', label: 'Documents', active: false },
];

const Sidebar = () => {
    return (
        <aside className="w-full lg:w-64 flex flex-col gap-6 shrink-0">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-border-light dark:border-slate-700 flex flex-col gap-2">
                {sidebarNav.map((item) => (
                    <div key={item.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${item.active
                            ? 'bg-secondary dark:bg-primary/20 text-primary-content dark:text-primary'
                            : 'text-secondary-content dark:text-slate-400 hover:bg-secondary dark:hover:bg-slate-700'
                        }`}>
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <p className={`text-sm leading-normal ${item.active ? 'font-bold' : 'font-medium'}`}>{item.label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-border-light dark:border-slate-700 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-secondary-content dark:text-slate-400 uppercase tracking-wider">Quick Actions</h3>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-primary-content text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                    Progress PDF
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg h-10 px-4 border border-primary text-primary text-sm font-bold hover:bg-primary/10 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>event</span>
                    Schedule Meeting
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg h-10 px-4 border border-border-light dark:border-slate-600 text-primary-content dark:text-slate-200 text-sm font-bold hover:bg-secondary dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                    Edit Profile
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
