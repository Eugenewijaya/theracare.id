import React, { useState, useEffect } from 'react';
import { adminApi } from '../../../shared/api/client';

const ROLES = [
    { id: 'admin', label: 'Admin', icon: 'admin_panel_settings', color: 'indigo' },
    { id: 'parent', label: 'Orang Tua', icon: 'family_restroom', color: 'sky' },
    { id: 'therapist', label: 'Terapis', icon: 'psychology', color: 'teal' },
];

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function AnnouncementModal({ ann, onSave, onClose }) {
    const [title, setTitle] = useState(ann?.title || '');
    const [content, setContent] = useState(ann?.content || '');
    const [targetRoles, setTargetRoles] = useState(ann?.targetRoles || ['admin', 'parent', 'therapist']);
    const [isActive, setIsActive] = useState(ann?.isActive !== false);

    const toggleRole = (role) => {
        setTargetRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim() || targetRoles.length === 0) return;
        onSave({ title: title.trim(), content: content.trim(), targetRoles, isActive });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-primary to-primary/80 p-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[22px]">{ann ? 'edit' : 'campaign'}</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold text-white">{ann ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}</h2>
                        <p className="text-white/70 text-xs">Pengumuman akan dikirim ke role yang dipilih</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Judul Pengumuman *</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Contoh: Libur Nasional"
                            required
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Isi Pengumuman *</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={4}
                            placeholder="Tuliskan isi pengumuman di sini..."
                            required
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Target Penerima *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {ROLES.map(role => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.id)}
                                    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${targetRoles.includes(role.id) ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">{role.icon}</span>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">{role.label}</p>
                                    </div>
                                    {targetRoles.includes(role.id) && (
                                        <span className="material-symbols-outlined text-[16px] ml-auto text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {ann && (
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-6 bg-slate-200 dark:bg-slate-700 peer-checked:bg-primary rounded-full transition-colors"></div>
                                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pengumuman aktif</span>
                        </label>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || !content.trim() || targetRoles.length === 0}
                            className="flex-1 px-4 py-3 rounded-xl font-bold bg-primary text-slate-900 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/20"
                        >
                            {ann ? 'Simpan Perubahan' : 'Kirim Pengumuman'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState([]);
    const [modal, setModal] = useState(null); // null | 'create' | {ann object}
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [toast, setToast] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const res = await adminApi.getAnnouncements();
            setAnnouncements(res.data?.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleSave = async (data) => {
        if (modal === 'create') {
            await adminApi.createAnnouncement(data);
            showToast('Pengumuman berhasil dibuat dan dikirim!');
        } else {
            await adminApi.updateAnnouncement(modal.id, data);
            showToast('Pengumuman berhasil diperbarui.');
        }
        setModal(null);
        load();
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const handleDelete = async (id) => {
        await adminApi.deleteAnnouncement(id);
        setDeleteConfirm(null);
        showToast('Pengumuman berhasil dihapus.');
        load();
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const activeCount = announcements.filter(a => a.isActive).length;

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
            {/* Page Header */}
            <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-4 sm:px-8 py-4 sm:py-6 shrink-0">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-slate-900 shadow-md">
                            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-text-light-primary dark:text-text-dark-primary">Pengumuman Klinik</h1>
                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                {activeCount} pengumuman aktif · Dikirim sesuai role admin, orang tua, dan terapis
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setModal('create')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-slate-900 font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Buat Pengumuman
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-slate-400">campaign</span>
                        </div>
                        <p className="text-lg font-bold text-slate-500">Belum ada pengumuman</p>
                        <button onClick={() => setModal('create')} className="px-5 py-2.5 rounded-xl bg-primary text-slate-900 font-bold text-sm">
                            Buat Pengumuman Pertama
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {announcements.map(ann => (
                            <div key={ann.id} className={`bg-surface-light dark:bg-surface-dark rounded-2xl border ${ann.isActive ? 'border-border-light dark:border-border-dark' : 'border-slate-200/50 dark:border-slate-800/50 opacity-60'} p-4 sm:p-5 flex flex-row items-start gap-3 sm:gap-5 hover:shadow-sm transition-shadow`}>
                                {/* Status dot */}
                                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${ann.isActive ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-slate-400'}`}></div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div>
                                            <h3 className="font-bold text-text-light-primary dark:text-text-dark-primary text-base leading-tight">{ann.title}</h3>
                                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-0.5">{formatDate(ann.createdAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {ann.targetRoles?.map(r => (
                                                <span key={r} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                    {r === 'parent' ? 'Orang Tua' : r === 'therapist' ? 'Terapis' : r === 'admin' ? 'Admin' : r}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-2 line-clamp-2 leading-relaxed">{ann.content}</p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => setModal(ann)}
                                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors"
                                        title="Edit"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(ann)}
                                        className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 transition-colors"
                                        title="Hapus"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Create/Edit */}
            {modal && (
                <AnnouncementModal
                    ann={modal === 'create' ? null : modal}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-3xl">delete</span>
                            </div>
                            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Hapus Pengumuman?</h2>
                            <p className="text-sm text-slate-500">
                                "<strong>{deleteConfirm.title}</strong>" akan dihapus permanen.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                            <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 px-4 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md shadow-red-500/20">Hapus</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    {toast}
                </div>
            )}
        </div>
    );
}
