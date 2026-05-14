import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsSidebar from './components/SettingsSidebar';
import { adminApi, notificationsApi } from '../../shared/api/client';

const tabs = ['Semua', 'Notifikasi Baru', 'Admin', 'Parent / Orang Tua', 'Terapis', 'Umum / Global'];
const roleOptions = [
    { id: 'admin', label: 'Admin' },
    { id: 'parent', label: 'Orang Tua' },
    { id: 'therapist', label: 'Terapis' },
];
const categoryOptions = [
    { id: 'general', label: 'Umum', icon: 'campaign' },
    { id: 'schedule', label: 'Jadwal', icon: 'event_repeat' },
    { id: 'report', label: 'Laporan', icon: 'summarize' },
    { id: 'program', label: 'Program', icon: 'library_books' },
    { id: 'payment', label: 'Pembayaran', icon: 'payments' },
    { id: 'emergency', label: 'Penting', icon: 'priority_high' },
];
const allRoleIds = roleOptions.map((role) => role.id);

function normalizeRoles(roles = []) {
    const normalized = Array.from(new Set(roles.filter(Boolean)));
    if (normalized.includes('all')) return allRoleIds;
    return normalized.filter((role) => allRoleIds.includes(role));
}

function audienceFromRoles(roles = []) {
    const normalized = normalizeRoles(roles);
    return normalized.length === allRoleIds.length ? 'all' : normalized[0] || 'admin';
}

function roleMatches(item, role) {
    if (role === 'all') return true;
    const roles = normalizeRoles(item.rawRoles || [item.audience]);
    return roles.includes(role) || roles.length === allRoleIds.length;
}

function categoryFromNotification(notification) {
    const type = String(notification?.type || '');
    if (type.startsWith('announcement_')) return type.replace('announcement_', '') || 'general';
    return notification?.category || 'system';
}

function categoryLabel(category) {
    if (category === 'system') return 'Sistem';
    return categoryOptions.find((item) => item.id === category)?.label || 'Umum';
}

function audienceLabel(item) {
    const roles = normalizeRoles(item.rawRoles || [item.audience]);
    if (roles.length === allRoleIds.length) return 'Semua Role';
    return roles.map((role) => roleOptions.find((option) => option.id === role)?.label || role).join(', ') || 'Admin';
}

