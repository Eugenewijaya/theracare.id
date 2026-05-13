import React from 'react';

const formatCurrency = (value) => {
    const amount = Number(value || 0);
    if (!amount) return 'Harga belum diset';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};

const ReviewStep = ({ parentData, childrenList, onAddAnother, isExistingParent }) => (
    <div className="flex flex-col gap-5">
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Parent / Guardian</h3>
                {isExistingParent && (
                    <span className="ml-auto rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Existing Account - New child will be linked
                    </span>
                )}
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                <div><p className="text-xs text-slate-500">Full Name</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{parentData.name}</p></div>
                <div><p className="text-xs text-slate-500">Phone</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{parentData.phone}</p></div>
                {parentData.email && <div><p className="text-xs text-slate-500">Email</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{parentData.email}</p></div>}
                <div className={parentData.email ? '' : 'md:col-span-2'}>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{parentData.address}</p>
                </div>
            </div>
        </div>

        {childrenList.map((child, idx) => (
            <div key={idx} className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-5 py-3 dark:border-emerald-800/50 dark:bg-emerald-900/20">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">child_care</span>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Child #{idx + 1}: {child.firstName} {child.lastName}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-3">
                    <div><p className="text-xs text-slate-500">Date of Birth</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{child.dob}</p></div>
                    <div><p className="text-xs text-slate-500">Gender</p><p className="mt-0.5 text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">{child.gender || '-'}</p></div>
                    <div><p className="text-xs text-slate-500">Program</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{child.program || '-'}</p></div>
                    <div><p className="text-xs text-slate-500">Periode</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{child.periodStartDate || '-'} sampai {child.periodEndDate || 'selesai sesi'}</p></div>
                    <div><p className="text-xs text-slate-500">{child.billingMode === 'package' ? 'Isi Paket' : 'Jumlah Sesi'}</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{child.totalSessions || 0} sesi</p></div>
                    <div><p className="text-xs text-slate-500">Jadwal</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{Array.isArray(child.therapyDays) && child.therapyDays.length > 0 ? `${child.therapyDays.join(', ')} - ${child.sessionStartTime || '09:00'}` : 'Belum digenerate'}</p></div>
                    <div><p className="text-xs text-slate-500">Harga per Sesi</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(child.programPricePerSession)}</p></div>
                    <div><p className="text-xs text-slate-500">Harga per Bulan</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(child.programPricePerMonth)}</p></div>
                    {child.billingMode === 'package' && <div><p className="text-xs text-slate-500">Harga Paket</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(child.totalPrice)}</p></div>}
                    {child.school && <div><p className="text-xs text-slate-500">School</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{child.school}</p></div>}
                    {child.diagnosis && <div className="col-span-2 md:col-span-3"><p className="text-xs text-slate-500">Diagnosis</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{child.diagnosis}</p></div>}
                </div>
            </div>
        ))}

        <button type="button" onClick={onAddAnother}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 py-3.5 text-sm font-semibold text-primary transition-all hover:border-primary/70 hover:bg-primary/5">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Another Child for This Parent
        </button>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Click "Submit Registration" to save. A login password will be generated for the parent account.
        </p>
    </div>
);

export default ReviewStep;
