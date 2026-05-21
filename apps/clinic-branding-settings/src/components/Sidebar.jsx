import React from 'react';
import { useClinicSettings } from '../../../shared/clinicSettings';
import ClinicLogoMark from '../../../shared/ui/ClinicLogoMark';

const navItems = [
    { id: 'general', label: 'Umum', icon: 'settings' },
    { id: 'branding', label: 'Branding', icon: 'palette' },
    { id: 'schedule', label: 'Jadwal Off', icon: 'event_busy' },
    { id: 'notifications', label: 'Notifikasi', icon: 'notifications' },
    { id: 'language', label: 'Bahasa', icon: 'translate' },
];

const Sidebar = ({ activeSection, onSectionChange }) => {
    const { clinicName, primaryColor, logoUrl } = useClinicSettings();

    return (
        <aside className="w-64 shrink-0 flex flex-col gap-6 hidden md:flex pb-20">
            <div className="flex gap-3 items-center">
                <ClinicLogoMark logoUrl={logoUrl} name={clinicName} color={primaryColor} className="size-12 rounded-full shadow-sm" />
                <div className="flex flex-col">
                    <h1 className="text-base font-bold leading-normal">Pengaturan Global</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-normal">Kelola konfigurasi</p>
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
