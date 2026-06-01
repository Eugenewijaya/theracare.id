import React from 'react';
import { useNavigate } from 'react-router-dom';

const actions = [
    {
        label: 'Terapis Baru',
        description: 'Daftarkan terapis baru',
        icon: 'person_add',
        path: '/therapist-registration',
        bg: 'bg-blue-50 hover:bg-blue-100 border-blue-100',
        iconBg: 'bg-blue-600',
    },
    {
        label: 'Pengaturan Admin',
        description: 'Ubah Branding & WA Admin',
        icon: 'settings',
        path: '/settings/branding',
        bg: 'bg-slate-50 hover:bg-slate-100 border-slate-100',
        iconBg: 'bg-slate-600',
    },
    {
        label: 'Tambah Anak',
        description: 'Daftarkan pasien anak baru',
        icon: 'child_care',
        path: '/children/register',
        bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100',
        iconBg: 'bg-emerald-600',
    },
    {
        label: 'Penjadwalan Tunggal',
        description: 'Tambah atau cek sesi terapi',
        icon: 'calendar_month',
        path: '/scheduling',
        bg: 'bg-purple-50 hover:bg-purple-100 border-purple-100',
        iconBg: 'bg-purple-600',
    },
    {
        label: 'Lihat Laporan',
        description: 'Analisis & ringkasan',
        icon: 'analytics',
        path: '/reports',
        bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100',
        iconBg: 'bg-amber-500',
    },
    {
        label: 'Database Guard',
        description: 'Monitor usage & backup',
        icon: 'database',
        path: '/database-guard',
        bg: 'bg-rose-50 hover:bg-rose-100 border-rose-100',
        iconBg: 'bg-rose-600',
    },
];

const QuickActions = () => {
    const navigate = useNavigate();

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Aksi Cepat</h2>
            <div className="flex flex-col gap-2">
                {actions.map((action) => (
                    <button
                        key={action.path}
                        onClick={() => navigate(action.path)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${action.bg}`}
                    >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 ${action.iconBg}`}>
                            <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-800 leading-snug truncate">{action.label}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight truncate">{action.description}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 text-[18px] ml-auto shrink-0">chevron_right</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default QuickActions;
