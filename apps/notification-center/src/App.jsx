import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsSidebar from './components/SettingsSidebar';
import { adminApi, notificationsApi } from '../../shared/api/client';

const tabs = ['Semua', 'Notifikasi Baru', 'Admin', 'Parent / Orang Tua', 'Terapis', 'Umum / Global'];

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
    const [notifications, setNotifications] = useState([]);
    const [currentUser, setCurrentUser] = useState(readStoredAdmin);
    
    // For creating new notes
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const refreshData = async () => {
        try {
            const [notifsRes, annsRes] = await Promise.all([
                notificationsApi.getAll(),
                adminApi.getAnnouncements(),
            ]);
            const inbox = (notifsRes.data?.data || []).map(n => ({
                id: n.id,
                source: 'inbox',
                title: n.title || 'Notifikasi',
                desc: n.message || '',
                audience: n.targetRole || 'admin',
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
                audience: a.targetRoles && a.targetRoles.length > 1 ? 'all' : (a.targetRoles ? a.targetRoles[0] : 'admin'),
                icon: a.targetRoles?.includes('admin') ? 'admin_panel_settings' : a.targetRoles?.includes('parent') ? 'family_restroom' : 'campaign',
                createdAt: a.createdAt,
                time: new Date(a.createdAt).toLocaleDateString('id-ID', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }),
                unread: false,
                rawRoles: a.targetRoles,
            }));
            setNotifications([...inbox, ...outbox].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        setCurrentUser(readStoredAdmin());
        refreshData();
    }, []);

    const markAllRead = async () => {
        await notificationsApi.markAllRead();
        setNotifications(notifications.map(n => ({ ...n, unread: false })));
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const toggleRead = async (item) => {
        if (item.source !== 'inbox' || !item.unread) return;
        await notificationsApi.markRead(item.id);
        setNotifications(notifications.map(n => n.id === item.id ? { ...n, unread: false } : n));
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const handleDelete = async (item, e) => {
        e.stopPropagation();
        if (item.source !== 'announcement') return;
        try {
            await adminApi.deleteAnnouncement(item.id);
            refreshData();
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newDesc.trim()) return;
        
        let roles = ['admin'];
        if (audienceFilter === 'all') roles = ['admin', 'parent', 'therapist'];
        else if (audienceFilter === 'parent') roles = ['parent'];
        else if (audienceFilter === 'therapist') roles = ['therapist'];
        else if (audienceFilter === 'admin') roles = ['admin'];

        try {
            await adminApi.createAnnouncement({
                title: newTitle,
                content: newDesc,
                targetRoles: roles,
                createdBy: 'Admin',
                icon: 'notifications_active'
            });
            
            setNewTitle('');
            setNewDesc('');
            setIsCreating(false);
            refreshData();
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error(e);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (activeTab === 'Notifikasi Baru' && !n.unread) return false;
        if (activeTab === 'Admin' && n.audience !== 'admin') return false;
        if (activeTab === 'Parent / Orang Tua' && n.audience !== 'parent') return false;
        if (activeTab === 'Terapis' && n.audience !== 'therapist') return false;
        if (activeTab === 'Umum / Global' && n.audience !== 'all') return false;
        
        if (audienceFilter !== 'all' && n.audience !== audienceFilter && n.audience !== 'all') return false;
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
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                                <div className="min-w-0 flex flex-col gap-1">
                                    <h1 className="text-[clamp(1.65rem,4vw,3rem)] font-bold leading-tight text-slate-900 dark:text-white">Pusat Pengumuman</h1>
                                    <p className="max-w-2xl text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Kelola peringatan dan kirim pengumuman ke portal Orang Tua dan Terapis.</p>
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
                                                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-black hover:bg-primary/90"
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
                                                        {n.source === 'inbox' ? 'Inbox' : n.audience === 'all' ? 'Global' : n.audience}
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
