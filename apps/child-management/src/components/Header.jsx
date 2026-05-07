import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const Header = () => {
    const navigate = useNavigate();
    const { clinicName, brandColor, adminProfile } = useAdmin();
    return (
        <header className="hidden lg:flex flex-col md:flex-row items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-4 md:px-10 py-3 mb-6 gap-4 w-full">
            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start">
                <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                    <div className="size-6" style={{ color: brandColor }}>
                        <span className="material-symbols-outlined text-2xl">medical_services</span>
                    </div>
                    <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-[-0.015em]">{clinicName}</h2>
                </div>
                <label className="hidden md:flex flex-col min-w-40 !h-10 max-w-64">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                        <div className="text-slate-500 dark:text-slate-400 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg border-r-0">
                            <span className="material-symbols-outlined">search</span>
                        </div>
                        <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-0 border-none bg-slate-100 dark:bg-slate-800 focus:border-none h-full placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" placeholder="Search" />
                    </div>
                </label>
            </div>
            <div className="flex flex-1 justify-end gap-8 w-full md:w-auto">
                <button onClick={() => navigate('/users')} className="aspect-square rounded-full size-10 border-2 font-bold" title="Manajemen Pengguna" style={{ color: brandColor, backgroundColor: `${brandColor}15`, borderColor: `${brandColor}40` }}>{adminProfile?.avatar || 'A'}</button>
            </div>
        </header>
    );
};

export default Header;
