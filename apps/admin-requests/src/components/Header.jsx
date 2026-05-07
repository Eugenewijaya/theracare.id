import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const Header = ({ searchValue, onSearchChange }) => {
    const navigate = useNavigate();
    const { brandColor, adminProfile } = useAdmin();
    return (
        <header className="hidden lg:flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-solid border-slate-200 dark:border-primary/20 px-4 sm:px-10 py-3 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 w-full sm:w-auto">
                <div className="flex items-center justify-between w-full sm:w-auto text-slate-900 dark:text-white shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="size-6 flex items-center justify-center shrink-0" style={{ color: brandColor }}>
                            <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                        </div>
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] line-clamp-1">Manajemen Permintaan</h2>
                    </div>
                    {/* Move avatar to right side on mobile inside this flex row */}
                    <button onClick={() => navigate('/users')} className="sm:hidden aspect-square rounded-full size-8 ring-2 font-bold" style={{ color: brandColor, backgroundColor: `${brandColor}15`, borderColor: brandColor }}>{adminProfile?.avatar || 'A'}</button>
                </div>
                <label className="flex flex-col w-full sm:min-w-40 sm:max-w-64 h-10 shrink-0">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full border border-slate-300 dark:border-primary/30 overflow-hidden">
                        <div className="text-slate-500 dark:text-primary/70 flex border-none bg-slate-50 dark:bg-primary/10 items-center justify-center pl-4 rounded-l-lg">
                            <span className="material-symbols-outlined text-lg">search</span>
                        </div>
                        <input 
                            value={searchValue || ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-slate-50 dark:bg-primary/10 focus:border-none h-full placeholder:text-slate-500 dark:placeholder:text-primary/50 px-4 pl-2 text-base font-normal leading-normal" 
                            placeholder="Cari permintaan..." 
                        />
                    </div>
                </label>
            </div>
            <div className="hidden sm:flex flex-1 justify-end gap-8 shrink-0">
                <button onClick={() => navigate('/users')} className="aspect-square rounded-full size-10 ring-2 shrink-0 font-bold" title="Manajemen Pengguna" style={{ color: brandColor, backgroundColor: `${brandColor}15`, borderColor: brandColor }}>{adminProfile?.avatar || 'A'}</button>
            </div>
        </header>
    );
};

export default Header;
