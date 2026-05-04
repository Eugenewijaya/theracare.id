import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EditChildModal from './EditChildModal';
import { findParentById } from '../../../shared/clinicDataStore';



const programColors = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    sky: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400',
};

const progressColors = {
    primary: 'bg-primary',
    emerald: 'bg-emerald-500',
};

const progressTextColors = {
    primary: 'text-primary',
    emerald: 'text-emerald-500',
};

const statusConfig = {
    active:   { label: 'Active',   cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
    inactive: { label: 'Inactive', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
    pending:  { label: 'Pending',  cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'   },
};

const ChildTable = ({ children }) => {
    const navigate = useNavigate();
    const [editingChild, setEditingChild] = useState(null);

    const handleContactParent = (child) => {
        if (!child.parentId) {
            alert('Parent ID not found for this child (Mock Data).');
            return;
        }
        const parent = findParentById(child.parentId);
        if (parent && parent.phone) {
            let phone = parent.phone.replace(/\D/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            window.open(`https://wa.me/${phone}`, '_blank');
        } else {
            alert('Parent phone number not found.');
        }
    };

    return (
        <>
            {editingChild && <EditChildModal child={editingChild} onClose={() => setEditingChild(null)} />}
        <section className="rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mb-10">
            <div className="overflow-x-auto hidden xl:block">
                <table className="w-full min-w-[900px] text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">Child Name</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">Age</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">Programs Enrolled</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">Assigned Therapist</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[200px]">Session Progress</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">Status</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {children.map((child) => (
                            <tr key={child.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        {child.avatarType === 'img' ? (
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                                <img alt={child.name} className="w-full h-full object-cover" src={child.avatar} />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                                                <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">{child.avatarInitials}</span>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors cursor-pointer">{child.name}</p>
                                            <p className="text-xs text-slate-500 font-mono tracking-wide">NITA: {child.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{child.age}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        {(child.programs || []).map((p, idx) => (
                                            <span key={p.name || p || idx} className={`px-2 py-1 rounded text-xs font-medium ${programColors[p.color] || programColors.emerald}`}>{p.name || p}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {child.therapistAvatarType === 'img' ? (
                                            <div className="w-6 h-6 rounded-full bg-center bg-no-repeat bg-cover border border-slate-200 dark:border-slate-700" style={{ backgroundImage: `url('${child.therapistAvatar}')` }}></div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">{child.therapistInitials}</div>
                                        )}
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{child.therapist}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1.5 w-full">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-slate-700 dark:text-slate-300">{child.phase || '—'}</span>
                                            <span className={progressTextColors[child.progressColor] || 'text-primary'}>{child.sessions || '—'}</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                            <div className={`h-full ${progressColors[child.progressColor] || 'bg-primary'} rounded-full transition-all duration-500`} style={{ width: `${child.progress || 0}%` }}></div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {(() => { const s = statusConfig[(child.status || 'active')]; return (
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s?.cls || statusConfig.active.cls}`}>
                                            {s?.label || 'Active'}
                                        </span>
                                    ); })()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-end gap-2 text-slate-400">
                                        <button className="p-1.5 hover:text-primary hover:bg-primary/10 rounded transition-colors" title="View Progress" onClick={() => navigate('/monitoring')}>
                                            <span className="material-symbols-outlined text-[20px]">monitoring</span>
                                        </button>
                                        <button className="p-1.5 hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit Info" onClick={() => setEditingChild(child)}>
                                            <span className="material-symbols-outlined text-[20px]">edit</span>
                                        </button>
                                        <button className="p-1.5 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded transition-colors" title="Contact Parent (WhatsApp)" onClick={() => handleContactParent(child)}>
                                            <span className="material-symbols-outlined text-[20px]">chat</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="xl:hidden flex flex-col gap-4 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50">
                {children.map(child => {
                    const s = statusConfig[(child.status || 'active')];
                    return (
                    <div key={child.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4 relative">
                        <div className="absolute top-4 right-4 z-10">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s?.cls || statusConfig.active.cls}`}>
                                {s?.label || 'Active'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 pr-16 relative">
                            {child.avatarType === 'img' ? (
                                <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                                    <img alt={child.name} className="w-full h-full object-cover" src={child.avatar} />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center border border-rose-200 dark:border-rose-800 shrink-0">
                                    <span className="text-rose-600 dark:text-rose-400 font-bold text-base">{child.avatarInitials}</span>
                                </div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <p className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{child.name}</p>
                                <p className="text-xs text-slate-500 font-mono tracking-wide truncate">NITA: {child.id} • {child.age}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 sm:p-3 border border-slate-100 dark:border-slate-700 flex flex-col">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Therapist</p>
                                <div className="flex items-center gap-2">
                                    {child.therapistAvatarType === 'img' ? (
                                        <div className="w-6 h-6 rounded-full bg-center bg-no-repeat bg-cover border border-slate-300 dark:border-slate-600 shrink-0 shadow-sm" style={{ backgroundImage: `url('${child.therapistAvatar}')` }}></div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 shadow-sm">{child.therapistInitials}</div>
                                    )}
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate leading-tight">{child.therapist}</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 sm:p-3 border border-slate-100 dark:border-slate-700 flex flex-col">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Programs</p>
                                <div className="flex flex-wrap gap-1.5 h-full content-start border-l-2 border-transparent">
                                    {(child.programs || []).map((p, idx) => (
                                        <span key={p.name || p || idx} className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${programColors[p.color] || programColors.emerald}`}>{p.name || p}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                                <span className="text-slate-500 shrink-0">{child.phase || '—'}</span>
                                <span className={`text-right shrink-0 ${progressTextColors[child.progressColor] || 'text-primary'}`}>{child.sessions || '—'}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shadow-inner">
                                <div className={`h-full ${progressColors[child.progressColor] || 'bg-primary'} rounded-full transition-all duration-500`} style={{ width: `${child.progress || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <button className="flex-1 py-2 sm:py-2.5 bg-slate-50 hover:bg-primary/10 text-slate-600 hover:text-primary dark:bg-slate-900 dark:text-slate-400 rounded-lg text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-1.5" onClick={() => navigate('/monitoring')}>
                                <span className="material-symbols-outlined text-[16px]">monitoring</span> <span className="hidden sm:inline">Progress</span>
                            </button>
                            <button className="flex-1 py-2 sm:py-2.5 bg-slate-50 hover:bg-primary/10 text-slate-600 hover:text-primary dark:bg-slate-900 dark:text-slate-400 rounded-lg text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-1.5" onClick={() => setEditingChild(child)}>
                                <span className="material-symbols-outlined text-[16px]">edit</span> <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button className="flex-1 py-2 sm:py-2.5 bg-slate-50 hover:bg-[#25D366]/10 text-slate-600 hover:text-[#25D366] dark:bg-slate-900 dark:text-slate-400 rounded-lg text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-1.5" onClick={() => handleContactParent(child)}>
                                <span className="material-symbols-outlined text-[16px]">chat</span> <span className="hidden sm:inline">WA</span>
                            </button>
                        </div>
                    </div>
                )})}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3">
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-700 dark:text-slate-400">
                        Showing <span className="font-medium text-slate-900 dark:text-slate-100">1</span> to <span className="font-medium text-slate-900 dark:text-slate-100">{children.length}</span> of <span className="font-medium text-slate-900 dark:text-slate-100">{children.length}</span> results
                    </p>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                        <a href="#" className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800">
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                        </a>
                        <a href="#" className="relative z-10 inline-flex items-center bg-primary px-4 py-2 text-sm font-semibold text-white">1</a>
                        <a href="#" className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </a>
                    </nav>
                </div>
            </div>
        </section>
    </>);
};

export default ChildTable;
