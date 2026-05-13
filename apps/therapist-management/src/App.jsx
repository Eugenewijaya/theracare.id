import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import TherapistCard from './components/TherapistCard';
import { therapistsApi, adminApi } from '../../shared/api/client';
import { confirmAction } from '../../shared/ui/confirmDialog';

const WORK_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function TherapistScheduleModal({ therapist, onClose, onSave, saving }) {
    const [schedule, setSchedule] = useState(() => therapist?.schedule || {});
    const [primaryRoom, setPrimaryRoom] = useState(() => therapist?.primaryRoom || '');
    const [maxClients, setMaxClients] = useState(() => therapist?.maxClients ?? '');

    useEffect(() => {
        setSchedule(therapist?.schedule || {});
        setPrimaryRoom(therapist?.primaryRoom || '');
        setMaxClients(therapist?.maxClients ?? '');
    }, [therapist]);

    if (!therapist) return null;

    const updateDay = (day, patch) => {
        setSchedule(prev => ({
            ...prev,
            [day]: {
                start: prev?.[day]?.start || '08:00',
                end: prev?.[day]?.end || '17:00',
                ...patch,
            },
        }));
    };

    const toggleDay = (day, active) => {
        setSchedule(prev => {
            const next = { ...prev };
            if (active) {
                next[day] = next[day] || { start: '08:00', end: '17:00' };
            } else {
                delete next[day];
            }
            return next;
        });
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSave({
            schedule,
            primaryRoom,
            maxClients: maxClients === '' ? null : Number(maxClients),
        });
    };

    const activeDays = Object.values(schedule || {}).filter(Boolean).length;

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
            <form onSubmit={handleSubmit} className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Jadwal kerja</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Edit Jadwal {therapist.name}</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            Perubahan ini langsung dipakai tabel jadwal dan validasi bentrok sesi.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Ruangan utama
                            <input
                                value={primaryRoom}
                                onChange={(event) => setPrimaryRoom(event.target.value)}
                                placeholder="Contoh: Ruang Sensori 1"
                                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Maks. anak per hari
                            <input
                                type="number"
                                min="1"
                                value={maxClients}
                                onChange={(event) => setMaxClients(event.target.value)}
                                placeholder="Opsional"
                                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                        {WORK_DAYS.map((day) => {
                            const active = Boolean(schedule?.[day]);
                            return (
                                <div key={day} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800 sm:grid-cols-[160px_1fr] sm:items-center">
                                    <label className="flex items-center gap-3 text-sm font-black text-slate-800 dark:text-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={(event) => toggleDay(day, event.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        {day}
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="time"
                                            disabled={!active}
                                            value={schedule?.[day]?.start || '08:00'}
                                            onChange={(event) => updateDay(day, { start: event.target.value })}
                                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none transition disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800"
                                        />
                                        <input
                                            type="time"
                                            disabled={!active}
                                            value={schedule?.[day]?.end || '17:00'}
                                            onChange={(event) => updateDay(day, { end: event.target.value })}
                                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none transition disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {activeDays === 0 && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                            Semua hari sedang off. Sistem akan menolak jadwal baru untuk terapis ini sampai minimal satu hari kerja diaktifkan.
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                        Batal
                    </button>
                    <button type="submit" disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                        {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function App() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [specializationFilter, setSpecializationFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [therapists, setTherapists] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [savingSchedule, setSavingSchedule] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadData = async () => {
        try {
            const [tRes, pRes] = await Promise.all([
                therapistsApi.getAll(),
                adminApi.getPrograms()
            ]);
            
            const raw = tRes.data?.data || [];
            // Transform store structure to the card structure
            const transformed = raw.map(t => {
                const specArray = t.specializations ? t.specializations : t.specialization ? [t.specialization] : [];
                return {
                    name: t.name,
                    id: t.id,
                    avatar: t.avatar || '',
                    specializations: specArray,
                    status: t.status === 'active' ? 'Active' : t.status === 'inactive' ? 'Inactive' : 'On Break',
                    statusColor: t.status === 'active' ? 'green' : t.status === 'inactive' ? 'slate' : 'orange',
                    sessionsToday: 0,
                    inactive: t.status === 'inactive',
                    schedule: t.schedule || {},
                    primaryRoom: t.primaryRoom || '',
                    maxClients: t.maxClients ?? '',
                    raw: t,
                };
            });
            setTherapists(transformed);
            setPrograms(pRes.data?.data || []);
        } catch (e) {
            console.error('Failed to load therapist management data', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredTherapists = therapists.filter(t => {
        const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSpec = specializationFilter ? t.specializations.some(s => s.toLowerCase().includes(specializationFilter.toLowerCase())) : true;
        const matchesStatus = statusFilter ? t.status.toLowerCase() === statusFilter.toLowerCase() : true;
        return matchesSearch && matchesSpec && matchesStatus;
    });

    const handleDeleteTherapist = async (therapist) => {
        if (!therapist?.id) return;
        const confirmed = await confirmAction({
            tone: 'danger',
            title: `Hapus terapis ${therapist.name}?`,
            message: 'Jika sudah punya sesi/laporan, akun akan diarsipkan agar histori klinis tetap aman.',
            confirmText: 'Hapus / arsipkan',
            cancelText: 'Batal',
        });
        if (!confirmed) return;

        const res = await therapistsApi.delete(therapist.id);
        if (res.ok) {
            setTherapists(prev => prev.filter(item => item.id !== therapist.id));
            const archived = res.data?.data?.archived;
            showToast(`${therapist.name} berhasil ${archived ? 'diarsipkan dan disembunyikan' : 'dihapus'}.`);
            return;
        }
        showToast(`Gagal menghapus terapis: ${res.data?.error || res.data?.message || 'Error'}`, 'error');
    };

    const openScheduleEditor = (id) => {
        const therapist = therapists.find(item => item.id === id);
        if (!therapist) return;
        setEditingSchedule(therapist);
    };

    const handleSaveSchedule = async (payload) => {
        if (!editingSchedule?.id) return;
        setSavingSchedule(true);
        try {
            const res = await therapistsApi.updateProfile(editingSchedule.id, payload);
            if (!res.ok) {
                showToast(res.data?.error || res.data?.message || 'Gagal menyimpan jadwal terapis.', 'error');
                return;
            }
            setEditingSchedule(null);
            showToast('Jadwal kerja terapis berhasil diperbarui.');
            await loadData();
            window.dispatchEvent(new Event('therapistUpdated'));
            window.dispatchEvent(new Event('sessionUpdated'));
        } catch (error) {
            console.error(error);
            showToast('Gagal menyimpan jadwal terapis.', 'error');
        } finally {
            setSavingSchedule(false);
        }
    };

    return (
        <>
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[500] rounded-2xl border px-5 py-3 text-sm font-bold shadow-xl ${
                    toast.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                    {toast.message}
                </div>
            )}
            <Header searchValue={searchQuery} onSearchChange={setSearchQuery} />
            <main className="px-4 sm:px-10 flex flex-1 justify-center py-6 sm:py-8">
                <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 w-full">

                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between gap-3 mb-6 items-center">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">Therapist Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Manage clinic therapists, specializations, and availability</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => navigate('/therapist-registration')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background-dark rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Add New Therapist
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-primary/20">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Specialization:</span>
                            <select 
                                value={specializationFilter}
                                onChange={(e) => setSpecializationFilter(e.target.value)}
                                className="form-select bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg text-slate-700 dark:text-slate-300 text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="">All Specializations</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.name}>{p.name} ({p.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status:</span>
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="form-select bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg text-slate-700 dark:text-slate-300 text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="On Break">On Break</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Therapist Cards Grid */}
                    {loading ? (
                        <div className="text-center py-12">Loading therapists...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredTherapists.map((t) => (
                                <TherapistCard
                                    key={t.id}
                                    {...t}
                                    onDelete={handleDeleteTherapist}
                                    onView={() => navigate('/users')}
                                    onEdit={openScheduleEditor}
                                    onPerformance={() => navigate('/reports')}
                                />
                            ))}
                        </div>
                    )}

                </div>
            </main>
            {editingSchedule && (
                <TherapistScheduleModal
                    therapist={editingSchedule}
                    onClose={() => setEditingSchedule(null)}
                    onSave={handleSaveSchedule}
                    saving={savingSchedule}
                />
            )}
        </>
    );
}

export default App;