function readStoredAdmin() {
    try {
        const saved = localStorage.getItem('theracare_auth_admin') || sessionStorage.getItem('theracare_auth_admin');
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

function App() {
    const [activeTab, setActiveTab] = useState('Semua');
    const [audienceFilter, setAudienceFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [notifications, setNotifications] = useState([]);
    const [currentUser, setCurrentUser] = useState(readStoredAdmin);
    const [notice, setNotice] = useState(null);
    
    // For creating new notes
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newTargetRoles, setNewTargetRoles] = useState(['parent']);
    const [newCategory, setNewCategory] = useState('general');

    const refreshData = async () => {
        try {
            const [notifsRes, annsRes] = await Promise.all([
                notificationsApi.getAll(),
                adminApi.getAnnouncements(),
            ]);
            if (!notifsRes.ok || !annsRes.ok) {
                setNotice({
                    type: 'error',
                    message: notifsRes.data?.error || annsRes.data?.error || 'Gagal memuat notifikasi.',
                });
                return;
            }
            const inbox = (notifsRes.data?.data || []).map(n => ({
                id: n.id,
                source: 'inbox',
                title: n.title || 'Notifikasi',
                desc: n.message || '',
                audience: n.targetRole || 'admin',
                rawRoles: [n.targetRole || 'admin'],
                category: categoryFromNotification(n),
                icon: n.icon || 'notifications',
                createdAt: n.createdAt,
                time: new Date(n.createdAt).toLocaleDateString('id-ID', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }),
                unread: !n.isRead,
                relatedId: n.relatedId,
            }));
            const outbox = (annsRes.data?.data || []).map(a => ({
                id: a.id,
                source: 'announcement',
                title: a.title || 'Pengumuman Tanpa Judul',
                desc: a.content || '',
                audience: audienceFromRoles(a.targetRoles || ['admin']),
                category: a.category || 'general',
                icon: categoryOptions.find((item) => item.id === (a.category || 'general'))?.icon || 'campaign',
                createdAt: a.createdAt,
                time: new Date(a.createdAt).toLocaleDateString('id-ID', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }),
                unread: false,
                rawRoles: normalizeRoles(a.targetRoles || ['admin']),
            }));
            setNotifications([...inbox, ...outbox].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (e) {
            console.error(e);
            setNotice({ type: 'error', message: 'Gagal memuat notifikasi.' });
        }
    };

    useEffect(() => {
        setCurrentUser(readStoredAdmin());
        refreshData();
        window.addEventListener('notificationsUpdated', refreshData);
        const interval = window.setInterval(refreshData, 30000);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('notificationsUpdated', refreshData);
        };
    }, []);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(null), 4500);
        return () => window.clearTimeout(timer);
    }, [notice]);

    const markAllRead = async () => {
        const res = await notificationsApi.markAllRead();
        if (!res.ok) {
            setNotice({ type: 'error', message: res.data?.error || 'Gagal menandai notifikasi.' });
            return;
        }
        setNotifications(notifications.map(n => ({ ...n, unread: false })));
        setNotice({ type: 'success', message: 'Semua notifikasi sudah ditandai dibaca.' });
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const toggleRead = async (item) => {
        if (item.source !== 'inbox' || !item.unread) return;
        const res = await notificationsApi.markRead(item.id);
        if (!res.ok) {
            setNotice({ type: 'error', message: res.data?.error || 'Gagal menandai notifikasi.' });
            return;
        }
        setNotifications(notifications.map(n => n.id === item.id ? { ...n, unread: false } : n));
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const handleDelete = async (item, e) => {
        e.stopPropagation();
        if (item.source !== 'announcement') return;
        try {
            const res = await adminApi.deleteAnnouncement(item.id);
            if (!res.ok) {
                setNotice({ type: 'error', message: res.data?.error || 'Gagal menghapus pengumuman.' });
                return;
            }
            setNotice({ type: 'success', message: 'Pengumuman berhasil dihapus.' });
            refreshData();
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error(e);
            setNotice({ type: 'error', message: 'Gagal menghapus pengumuman.' });
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newDesc.trim()) {
            setNotice({ type: 'error', message: 'Judul dan isi pengumuman wajib diisi.' });
            return;
        }
        const roles = normalizeRoles(newTargetRoles);
        if (roles.length === 0) {
            setNotice({ type: 'error', message: 'Pilih minimal satu penerima.' });
            return;
        }

        try {
            const res = await adminApi.createAnnouncement({
                title: newTitle,
                content: newDesc,
                targetRoles: roles,
                category: newCategory,
                createdBy: 'Admin',
            });
            if (!res.ok) {
                setNotice({ type: 'error', message: res.data?.error || 'Gagal mengirim pengumuman.' });
                return;
            }
            
            setNewTitle('');
            setNewDesc('');
            setNewTargetRoles(['parent']);
            setNewCategory('general');
            setIsCreating(false);
            setNotice({ type: 'success', message: 'Pengumuman berhasil dikirim ke penerima yang dipilih.' });
            refreshData();
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error(e);
            setNotice({ type: 'error', message: 'Gagal mengirim pengumuman.' });
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (activeTab === 'Notifikasi Baru' && !n.unread) return false;
        if (activeTab === 'Admin' && !roleMatches(n, 'admin')) return false;
        if (activeTab === 'Parent / Orang Tua' && !roleMatches(n, 'parent')) return false;
        if (activeTab === 'Terapis' && !roleMatches(n, 'therapist')) return false;
        if (activeTab === 'Umum / Global' && n.audience !== 'all') return false;
        
        if (audienceFilter !== 'all' && !roleMatches(n, audienceFilter)) return false;
        if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
        return true;
    });

    return (
        <>
            <Header user={currentUser} />
            <main className="flex-1 flex justify-center py-6 sm:py-8 px-3 sm:px-6 lg:px-12 bg-background-light dark:bg-background-dark">
                <div className="w-full max-w-7xl min-w-0 flex flex-col lg:flex-row gap-6 lg:gap-8">

                    {/* Main Content Area */}
                    <div className="min-w-0 flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">

                        <div className="p-4 sm:p-6 md:p-8">
                            {/* Toolbar */}
                            {notice && (
                                <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                                    notice.type === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                                        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                                }`}>
                                    <span className="material-symbols-outlined text-[20px]">{notice.type === 'success' ? 'check_circle' : 'error'}</span>
                                    <span className="min-w-0 flex-1">{notice.message}</span>
                                    <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100">
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                                <div className="min-w-0 flex flex-col gap-1">
                                    <h1 className="text-[clamp(1.65rem,4vw,3rem)] font-bold leading-tight text-slate-900 dark:text-white">Pengumuman & Notifikasi</h1>
                                    <p className="max-w-2xl text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Kelola inbox notifikasi dan kirim pengumuman ke portal Orang Tua dan Terapis.</p>
                                </div>
                                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                                    <select 
                                        value={audienceFilter}
                                        onChange={(e) => setAudienceFilter(e.target.value)}
                                        className="h-10 w-full sm:w-auto px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="all">Audiens: Semua</option>
                                        <option value="admin">Hanya Admin</option>
                                        <option value="therapist">Hanya Terapis</option>
                                        <option value="parent">Hanya Orang Tua</option>
                                    </select>
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="h-10 w-full sm:w-auto px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="all">Kategori: Semua</option>
                                        {categoryOptions.map((category) => (
                                            <option key={category.id} value={category.id}>{category.label}</option>
                                        ))}
                                        <option value="system">Sistem</option>
                                    </select>
                                    <button 
                                        onClick={markAllRead}
                                        className="flex items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold transition-colors text-slate-700 dark:text-slate-200"
                                    >
                                        <span className="material-symbols-outlined text-lg mr-2">done_all</span>
                                        Tandai Dibaca
                                    </button>
                                    <button 
                                        onClick={() => setIsCreating(true)}
                                        className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary hover:bg-primary/90 text-sm font-bold transition-colors text-white shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-lg mr-2">add_alert</span>
                                        Buat Pengumuman
                                    </button>
                                </div>
                            </div>

                            {/* Create Notification Form */}
                            {isCreating && (
                                <div className="mb-8 p-5 rounded-xl border border-primary/30 bg-primary/5">
                                    <h3 className="font-bold mb-3 text-slate-800 dark:text-white">Pengumuman Baru</h3>
                                    <div className="flex min-w-0 flex-col gap-3">
                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.2fr]">
                                            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Kategori</p>
                                                <select
                                                    value={newCategory}
                                                    onChange={(e) => setNewCategory(e.target.value)}
                                                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                >
                                                    {categoryOptions.map((category) => (
                                                        <option key={category.id} value={category.id}>{category.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Kirim ke</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewTargetRoles(newTargetRoles.length === allRoleIds.length ? ['parent'] : allRoleIds)}
                                                        className="text-[11px] font-black text-primary hover:underline"
                                                    >
                                                        {newTargetRoles.length === allRoleIds.length ? 'Reset audiens' : 'Pilih semua'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                    {roleOptions.map((role) => {
                                                        const selected = newTargetRoles.includes(role.id);
                                                        return (
                                                            <button
                                                                key={role.id}
                                                                type="button"
                                                                onClick={() => setNewTargetRoles((prev) => {
                                                                    const next = selected ? prev.filter((item) => item !== role.id) : [...prev, role.id];
                                                                    return next.length ? next : [role.id];
                                                                })}
                                                                className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                                                                    selected
                                                                        ? 'border-primary bg-primary/10 text-primary'
                                                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                                                                }`}
                                                            >
                                                                {role.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Judul Pengumuman"
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        />
                                        <textarea 
                                            placeholder="Isi pesan pengumuman..."
                                            value={newDesc}
                                            onChange={e => setNewDesc(e.target.value)}
                                            rows={2}
                                            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                                        />
                                        <div className="flex justify-end gap-3 mt-1">
                                            <button 
                                                onClick={() => setIsCreating(false)}
                                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                onClick={handleCreate}
                                                disabled={newTargetRoles.length === 0}
                                                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Kirim Sekarang
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tabs */}
                            <div className="mb-6 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex overflow-x-auto no-scrollbar gap-8">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 whitespace-nowrap transition-colors ${activeTab === tab
                                                ? 'border-primary text-primary font-bold'
                                                : 'border-transparent text-slate-500 dark:text-slate-400 font-medium hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            <span className="text-sm tracking-[0.015em]">{tab}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notification List */}
                            <div className="flex flex-col gap-3">
                                {filteredNotifications.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                                        Tidak ada pesan atau peringatan ditemukan.
                                    </div>
                                ) : filteredNotifications.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => toggleRead(n)}
                                        className={`flex min-w-0 gap-3 sm:gap-4 rounded-xl p-4 cursor-pointer transition-colors relative border group ${n.unread
                                            ? 'bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 border-primary/20'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        {n.unread && (
                                            <div className="absolute top-4 left-4 size-2.5 rounded-full bg-primary -ml-1 mt-1"></div>
                                        )}
                                        <div className="min-w-0 pl-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 w-full relative">
                                            <div className={`flex items-center justify-center rounded-lg shrink-0 size-12 ${n.unread ? 'bg-primary/10 dark:bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                }`}>
                                                <span className="material-symbols-outlined text-2xl">{n.icon}</span>
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col justify-center pr-0 sm:pr-12">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 mb-0.5">
                                                    <p className="min-w-0 break-words text-[clamp(0.95rem,2.5vw,1rem)] font-bold leading-normal text-slate-900 dark:text-white">{n.title}</p>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {n.source === 'inbox' ? 'Inbox' : audienceLabel(n)}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                                        {categoryLabel(n.category)}
                                                    </span>
                                                </div>
                                                <p className={`break-words text-sm leading-relaxed ${n.unread ? 'font-medium text-slate-700 dark:text-slate-200' : 'font-normal text-slate-600 dark:text-slate-400'} mb-1`}>{n.desc}</p>
                                            </div>
                                            
                                            <div className="shrink-0 text-left sm:text-right flex flex-row sm:flex-col items-start sm:items-end justify-between gap-2 sm:h-full">
                                                <p className={`text-sm leading-normal ${n.unread ? 'text-primary font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>{n.time}</p>
                                                {n.source === 'announcement' && (
                                                    <button
                                                        onClick={(e) => handleDelete(n, e)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all absolute right-0 bottom-0 top-0 m-auto h-fit"
                                                        title="Hapus"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <SettingsSidebar />

                </div>
            </main>
        </>
    );
}

export default App;
