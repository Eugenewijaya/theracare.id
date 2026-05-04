import React, { useState, useEffect } from 'react';
import { getAllParents, getAllTherapists, updateParentPassword, updateParentStatus, updateTherapistPassword, updateTherapistStatus } from '../../../shared/clinicDataStore';

export default function UserManagementPage() {
    const [activeTab, setActiveTab]   = useState('parents');
    const [parents, setParents]       = useState([]);
    const [therapists, setTherapists] = useState([]);
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatus]   = useState('');
    const [toast, setToast]           = useState(null);
    const [showPass, setShowPass]     = useState({});

    const load = () => {
        setParents(getAllParents());
        setTherapists(getAllTherapists());
    };

    useEffect(() => {
        load();
        window.addEventListener('clinicDataUpdated', load);
        return () => window.removeEventListener('clinicDataUpdated', load);
    }, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleReset = (user, type) => {
        let newPass = null;
        if (type === 'parents') newPass = updateParentPassword(user.id);
        else newPass = updateTherapistPassword(user.id);
        load();
        showToast(`Password for ${user.name} reset to: ${newPass || '(saved)'}`);
    };

    const handleToggleStatus = (user, type) => {
        const next = user.status === 'active' ? 'suspended' : 'active';
        if (type === 'parents') updateParentStatus(user.id, next);
        else updateTherapistStatus(user.id, next);
        load();
        showToast(`${user.name} account ${next}.`, next === 'active' ? 'success' : 'warning');
    };

    const currentData = activeTab === 'parents' ? parents : therapists;

    const filtered = currentData.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || (u.phone || '').includes(search) || (u.id || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter ? (u.status || 'active') === statusFilter : true;
        return matchSearch && matchStatus;
    });

    return (
        <div className="flex flex-col flex-1 bg-background-light dark:bg-background-dark">
            {/* Pop-up Notification Modal */}
            {toast && (
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setToast(null)}>
                    <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl text-sm font-semibold border max-w-md w-full sm:w-auto mb-4 sm:mb-0 ${
                        toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : toast.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`} onClick={e => e.stopPropagation()}>
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {toast.type === 'success' ? 'check_circle' : 'warning'}
                        </span>
                        <span className="flex-1">{toast.msg}</span>
                        <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 ml-2">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>
            )}

            <main className="px-6 md:px-10 flex flex-1 justify-center py-8">
                <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 w-full gap-6">

                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between gap-3">
                        <div>
                            <h1 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight">User Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage parent accounts, reset passwords, and control access.</p>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Parents', value: parents.length, icon: 'family_restroom', color: 'text-blue-600 bg-blue-50' },
                            { label: 'Total Therapists', value: therapists.length, icon: 'medical_services', color: 'text-indigo-600 bg-indigo-50' },
                            { label: 'Active Users',     value: parents.filter(p => (p.status || 'active') === 'active').length + therapists.filter(t => (t.status || 'active') === 'active').length,     icon: 'check_circle', color: 'text-emerald-600 bg-emerald-50' },
                            { label: 'Suspended Users',  value: parents.filter(p => p.status === 'suspended').length + therapists.filter(t => t.status === 'suspended').length,                icon: 'block',        color: 'text-red-600 bg-red-50'      },
                        ].map(s => (
                            <div key={s.label} className="bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/20 rounded-xl p-4 flex items-center gap-4">
                                <span className={`material-symbols-outlined text-[24px] p-2 rounded-lg ${s.color}`}>{s.icon}</span>
                                <div><p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{s.label}</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p></div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-primary/20 mt-2">
                        <button 
                            onClick={() => setActiveTab('parents')}
                            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'parents' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            Parents
                        </button>
                        <button 
                            onClick={() => setActiveTab('therapists')}
                            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'therapists' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            Therapists
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/20 rounded-lg px-3 h-10">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
                                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400" />
                        </div>
                        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
                            className="h-10 px-4 rounded-lg border border-slate-200 dark:border-primary/20 bg-white dark:bg-primary/5 text-slate-900 dark:text-slate-100 text-sm cursor-pointer min-w-40">
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/20 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-background-dark/50">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{activeTab === 'parents' ? 'Parent' : 'Therapist'}</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{activeTab === 'parents' ? 'Children' : 'Specialization'}</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Temp Password</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-primary/10">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-16 text-slate-400">
                                            <span className="material-symbols-outlined text-5xl block mb-2">manage_accounts</span>
                                            <span className="text-sm">No {activeTab} accounts found.</span>
                                        </td></tr>
                                    ) : filtered.map(user => {
                                        const isActive = (user.status || 'active') === 'active';
                                        const passVisible = showPass[user.id];
                                        return (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary flex-shrink-0">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{user.name}</p>
                                                            <p className="text-xs text-slate-400">{user.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-slate-700 dark:text-slate-300">{user.phone || '—'}</p>
                                                    {user.email && <p className="text-xs text-slate-400">{user.email}</p>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {activeTab === 'parents' ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{(user.children || []).length} Anak</span>
                                                            {(user.children || []).length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {user.children.map(childNita => (
                                                                        <span key={childNita} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 font-mono">
                                                                            {childNita}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{user.specialization || 'Therapist'}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                                            {passVisible ? (user.tempPassword || '—') : '••••••••••'}
                                                        </code>
                                                        <button onClick={() => setShowPass(prev => ({ ...prev, [user.id]: !passVisible }))}
                                                            className="text-slate-400 hover:text-slate-600 p-1" title={passVisible ? 'Hide' : 'Show'}>
                                                            <span className="material-symbols-outlined text-[16px]">{passVisible ? 'visibility_off' : 'visibility'}</span>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                        {isActive ? 'Active' : 'Suspended'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleReset(user, activeTab)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                            title="Reset Password">
                                                            <span className="material-symbols-outlined text-[14px]">key</span>
                                                            Reset
                                                        </button>
                                                        <button onClick={() => handleToggleStatus(user, activeTab)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${isActive ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                                                            title={isActive ? 'Suspend Account' : 'Activate Account'}>
                                                            <span className="material-symbols-outlined text-[14px]">{isActive ? 'block' : 'check_circle'}</span>
                                                            {isActive ? 'Suspend' : 'Activate'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
