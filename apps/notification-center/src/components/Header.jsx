import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicSettings } from '../../../shared/clinicSettings';

const Header = ({ user }) => {
    const navigate = useNavigate();
    const { clinicName, primaryColor, logoUrl } = useClinicSettings();
    const profileImage = user?.image || user?.avatar || '';
    const initials = (user?.name || user?.email || 'A').charAt(0).toUpperCase();
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
                <button
                    type="button"
                    onClick={() => navigate('/users')}
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 flex-shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-sm font-black flex items-center justify-center overflow-hidden"
                    title={user?.name || user?.email || 'Profil admin'}
                    style={profileImage ? { backgroundImage: `url("${profileImage}")` } : { color: primaryColor }}
                >
                    {!profileImage && initials}
                </button>
            </div>
        </header>
    );
};

export default Header;
