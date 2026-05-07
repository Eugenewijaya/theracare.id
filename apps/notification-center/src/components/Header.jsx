import React from 'react';
import { useClinicSettings } from '../../../shared/clinicSettings';

const Header = () => {
    const { clinicName, primaryColor, logoUrl } = useClinicSettings();
    return (
        <header className="hidden lg:flex flex-col md:flex-row gap-4 items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-10 py-3 bg-white dark:bg-slate-900 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="size-8 rounded-lg text-white flex items-center justify-center overflow-hidden" style={{ backgroundColor: primaryColor }}>
                    {logoUrl ? <img src={logoUrl} alt={`${clinicName} logo`} className="w-full h-full object-contain p-1" /> : <span className="material-symbols-outlined text-2xl">medical_services</span>}
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName}</h2>
            </div>

            <div className="flex flex-1 justify-end gap-8">
                <nav className="hidden md:flex items-center gap-9">
                    <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors text-slate-600 dark:text-slate-300">Dashboard</a>
                    <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors text-slate-600 dark:text-slate-300">Patients</a>
                    <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors text-slate-600 dark:text-slate-300">Appointments</a>
                    <a href="#" className="text-sm font-bold leading-normal text-primary">Notifications</a>
                </nav>
                <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 flex-shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
                    title="User profile"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB4nvt70byybhCB77aspw6FMhnsxMSeNid7FZBfW127WUzFvL3nt97-UlAztkeupVuz2-NK1TTD9RPePCgYGsogaWvaBDW5NsSXW22dP-vgctKKJPZuWBetOSr5ckkI4OsAfoZ1kVWH63hZyGLBPZ6QHRAYSRKK7qRrmdPg7Qf2Y8NnbxzwjwGodNCk6lXjz1DwqIHRyTvevwDASMg_9SsLjE2dP6qkoXManCxIlqeTDIsjghnhr7j45EfWuhrb3n7CYOB9APHB5Q")' }}
                ></div>
            </div>
        </header>
    );
};

export default Header;
