import React from 'react';


const ReviewStep = ({ parentData, childrenList, onAddAnother, isExistingParent }) => (
    <div className="flex flex-col gap-5">
        {/* Parent Summary */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Parent / Guardian</h3>
                {isExistingParent && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-semibold">Existing Account — New child will be linked</span>
                )}
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-500">Full Name</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{parentData.name}</p></div>
                <div><p className="text-xs text-slate-500">Phone</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{parentData.phone}</p></div>
                {parentData.email && <div><p className="text-xs text-slate-500">Email</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{parentData.email}</p></div>}
                <div className={parentData.email ? '' : 'md:col-span-2'}>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{parentData.address}</p>
                </div>
            </div>
        </div>

        {/* Children summaries */}
        {childrenList.map((child, idx) => (
            <div key={idx} className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 overflow-hidden">
                <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/50 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">child_care</span>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Child #{idx + 1}: {child.firstName} {child.lastName}</h3>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><p className="text-xs text-slate-500">Date of Birth</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{child.dob}</p></div>
                    <div><p className="text-xs text-slate-500">Gender</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5 capitalize">{child.gender || '—'}</p></div>
                    <div><p className="text-xs text-slate-500">Program</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{child.program || '—'}</p></div>
                    {child.school && <div><p className="text-xs text-slate-500">School</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{child.school}</p></div>}
                    {child.diagnosis && <div className="col-span-2 md:col-span-3"><p className="text-xs text-slate-500">Diagnosis</p><p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{child.diagnosis}</p></div>}
                </div>
            </div>
        ))}

        {/* Add Another Child */}
        <button type="button" onClick={onAddAnother}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary/70 transition-all font-semibold text-sm">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Another Child for This Parent
        </button>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Click "Submit Registration" to save. A temporary login password will be generated for the parent account.
        </p>
    </div>
);

export default ReviewStep;
