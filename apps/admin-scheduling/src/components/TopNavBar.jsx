import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const TopNavBar = () => {
    const navigate = useNavigate();
    const { clinicName, brandColor, adminProfile } = useAdmin();
    const [showNewSchedule, setShowNewSchedule] = useState(false);

    return (
        <>
        <header className="hidden lg:flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-6 py-3 bg-background-light dark:bg-background-dark z-10 shrink-0 w-full">

            {/* Brand */}
            <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                <div className="size-8 rounded-lg flex items-center justify-center p-1" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                    <span className="material-symbols-outlined text-xl">local_hospital</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName || 'Therapy Center'} — Penjadwalan</h2>
            </div>

            <div className="flex flex-1 justify-end gap-8">
                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowNewSchedule(true)}
                        className="flex min-w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 text-white text-sm font-bold leading-normal tracking-[0.015em] hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: brandColor }}
                    >
                        <span className="material-symbols-outlined text-lg mr-2">info</span>
                        <span className="truncate">Cara Tambah Jadwal</span>
                    </button>
                    <button 
                        onClick={() => navigate('/bulk-schedule')}
                        className="flex min-w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg mr-2">library_add</span>
                        <span className="truncate">Jadwal Massal</span>
                    </button>
                </div>

                {/* Profile */}
                <button
                    onClick={() => navigate('/users')}
                    className="flex items-center justify-center rounded-full size-10 font-bold border border-slate-200 dark:border-slate-700 hover:ring-2 transition-all"
                    title="Manajemen Pengguna"
                    style={{ backgroundColor: `${brandColor}20`, color: brandColor, borderColor: `${brandColor}40` }}
                >
                    {adminProfile?.avatar || 'A'}
                </button>
            </div>
        </header>

        {/* "New Schedule" info modal - directs user to use calendar click */}
        {showNewSchedule && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowNewSchedule(false)}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-3xl">touch_app</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Tambah Jadwal Baru</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                        Klik pada tanggal di kalender untuk menambahkan sesi baru pada tanggal tersebut.
                    </p>
                    <button onClick={() => setShowNewSchedule(false)} className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors">
                        Mengerti
                    </button>
                </div>
            </div>
        )}
        </>
    );
};

export default TopNavBar;
