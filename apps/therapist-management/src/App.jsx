import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import TherapistCard from './components/TherapistCard';
import { therapistsApi, adminApi, reportsApi, sessionsApi } from '../../shared/api/client';
import { useClinicSettings } from '../../shared/clinicSettings';
import {
    buildTherapistRegistrationWhatsAppUrl,
    openTherapistRegistrationLetter,
} from '../../shared/therapistRegistrationLetter';
import { confirmAction } from '../../shared/ui/confirmDialog';

const WORK_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function TherapistScheduleModal({ therapist, onClose, onSave, saving }) {
    const [schedule, setSchedule] = useState(() => therapist?.schedule || {});
    const [primaryRoom, setPrimaryRoom] = useState(() => therapist?.primaryRoom || '');
    const [maxClients, setMaxClients] = useState(() => therapist?.maxClients ?? '');
    const [specialty, setSpecialty] = useState(() => therapist?.raw?.specialty || therapist?.specializations?.[0] || '');
    const [strNumber, setStrNumber] = useState(() => therapist?.raw?.strNumber || '');
    const [strExpiry, setStrExpiry] = useState(() => therapist?.raw?.strExpiry || '');
    const [bulkTime, setBulkTime] = useState({ start: '08:00', end: '17:00' });

    useEffect(() => {
        setSchedule(therapist?.schedule || {});
        setPrimaryRoom(therapist?.primaryRoom || '');
        setMaxClients(therapist?.maxClients ?? '');
        setSpecialty(therapist?.raw?.specialty || therapist?.specializations?.[0] || '');
        setStrNumber(therapist?.raw?.strNumber || '');
        setStrExpiry(therapist?.raw?.strExpiry || '');
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

    const activeDays = WORK_DAYS.filter((day) => Boolean(schedule?.[day]));
    const applyTimeToDays = (days, time = bulkTime) => {
        if (!days.length) return;
        setSchedule(prev => {
            const next = { ...(prev || {}) };
            days.forEach((day) => {
                next[day] = {
                    ...(next[day] || {}),
                    start: time.start || '08:00',
                    end: time.end || '17:00',
                };
            });
            return next;
        });
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSave({
            schedule,
            primaryRoom,
            maxClients: maxClients === '' ? null : Number(maxClients),
            specialty,
            specialization: specialty,
            strNumber,
            strExpiry,
        });
    };
    const activeDayCount = activeDays.length;

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
            <form onSubmit={handleSubmit} className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Jadwal kerja & STR</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Edit Data {therapist.name}</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            Perubahan ini langsung dipakai tabel jadwal dan validasi bentrok sesi.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-5">
                    <div className="mb-5 grid gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Peran / spesialisasi
                            <input
                                value={specialty}
                                onChange={(event) => setSpecialty(event.target.value)}
                                placeholder="Contoh: Terapi Okupasi"
                                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Nomor STR
                            <input
                                value={strNumber}
                                onChange={(event) => setStrNumber(event.target.value)}
                                placeholder="STR-OT-2026-001"
                                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Masa berlaku STR
                            <input
                                type="date"
                                value={strExpiry || ''}
                                onChange={(event) => setStrExpiry(event.target.value)}
                                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                    </div>

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

                    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <p className="text-sm font-black text-blue-900 dark:text-blue-100">Samakan jam cepat</p>
                        <p className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300">Gunakan tombol ini agar admin tidak perlu mengubah jam satu per satu.</p>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                            <label className="flex flex-col gap-1 text-xs font-black text-blue-900 dark:text-blue-100">
                                Mulai
                                <input
                                    type="time"
                                    value={bulkTime.start}
                                    onChange={(event) => setBulkTime(prev => ({ ...prev, start: event.target.value }))}
                                    className="h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-white"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-black text-blue-900 dark:text-blue-100">
                                Selesai
                                <input
                                    type="time"
                                    value={bulkTime.end}
                                    onChange={(event) => setBulkTime(prev => ({ ...prev, end: event.target.value }))}
                                    className="h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-white"
                                />
                            </label>
                            <button type="button" onClick={() => applyTimeToDays(activeDays)} disabled={activeDayCount === 0} className="h-10 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                                Samakan hari aktif
                            </button>
                            <button type="button" onClick={() => applyTimeToDays(WORK_DAYS)} className="h-10 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">
                                Aktifkan semua
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                        {WORK_DAYS.map((day) => {
                            const active = Boolean(schedule?.[day]);
                            return (
                                <div key={day} className="grid min-w-0 gap-3 border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
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
                                        {active && (
                                            <button
                                                type="button"
                                                onClick={() => applyTimeToDays(activeDays, schedule?.[day])}
                                                disabled={activeDayCount <= 1}
                                                className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Samakan jam {day} ke hari aktif
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {activeDayCount === 0 && (
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
                        {saving ? 'Menyimpan...' : 'Simpan Data'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function formatDate(value) {
    if (!value) return '-';
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DetailRow({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-white">{value || '-'}</p>
        </div>
    );
}

function TherapistProfileModal({ therapist, centerSettings, onClose, onEdit, onOpenLetter, onOpenWhatsApp }) {
    if (!therapist) return null;
    const raw = therapist.raw || therapist;
    const whatsappUrl = buildTherapistRegistrationWhatsAppUrl({ therapist: raw, centerSettings });
    const scheduleEntries = Object.entries(raw.schedule || therapist.schedule || {}).filter(([, value]) => value);

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
            <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Profil terapis</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{raw.name || therapist.name}</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">NIT: {raw.nit || therapist.id}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <DetailRow label="Peran / spesialisasi" value={raw.specialty || raw.specialization || therapist.specializations?.[0]} />
                        <DetailRow label="Status" value={therapist.status} />
                        <DetailRow label="Email" value={raw.email} />
                        <DetailRow label="WhatsApp" value={raw.phone} />
                        <DetailRow label="Nomor STR" value={raw.strNumber} />
                        <DetailRow label="Masa berlaku STR" value={formatDate(raw.strExpiry)} />
                        <DetailRow label="Pendidikan" value={[raw.educationLevel, raw.educationField, raw.educationInstitution].filter(Boolean).join(' - ')} />
                        <DetailRow label="Pengalaman" value={raw.yearsExperience} />
                    </div>
                    <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="text-sm font-black text-slate-900 dark:text-white">Jadwal kerja</p>
                        {scheduleEntries.length === 0 ? (
                            <p className="mt-2 text-sm font-semibold text-slate-400">Belum ada jadwal kerja aktif.</p>
                        ) : (
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {scheduleEntries.map(([day, value]) => (
                                    <div key={day} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                                        <span className="text-[11px] font-black uppercase text-slate-400">{day}</span>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{value.start || '-'} - {value.end || '-'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
                        Surat registrasi berisi kredensial awal dan bersifat rahasia. Untuk terapis lama, password tidak ditampilkan kecuali admin melakukan reset password.
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onEdit} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                        Edit Jadwal & STR
                    </button>
                    <button type="button" onClick={onOpenLetter} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                        Preview Surat
                    </button>
                    <button
                        type="button"
                        onClick={onOpenWhatsApp}
                        disabled={!whatsappUrl}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, tone = 'slate' }) {
    const toneClass = tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : tone === 'blue'
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : tone === 'red'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-slate-200 bg-slate-50 text-slate-800';
    return (
        <div className={`rounded-xl border p-4 ${toneClass}`}>
            <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
        </div>
    );
}

function TherapistPerformanceModal({ therapist, stats, loading, onClose }) {
    if (!therapist) return null;
    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
            <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Statistik operasional</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Kinerja {therapist.name}</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Read-only untuk admin. Tidak mengubah data sesi atau laporan.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <StatCard label="Total sesi" value={stats.totalSessions} tone="blue" />
                                <StatCard label="Sesi selesai" value={stats.doneSessions} tone="green" />
                                <StatCard label="Sedang berjalan" value={stats.activeSessions} tone="blue" />
                                <StatCard label="Dibatalkan" value={stats.cancelledSessions} tone="red" />
                                <StatCard label="Laporan dibuat" value={stats.totalReports} />
                                <StatCard label="Laporan perlu revisi" value={stats.revisionReports} tone="red" />
                            </div>
                            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                Tingkat penyelesaian sesi: <strong className="text-slate-950 dark:text-white">{stats.completionRate}%</strong>. Data dihitung dari sesi dan laporan real yang terhubung ke NIT terapis ini.
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function App() {
    const navigate = useNavigate();
    const clinicSettings = useClinicSettings();
    const [searchQuery, setSearchQuery] = useState('');
    const [specializationFilter, setSpecializationFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [therapists, setTherapists] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [viewingTherapist, setViewingTherapist] = useState(null);
    const [performanceTherapist, setPerformanceTherapist] = useState(null);
    const [performanceStats, setPerformanceStats] = useState(null);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [sessions, setSessions] = useState([]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadData = async () => {
        try {
            const [tRes, pRes, sRes] = await Promise.all([
                therapistsApi.getAll(),
                adminApi.getPrograms(),
                sessionsApi.getAll().catch(() => ({ data: { data: [] } }))
            ]);
            
            const raw = tRes.data?.data || [];
            const sessionRows = sRes.data?.data || [];
            const today = new Date().toISOString().split('T')[0];
            // Transform store structure to the card structure
            const transformed = raw.map(t => {
                const specArray = t.specializations ? t.specializations : t.specialization ? [t.specialization] : [];
                const sessionsToday = sessionRows.filter(session => session.therapistId === t.id && session.date === today && session.status !== 'cancelled').length;
                return {
                    name: t.name,
                    id: t.id,
                    avatar: t.avatar || '',
                    specializations: specArray,
                    status: t.status === 'active' ? 'Aktif' : t.status === 'inactive' ? 'Tidak Aktif' : 'Jeda',
                    statusColor: t.status === 'active' ? 'green' : t.status === 'inactive' ? 'slate' : 'orange',
                    sessionsToday,
                    inactive: t.status === 'inactive',
                    schedule: t.schedule || {},
                    primaryRoom: t.primaryRoom || '',
                    maxClients: t.maxClients ?? '',
                    raw: t,
                };
            });
            setTherapists(transformed);
            setSessions(sessionRows);
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

    const openProfile = (id) => {
        const therapist = therapists.find(item => item.id === id);
        if (!therapist) return;
        setViewingTherapist(therapist);
    };

    const handleOpenLetter = async (therapist) => {
        const raw = therapist?.raw || therapist;
        const result = await openTherapistRegistrationLetter({
            therapist: raw,
            centerSettings: clinicSettings.settings,
        });
        if (!result.ok) {
            showToast('Preview surat gagal dibuka. Izinkan pop-up browser lalu coba lagi.', 'error');
        }
    };

    const handleOpenWhatsApp = (therapist) => {
        const raw = therapist?.raw || therapist;
        const url = buildTherapistRegistrationWhatsAppUrl({
            therapist: raw,
            centerSettings: clinicSettings.settings,
        });
        if (!url) {
            showToast('Nomor WhatsApp terapis belum tersedia.', 'error');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openPerformance = async (id) => {
        const therapist = therapists.find(item => item.id === id);
        if (!therapist) return;
        setPerformanceTherapist(therapist);
        setPerformanceStats(null);
        setPerformanceLoading(true);
        try {
            const [sessionRows, reportsRes] = await Promise.all([
                Promise.resolve(sessions.filter(session => session.therapistId === id)),
                reportsApi.getForTherapist(id).catch(() => ({ data: { data: [] } })),
            ]);
            const reports = reportsRes.data?.data || [];
            const doneSessions = sessionRows.filter(session => ['done', 'completed'].includes(session.status)).length;
            const totalSessions = sessionRows.length;
            const completionRate = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;
            setPerformanceStats({
                totalSessions,
                doneSessions,
                activeSessions: sessionRows.filter(session => session.status === 'active').length,
                cancelledSessions: sessionRows.filter(session => session.status === 'cancelled').length,
                totalReports: reports.length,
                revisionReports: reports.filter(report => report.status === 'needs_revision').length,
                completionRate,
            });
        } catch (error) {
            console.error(error);
            showToast('Gagal memuat statistik terapis.', 'error');
        } finally {
            setPerformanceLoading(false);
        }
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
            <main className="flex min-w-0 flex-1 justify-center px-4 py-6 sm:px-10 sm:py-8">
                <div className="layout-content-container flex w-full max-w-[1200px] min-w-0 flex-1 flex-col">

                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between gap-3 mb-6 items-center">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">Manajemen Terapis</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Kelola profil, STR, spesialisasi, dan ketersediaan terapis.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => navigate('/therapist-registration')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background-dark rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Tambah Terapis
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-primary/20">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Spesialisasi:</span>
                            <select 
                                value={specializationFilter}
                                onChange={(e) => setSpecializationFilter(e.target.value)}
                                className="form-select bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg text-slate-700 dark:text-slate-300 text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="">Semua Spesialisasi</option>
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
                                <option value="">Semua Status</option>
                                <option value="Aktif">Aktif</option>
                                <option value="Jeda">Jeda</option>
                                <option value="Tidak Aktif">Tidak Aktif</option>
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
                                    onView={openProfile}
                                    onEdit={openScheduleEditor}
                                    onPerformance={openPerformance}
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
            {viewingTherapist && (
                <TherapistProfileModal
                    therapist={viewingTherapist}
                    centerSettings={clinicSettings.settings}
                    onClose={() => setViewingTherapist(null)}
                    onEdit={() => {
                        setEditingSchedule(viewingTherapist);
                        setViewingTherapist(null);
                    }}
                    onOpenLetter={() => handleOpenLetter(viewingTherapist)}
                    onOpenWhatsApp={() => handleOpenWhatsApp(viewingTherapist)}
                />
            )}
            {performanceTherapist && (
                <TherapistPerformanceModal
                    therapist={performanceTherapist}
                    stats={performanceStats || {
                        totalSessions: 0,
                        doneSessions: 0,
                        activeSessions: 0,
                        cancelledSessions: 0,
                        totalReports: 0,
                        revisionReports: 0,
                        completionRate: 0,
                    }}
                    loading={performanceLoading}
                    onClose={() => setPerformanceTherapist(null)}
                />
            )}
        </>
    );
}

export default App;
