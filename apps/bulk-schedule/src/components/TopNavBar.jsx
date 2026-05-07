import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const TopNavBar = () => {
    const navigate = useNavigate();
    const { clinicName, brandColor, adminProfile } = useAdmin();
    return (
        <header className="hidden lg:flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-6 py-3 bg-background-light dark:bg-background-dark z-10 shrink-0 w-full">
            <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                    <span className="material-symbols-outlined text-2xl">local_hospital</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName} Admin</h2>
            </div>
            <div className="flex flex-1 justify-end gap-8">
                <button
                    onClick={() => navigate('/users')}
                    className="flex items-center justify-center rounded-full size-10 font-bold border hover:ring-2 transition-all"
                    title="Manajemen Pengguna"
                    style={{ backgroundColor: `${brandColor}20`, color: brandColor, borderColor: `${brandColor}40` }}
                >
                    {adminProfile?.avatar || 'A'}
                </button>
            </div>
        </header>
    );
};

export default TopNavBar;
