import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const TopNavBar = ({ onAddSingleSchedule }) => {
    const navigate = useNavigate();
    const { clinicName, brandColor, adminProfile } = useAdmin();
    const [showNewSchedule, setShowNewSchedule] = useState(false);

    return (
        <>
            <header className="flex flex-col gap-3 border-b border-solid border-slate-200 bg-background-light px-4 py-3 dark:border-slate-800 dark:bg-background-dark sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3 text-slate-900 dark:text-slate-100">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg p-1" style={{ backgroundColor: `${brandColor}20`, color: brandColor }}>
                        <span className="material-symbols-outlined text-xl">local_hospital</span>
                    </div>
                    <h2 className="min-w-0 truncate text-base font-bold leading-tight sm:text-lg">{clinicName || 'Therapy Center'} - Penjadwalan</h2>
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
                        <button
                            onClick={() => setShowNewSchedule(true)}
                            className="flex h-10 min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg px-3 text-sm font-bold leading-normal text-white transition-opacity hover:opacity-90 sm:min-w-[120px] sm:px-4"
                            style={{ backgroundColor: brandColor }}
                        >
                            <span className="material-symbols-outlined mr-2 text-lg">info</span>
                            <span className="truncate">Panduan</span>
                        </button>
                        <button
                            onClick={onAddSingleSchedule}
                            className="flex h-10 min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-200 px-3 text-sm font-bold leading-normal text-slate-900 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:min-w-[120px] sm:px-4"
                        >
                            <span className="material-symbols-outlined mr-2 text-lg">library_add</span>
                            <span className="truncate">Tambah Jadwal</span>
                        </button>
                    </div>

                    <button
                        onClick={() => navigate('/users')}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 font-bold transition-all hover:ring-2 dark:border-slate-700"
                        title="Manajemen Pengguna"
                        style={{ backgroundColor: `${brandColor}20`, color: brandColor, borderColor: `${brandColor}40` }}
                    >
                        {adminProfile?.avatar || 'A'}
                    </button>
                </div>
            </header>

            {showNewSchedule && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setShowNewSchedule(false)}>
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                            <span className="material-symbols-outlined text-3xl text-primary">touch_app</span>
                        </div>
                        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Tambah Jadwal Baru</h3>
                        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
                            Klik tanggal di kalender untuk membuka detail sesi di panel kanan, lalu gunakan tombol Tambah Jadwal di panel tersebut.
                        </p>
                        <button onClick={() => setShowNewSchedule(false)} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90">
                            Mengerti
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default TopNavBar;
