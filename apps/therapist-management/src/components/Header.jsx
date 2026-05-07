import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const Header = ({ searchValue, onSearchChange }) => {
    const navigate = useNavigate();
    const { clinicName, brandColor, adminProfile } = useAdmin();
    return (
        <header className="hidden lg:flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-solid border-slate-200 dark:border-primary/20 px-10 py-3 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                    <div className="size-6 flex items-center justify-center" style={{ color: brandColor }}>
                        <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                    </div>
                    <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName} Admin</h2>
                </div>
                <label className="flex flex-col min-w-40 !h-10 max-w-64">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full border border-slate-300 dark:border-primary/30 overflow-hidden">
                        <div className="text-slate-500 dark:text-primary/70 flex border-none bg-slate-50 dark:bg-primary/10 items-center justify-center pl-4 rounded-l-lg">
                            <span className="material-symbols-outlined text-lg">search</span>
                        </div>
                        <input 
                            value={searchValue || ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-slate-50 dark:bg-primary/10 focus:border-none h-full placeholder:text-slate-500 dark:placeholder:text-primary/50 px-4 pl-2 text-base font-normal leading-normal" 
                            placeholder="Search therapists..." 
                        />
                    </div>
                </label>
            </div>
            <div className="flex flex-1 justify-end gap-8">
                <button onClick={() => navigate('/users')} className="aspect-square rounded-full size-10 ring-2 font-bold" title="Manajemen Pengguna" style={{ color: brandColor, backgroundColor: `${brandColor}15`, borderColor: brandColor }}>{adminProfile?.avatar || 'A'}</button>
            </div>
        </header>
    );
};

export default Header;
