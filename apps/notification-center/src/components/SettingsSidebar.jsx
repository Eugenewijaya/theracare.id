import React from 'react';

const deliveryGroups = [
    'Schedule Changes',
    'New Registrations',
    'Reports & Documents',
];

const ChannelBadge = ({ icon, label, tone = 'primary' }) => {
    const toneClass = {
        primary: 'bg-primary/10 text-primary ring-primary/20',
        success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
        muted: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    }[tone] || 'bg-primary/10 text-primary ring-primary/20';

    return (
        <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${toneClass}`}>
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
            {label}
        </span>
    );
};

const SettingsSidebar = () => {
    return (
        <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <span className="material-symbols-outlined text-primary text-xl">mark_email_read</span>
                    <h3 className="min-w-0 text-lg font-bold leading-tight">Delivery Channels</h3>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Pengumuman saat ini dikirim sebagai notifikasi in-app. Email template center sedang dalam pengembangan dan akan diaktifkan setelah domain pengirim resmi siap.
                </p>

                <div className="flex flex-col gap-5">
                    {deliveryGroups.map((group, index) => (
                        <React.Fragment key={group}>
                            {index > 0 && <hr className="border-slate-200 dark:border-slate-800" />}
                            <div className="flex min-w-0 flex-col gap-3">
                                <h4 className="text-sm font-semibold leading-tight">{group}</h4>
                                <div className="flex flex-wrap gap-2">
                                    <ChannelBadge icon="notifications_active" label="In-App Aktif" />
                                    <ChannelBadge icon="mail" label="Email Dalam Pengembangan" tone="muted" />
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950/40 dark:text-slate-400 dark:ring-slate-800">
                    SMS tidak digunakan. Email juga dimatikan sementara, jadi semua penerima tetap mendapatkan notifikasi melalui portal masing-masing.
                </div>
            </div>
        </aside>
    );
};

export default SettingsSidebar;
