import React from 'react';

const navItems = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'branding', label: 'Branding', icon: 'palette' },
    { id: 'schedule', label: 'Jadwal Off', icon: 'event_busy' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
];

const Sidebar = ({ activeSection, onSectionChange }) => {
    return (
        <aside className="w-64 shrink-0 flex flex-col gap-6 hidden md:flex pb-20">
            <div className="flex gap-3 items-center">
                <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 shadow-sm"
                    title="Clinic building logo icon"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuABLapYY7o16LlpiNy42xaFxCAMJ-uR3UJGr_1vJJ1V21JI1R9752vaY_ybXXn2oqeYOUQS0HxjkodKDgPqinev0D2NulHKMVFidNtHKTZxw6h_BKMskUTHtvLRXJYab7n660H2tGP2bAjRswbPuXqKIYPW6em4YBX-XCnDszpKeN9YlO96iXPJ6lJCrgW51tmHLeXv8aoFDjCMA4YkJX_i_Q5U9xoQzVIX6b-LI3DPs7KoJIm8GSCWV6Yt07D9Yp0_UI3vQE5iTg")' }}
                ></div>
                <div className="flex flex-col">
                    <h1 className="text-base font-bold leading-normal">Global Settings</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-normal">Manage configurations</p>
                </div>
            </div>

            <nav className="flex flex-col gap-1">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full ${activeSection === item.id
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                        }`}
                    >
                        <span className={`material-symbols-outlined text-[20px] ${activeSection === item.id ? 'fill-current' : ''}`}>{item.icon}</span>
                        <span className="text-sm leading-normal">{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;
