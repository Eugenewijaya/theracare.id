import React, { useState, useEffect } from 'react';
import { parentsApi, therapistsApi } from '../../../shared/api/client';
import { confirmAction } from '../../../shared/ui/confirmDialog';
import {
    ADMIN_GATE_PASSWORD,
    USER_MANAGEMENT_UNLOCK_KEY,
    clearSessionUnlockState,
    getSessionUnlockState,
    markSessionUnlocked,
} from '../config/accessGate';

const PASSWORD_INFO_MESSAGE = 'Password saat ini tersimpan aman sebagai hash dan tidak bisa ditampilkan ulang. Gunakan Reset untuk membuat password baru yang bisa diberikan ke user.';

export default function UserManagementPage() {
    const [activeTab, setActiveTab]   = useState('parents');
    const [parents, setParents]       = useState([]);
    const [therapists, setTherapists] = useState([]);
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatus]   = useState('');
    const [toast, setToast]           = useState(null);
    const [showPass, setShowPass]     = useState({});
    const [passwordOverrides, setPasswordOverrides] = useState({});
    const [loading, setLoading]       = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(() => getSessionUnlockState(USER_MANAGEMENT_UNLOCK_KEY));
    const [gatePassword, setGatePassword] = useState('');
    const [gateError, setGateError] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [pRes, tRes] = await Promise.all([
                parentsApi.getAll(),
                therapistsApi.getAll(),
            ]);
            setParents(pRes.data?.data || []);
            setTherapists(tRes.data?.data || []);
        } catch (e) {
            console.error("Failed to load users", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isUnlocked) return;
        load();
    }, [isUnlocked]);

    useEffect(() => {
        if (!isUnlocked) return undefined;
        const lockIfExpired = () => {
            if (getSessionUnlockState(USER_MANAGEMENT_UNLOCK_KEY)) return;
            clearSessionUnlockState(USER_MANAGEMENT_UNLOCK_KEY);
            setIsUnlocked(false);
            setGatePassword('');
            setGateError('Sesi super admin sudah habis. Masukkan password lagi.');
        };
        const interval = window.setInterval(lockIfExpired, 5000);
        window.addEventListener('focus', lockIfExpired);
        document.addEventListener('visibilitychange', lockIfExpired);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', lockIfExpired);
            document.removeEventListener('visibilitychange', lockIfExpired);
        };
    }, [isUnlocked]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleUnlock = (e) => {
        e.preventDefault();
        if (gatePassword !== ADMIN_GATE_PASSWORD) {
            setGateError('Password super admin salah.');
            return;
        }

        markSessionUnlocked(USER_MANAGEMENT_UNLOCK_KEY);
        setIsUnlocked(true);
        setGatePassword('');
        setGateError('');
        showToast('Akses User Management dibuka.');
    };

    const handleReset = async (user, type) => {
        let res;
        if (type === 'parents') res = await parentsApi.resetPassword(user.id);
        else res = await therapistsApi.resetPassword(user.id);
        
        if (res.ok) {
            const nextPassword = res.data?.data?.tempPassword || res.data?.data?.newPassword || res.data?.data?.password || '';
            if (nextPassword) {
                setPasswordOverrides(prev => ({ ...prev, [user.id]: nextPassword }));
                setShowPass(prev => ({ ...prev, [user.id]: true }));
                if (type === 'parents') {
                    setParents(prev => prev.map(item => item.id === user.id ? { ...item, tempPassword: nextPassword } : item));
                } else {
                    setTherapists(prev => prev.map(item => item.id === user.id ? { ...item, tempPassword: nextPassword } : item));
                }
            }
            showToast(`Password ${user.name}: ${nextPassword || 'berhasil direset'}`);
        } else {
            showToast(`Gagal mereset password: ${res.data?.error || res.data?.message || 'Error'}`, 'error');
        }
    };

    const handleCopyPassword = async (user, password) => {
        if (!password) {
            showToast('Password lama tidak dapat disalin. Gunakan Reset untuk membuat password baru.', 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(password);
            showToast(`Password ${user.name} disalin.`);
        } catch {
            showToast('Browser tidak mengizinkan copy otomatis. Silakan blok dan salin manual.', 'warning');
        }
    };

    const handleToggleStatus = async (user, type) => {
        const next = user.status === 'active' ? 'suspended' : 'active';
        let res;
        if (type === 'parents') res = await parentsApi.updateStatus(user.id, next);
        else res = await therapistsApi.updateStatus(user.id, next);
        
        if (res.ok) {
            load();
            showToast(`${user.name} account ${next}.`, next === 'active' ? 'success' : 'warning');
        } else {
            showToast(`Gagal mengubah status: ${res.data?.error || res.data?.message || 'Error'}`, 'error');
        }
    };

    const handleDelete = async (user, type) => {
        const label = type === 'parents' ? 'parent' : 'therapist';
        const confirmed = await confirmAction({
            tone: 'danger',
            title: `Hapus akun ${user.name}?`,
            message: `Akun ${label} yang sudah punya anak, sesi, atau laporan akan ditolak server atau diarsipkan agar histori tetap aman.`,
            confirmText: 'Hapus akun',
            cancelText: 'Batal',
        });
        if (!confirmed) return;

        const res = type === 'parents'
            ? await parentsApi.delete(user.id)
            : await therapistsApi.delete(user.id);

        if (res.ok) {
            if (type === 'parents') {
                setParents(prev => prev.filter(item => item.id !== user.id));
            } else {
                setTherapists(prev => prev.filter(item => item.id !== user.id));
            }
            load();
            const archived = res.data?.data?.archived;
            showToast(`${user.name} berhasil ${archived ? 'diarsipkan dan disembunyikan' : 'dihapus'}.`);
        } else {
            showToast(`Gagal menghapus: ${res.data?.error || res.data?.message || 'Error'}`, 'error');
        }
    };

    const currentData = activeTab === 'parents' ? parents : therapists;

    const filtered = currentData.filter(u => {
        const matchSearch = (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
                            (u.phone || '').includes(search) || 
                            (u.id || '').toLowerCase().includes(search.toLowerCase());
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

            {!isUnlocked && (
                <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
                    <form
                        onSubmit={handleUnlock}
                        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-slate-900 shadow-2xl p-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[26px]">lock</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-900 dark:text-white">User Management Terkunci</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Masukkan password super admin untuk membuka halaman ini.
                                    Akses otomatis terkunci lagi setelah 5 menit.
                                </p>
                            </div>
                        </div>

                        <label htmlFor="user-management-gate-password" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mt-6 mb-2">
                            Password Super Admin
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-slate-950 px-3 h-12 focus-within:ring-2 focus-within:ring-primary/40">
                            <span className="material-symbols-outlined text-slate-400 text-[20px]">key</span>
                            <input
                                id="user-management-gate-password"
                                type="password"
                                autoFocus
                                value={gatePassword}
                                onChange={(e) => {
                                    setGatePassword(e.target.value);
                                    if (gateError) setGateError('');
                                }}
                                autoComplete="off"
                                className="flex-1 bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400"
                                placeholder="Masukkan password"
                            />
                        </div>
                        {gateError && (
                            <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{gateError}</p>
                        )}

                        <button
                            type="submit"
                            disabled={!gatePassword.trim()}
                            className="mt-6 w-full h-11 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary/90 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                        >
                            Buka User Management
                        </button>
                    </form>
                </div>
            )}

            {isUnlocked && (
            <main className="flex flex-1 justify-center px-4 py-6 md:px-6 xl:px-10 xl:py-8">
                <div className="layout-content-container flex flex-col max-w-[1500px] flex-1 w-full gap-6">

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
                            <table className="w-full min-w-[1240px] table-fixed text-left">
                                <colgroup>
                                    <col className="w-[220px]" />
                                    <col className="w-[230px]" />
                                    <col className="w-[170px]" />
                                    <col className="w-[270px]" />
                                    <col className="w-[120px]" />
                                    <col className="w-[230px]" />
                                </colgroup>
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-background-dark/50">
                                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{activeTab === 'parents' ? 'Parent' : 'Therapist'}</th>
                                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{activeTab === 'parents' ? 'Children' : 'Specialization'}</th>
                                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5">
                                                Password
                                                <button
                                                    type="button"
                                                    onClick={() => showToast(PASSWORD_INFO_MESSAGE, 'warning')}
                                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-black text-slate-600 hover:bg-slate-300"
                                                    title={PASSWORD_INFO_MESSAGE}
                                                >
                                                    i
                                                </button>
                                            </span>
                                        </th>
                                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-primary/10">
                                    {loading ? (
                                        <tr><td colSpan={6} className="text-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-16 text-slate-400">
                                            <span className="material-symbols-outlined text-5xl block mb-2">manage_accounts</span>
                                            <span className="text-sm">No {activeTab} accounts found.</span>
                                        </td></tr>
                                    ) : filtered.map(user => {
                                        const isActive = (user.status || 'active') === 'active';
                                        const passVisible = showPass[user.id];
                                        const passwordValue = passwordOverrides[user.id] || user.tempPassword || '';
                                        const displayPassword = passwordValue
                                            ? (passVisible ? passwordValue : '**********')
                                            : (passVisible ? 'Tersimpan aman' : '**********');
                                        return (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary flex-shrink-0">
                                                            {(user.name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-snug break-words">{user.name}</p>
                                                            <p className="text-xs text-slate-400">{user.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{user.phone || '-'}</p>
                                                    {user.email && <p className="text-xs text-slate-400 break-all">{user.email}</p>}
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    {activeTab === 'parents' ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{(user.children || []).length} Anak</span>
                                                            {(user.children || []).length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {user.children.map(child => (
                                                                        <span key={child.id || child.nita || child} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 font-mono">
                                                                            {child.nita || child}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-slate-700 dark:text-slate-300 break-words">{user.specialization || 'Therapist'}</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <code className="min-w-[130px] max-w-[170px] truncate rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-mono leading-5 text-slate-700 dark:text-slate-300" title={passVisible ? displayPassword : ''}>
                                                            {displayPassword}
                                                        </code>
                                                        <button onClick={() => setShowPass(prev => ({ ...prev, [user.id]: !passVisible }))}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" title={passVisible ? 'Hide' : 'Show'}>
                                                            <span className="material-symbols-outlined text-[16px]">{passVisible ? 'visibility_off' : 'visibility'}</span>
                                                        </button>
                                                        <button onClick={() => handleCopyPassword(user, passwordValue)}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" title="Copy Password">
                                                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => showToast(PASSWORD_INFO_MESSAGE, 'warning')}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                                                            title={PASSWORD_INFO_MESSAGE}
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">info</span>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                        {isActive ? 'Active' : 'Suspended'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 align-middle">
                                                    <div className="flex flex-nowrap items-center justify-end gap-2">
                                                        <button onClick={() => handleReset(user, activeTab)}
                                                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                            title="Reset Password">
                                                            <span className="material-symbols-outlined text-[14px]">key</span>
                                                            <span className="hidden 2xl:inline">Reset</span>
                                                        </button>
                                                        <button onClick={() => handleToggleStatus(user, activeTab)}
                                                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${isActive ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                                                            title={isActive ? 'Suspend Account' : 'Activate Account'}>
                                                            <span className="material-symbols-outlined text-[14px]">{isActive ? 'block' : 'check_circle'}</span>
                                                            <span className="hidden 2xl:inline">{isActive ? 'Suspend' : 'Activate'}</span>
                                                        </button>
                                                        <button onClick={() => handleDelete(user, activeTab)}
                                                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                                                            title="Delete Account">
                                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                                            <span className="hidden 2xl:inline">Delete</span>
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
            )}
        </div>
    );
}
