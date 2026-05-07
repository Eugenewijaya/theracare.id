import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const Header = () => {
    const navigate = useNavigate();
    const { clinicName, brandColor, adminProfile } = useAdmin();
    return (
        <header className="bg-white dark:bg-[#1a2235] border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                    <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight">{clinicName} Attendance Approval</h1>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 pl-6">
                    <button onClick={() => navigate('/notifications')} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Pusat Notifikasi">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <button onClick={() => navigate('/users')} className="w-9 h-9 rounded-full border-2 cursor-pointer font-bold" title="Manajemen Pengguna" style={{ backgroundColor: `${brandColor}20`, color: brandColor, borderColor: `${brandColor}40` }}>
                        {adminProfile?.avatar || 'A'}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
