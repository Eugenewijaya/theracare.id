import React, { useState, useEffect } from 'react';
import TopNavBar from './components/TopNavBar';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import Legend from './components/Legend';
import SidePanel from './components/SidePanel';
import { sessionsApi, childrenApi, therapistsApi, adminApi, substituteRequestsApi } from '../../shared/api/client';
import { confirmAction } from '../../shared/ui/confirmDialog';

const LEAVE_REASONS = [
    { value: 'cuti', label: 'Cuti' },
    { value: 'sakit', label: 'Sakit' },
    { value: 'unpaid_leave', label: 'Unpaid Leave' },
];

const getLeaveLabel = (value) => LEAVE_REASONS.find(item => item.value === value)?.label || 'Off';

const getTherapistName = (therapistsList, therapistId) =>
    therapistsList.find(item => item.id === therapistId)?.name || therapistId || 'Terapis';

const getChildName = (childrenList, childId) =>
    childrenList.find(item => item.id === childId)?.name || childId || 'Anak';

const parseJsonSetting = (value, fallback) => {
    try {
        return JSON.parse(value || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
};

// ── Toast Notification ──────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
    React.useEffect(() => {
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [onClose]);

    const config = {
        success: { bg: 'bg-emerald-600', icon: 'check_circle' },
        error:   { bg: 'bg-red-600', icon: 'error' },
        info:    { bg: 'bg-blue-600', icon: 'info' },
    }[type] || { bg: 'bg-emerald-600', icon: 'check_circle' };

    return (
        <div
            className={`fixed bottom-6 right-6 z-[500] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-semibold text-sm ${config.bg}`}
            style={{ animation: 'slideUp 0.3s ease-out' }}
        >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{config.icon}</span>
            {message}
            <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
                <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
}

// ── Edit Session Modal ──────────────────────────────────────────────────────
function EditSessionModal({ session, childrenList, therapistsList, programsList, onSave, onDelete, onMarkLeave, onAssignSubstitute, onClose }) {
    const [form, setForm] = useState({
        therapistId: session.therapistId || '',
        program:     session.focus || '',
        startTime:   session.startTime || '09:00',
        duration:    (session.duration || '60 mins').replace(' mins', ''),
    });

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const childName = getChildName(childrenList, session.childId);
    const currentTherapistName = getTherapistName(therapistsList, session.therapistId);
    const hasReplacementNote = String(session.cancelReason || session.notes || '').toLowerCase().includes('pengganti');

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div
                className="my-auto bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[calc(100vh-1.5rem)] overflow-hidden flex flex-col"
                style={{ animation: 'scaleIn 0.2s ease-out' }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">edit_calendar</span>
                        Edit Sesi
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto">
                    {/* Read-only info */}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {new Date(session.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Pasien: <span className="font-semibold text-slate-700 dark:text-slate-300">{childName}</span>
                            </p>
                        </div>
                    </div>

                    {hasReplacementNote && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                            Sesi ini memiliki catatan pergantian terapis. Terapis bertugas saat ini: {currentTherapistName}.
                        </div>
                    )}

                    {/* Terapis */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Terapis</label>
                        <select
                            value={form.therapistId}
                            onChange={e => update('therapistId', e.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        >
                            <option value="">Pilih terapis...</option>
                            {therapistsList.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Program */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fokus Program</label>
                        <select
                            value={form.program}
                            onChange={e => update('program', e.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        >
                            <option value="">Pilih program...</option>
                            {programsList.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Time & Duration */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jam Mulai</label>
                            <input
                                type="time"
                                value={form.startTime}
                                onChange={e => update('startTime', e.target.value)}
                                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Durasi</label>
                            <select
                                value={form.duration}
                                onChange={e => update('duration', e.target.value)}
                                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            >
                                <option value="30">30 menit</option>
                                <option value="45">45 menit</option>
                                <option value="60">60 menit</option>
                                <option value="90">90 menit</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 sm:px-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        onClick={() => onDelete(session.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 sm:justify-start"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Hapus
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                        <button
                            onClick={() => onMarkLeave(session.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 sm:px-4"
                        >
                            <span className="material-symbols-outlined text-[16px]">event_busy</span>
                            Cuti Terapis
                        </button>
                        <button
                            onClick={() => onAssignSubstitute(session)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 sm:px-4"
                        >
                            <span className="material-symbols-outlined text-[16px]">person_add</span>
                            Atur Pengganti
                        </button>
                        <button
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 sm:px-4"
                        >
                            Batal
                        </button>
                        <button
                            onClick={() => onSave(session.id, form)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 sm:px-5"
                        >
                            <span className="material-symbols-outlined text-[16px]">save</span>
                            Simpan
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.93) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
        </div>
    );
}

function SubstituteTherapistModal({ session, childrenList, therapistsList, allSessions, onSubmit, onClose }) {
    const [leaveType, setLeaveType] = useState('cuti');
    const [substituteTherapistId, setSubstituteTherapistId] = useState('');
    const [note, setNote] = useState('');
    const [confirmedContact, setConfirmedContact] = useState(false);

    const childName = getChildName(childrenList, session.childId);
    const originalTherapistName = getTherapistName(therapistsList, session.therapistId);
    const isTherapistBusy = (therapistId) => (allSessions || []).some(item => (
        item.id !== session.id
        && item.therapistId === therapistId
        && item.date === session.date
        && item.startTime === session.startTime
        && !['cancelled', 'done'].includes(item.status)
    ));
    const substituteOptions = therapistsList
        .filter(t => t.id !== session.therapistId && (t.status || 'active') === 'active')
        .map(t => ({
            ...t,
            hasConflict: isTherapistBusy(t.id),
        }));
    const selectedSubstitute = substituteOptions.find(t => t.id === substituteTherapistId);
    const canSubmit = leaveType && substituteTherapistId && confirmedContact && !selectedSubstitute?.hasConflict;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(session.id, { leaveType, substituteTherapistId, note: note.trim() });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden"
                style={{ animation: 'scaleIn 0.2s ease-out' }}
            >
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">supervisor_account</span>
                            Atur Terapis Pengganti
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {childName} - {session.date} pukul {session.startTime}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-black">Pastikan kamu sudah menghubungi terapis terkait untuk aksi ini.</p>
                        <p className="mt-1 text-xs font-semibold">Terapis utama saat ini: {originalTherapistName}. Sistem akan mengirim konfirmasi ke terapis utama lebih dulu. Sesi baru berpindah setelah disetujui.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status Terapis Utama</label>
                            <select
                                value={leaveType}
                                onChange={e => setLeaveType(e.target.value)}
                                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                {LEAVE_REASONS.map(reason => (
                                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Terapis Pengganti</label>
                            <select
                                value={substituteTherapistId}
                                onChange={e => setSubstituteTherapistId(e.target.value)}
                                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">Pilih terapis...</option>
                                {substituteOptions.map(t => (
                                    <option key={t.id} value={t.id} disabled={t.hasConflict}>
                                        {t.name} ({t.specialty || t.specialization || 'Terapis'}){t.hasConflict ? ' - Bentrok jadwal' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedSubstitute?.hasConflict && (
                                <p className="text-xs font-semibold text-red-600">Terapis ini sedang punya sesi pada jam yang sama.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Admin</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="Contoh: Terapis utama sudah konfirmasi via WhatsApp, pengganti mengambil sesi hari ini."
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                        />
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <input
                            type="checkbox"
                            checked={confirmedContact}
                            onChange={e => setConfirmedContact(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Saya sudah menghubungi terapis terkait, dan siap mengirim permintaan konfirmasi ke terapis utama.
                        </span>
                    </label>
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="px-5 py-2 text-sm font-black text-white bg-primary hover:bg-primary/90 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        Kirim Konfirmasi
                    </button>
                </div>
            </form>
            <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.93) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
        </div>
    );
}

function App() {
    const today = new Date();
    const [currentView, setCurrentView] = useState('Month');
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.matchMedia('(min-width: 768px)').matches;
    });
    const [selectedDate, setSelectedDate] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editSession, setEditSession] = useState(null); // session object being edited
    const [replacementSession, setReplacementSession] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [filters, setFilters] = useState({
        therapist: 'All Therapists',
        child: 'All Children',
        program: 'All Programs',
    });
    const [toast, setToast] = useState(null);

    // Data state
    const [allSessions, setAllSessions] = useState([]);
    const [oneTimeVisits, setOneTimeVisits] = useState([]);
    const [childrenList, setChildrenList] = useState([]);
    const [therapistsList, setTherapistsList] = useState([]);
    const [programsList, setProgramsList] = useState([]);

    useEffect(() => {
        const loadDb = async () => {
            try {
                const [sessRes, childRes, therRes, progRes, settingsRes] = await Promise.all([
                    sessionsApi.getAll(),
                    childrenApi.getAll(),
                    therapistsApi.getAll(),
                    adminApi.getPrograms(),
                    adminApi.getSettings()
                ]);
                setAllSessions(sessRes.data?.data || []);
                setChildrenList(childRes.data?.data || []);
                setTherapistsList(therRes.data?.data || []);
                setProgramsList(progRes.data?.data || []);
                setOneTimeVisits(parseJsonSetting(settingsRes.data?.data?.oneTimeVisitLog, []));
            } catch (e) {
                console.error(e);
            }
        };
        loadDb();
    }, []);

    const calendarSessions = React.useMemo(() => [
        ...allSessions,
        ...oneTimeVisits.map((visit) => ({
            ...visit,
            isOneTime: true,
            childId: '',
            child: { name: visit.visitorName },
            focus: visit.program,
            status: 'one_time_visit',
        })),
    ], [allSessions, oneTimeVisits]);

    const filteredSessions = React.useMemo(() => {
        return calendarSessions.filter(s => {
            if (filters.therapist !== 'All Therapists') {
                const tr = therapistsList.find(t => t.id === s.therapistId);
                if (!tr || tr.name !== filters.therapist) return false;
            }
            if (s.isOneTime && filters.child !== 'All Children') return false;
            if (filters.child !== 'All Children') {
                const ch = childrenList.find(c => c.id === s.childId);
                if (!ch || ch.name !== filters.child) return false;
            }
            if (filters.program !== 'All Programs' && s.focus !== filters.program) return false;
            return true;
        });
    }, [calendarSessions, filters, childrenList, therapistsList]);

    // New session form state
    const [newSession, setNewSession] = useState({
        sessionKind: 'regular',
        child: '',
        visitorName: '',
        therapistId: '',
        program: '',
        startTime: '09:00',
        duration: '60',
    });

    const resetNewSession = () => {
        setNewSession({ sessionKind: 'regular', child: '', visitorName: '', startTime: '09:00', duration: '60', therapistId: '', program: '' });
    };

    const handleChildChange = (e) => {
        const childId = e.target.value;
        const child = childrenList.find(c => c.id === childId);
        setNewSession(prev => ({
            ...prev,
            child: childId,
            therapistId: child?.therapistId || '',
            program: child?.programs?.[0]?.name || child?.program || ''
        }));
    };

    const toDateObject = (dateStr) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    // Called from CalendarGrid when clicking a date cell.
    const handleDateClick = (dateObj) => {
        setSelectedDate(dateObj);
        setIsSidePanelOpen(true);
    };

    const handleOpenAddSession = (dateObj = selectedDate) => {
        setSelectedDate(dateObj || new Date());
        setIsSidePanelOpen(true);
        resetNewSession();
        setIsAddModalOpen(true);
    };

    const openEditSession = (session) => {
        if (session.isOneTime) {
            showToast('One-time visit tersimpan sebagai log dan tidak mengubah data anak.', 'info');
            return;
        }
        setEditSession(session);
    };

    // Called from CalendarGrid when clicking an event pill. Editing stays in the side panel.
    const handleEventClick = (session, e) => {
        e?.stopPropagation?.();
        setSelectedDate(toDateObject(session.date));
        setIsSidePanelOpen(true);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(m => {
            if (m === 0) { setCurrentYear(y => y - 1); return 11; }
            return m - 1;
        });
    };

    const handleNextMonth = () => {
        setCurrentMonth(m => {
            if (m === 11) { setCurrentYear(y => y + 1); return 0; }
            return m + 1;
        });
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentMonth(now.getMonth());
        setCurrentYear(now.getFullYear());
        setSelectedDate(now);
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    const handleSaveSession = async () => {
        if (newSession.sessionKind === 'one_time') {
            if (!newSession.visitorName.trim() || !newSession.therapistId || !newSession.program) {
                showToast('Isi nama calon client, terapis, dan program one-time visit.', 'error');
                return;
            }
        } else if (!newSession.child) {
            showToast('Pilih anak/pasien terlebih dahulu', 'error');
            return;
        }

        let dateStr = '';
        if (selectedDate) {
            const y = selectedDate.getFullYear();
            const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const d = String(selectedDate.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        }

        if (newSession.sessionKind === 'one_time') {
            const visit = {
                id: `OTV-${Date.now().toString(36).toUpperCase()}`,
                visitorName: newSession.visitorName.trim(),
                therapistId: newSession.therapistId,
                program: newSession.program,
                date: dateStr,
                startTime: newSession.startTime,
                duration: `${newSession.duration} mins`,
                notes: 'One-time visit log. Tidak membuat data anak.',
                createdAt: new Date().toISOString(),
            };
            const nextVisits = [...oneTimeVisits, visit];
            const res = await adminApi.updateSettings({ oneTimeVisitLog: JSON.stringify(nextVisits) });
            if (!res.ok) {
                showToast(res.data?.error || 'Gagal menyimpan log one-time visit', 'error');
                return;
            }
            setOneTimeVisits(nextVisits);
            setIsAddModalOpen(false);
            showToast('One-time visit berhasil dicatat di kalender.');
            return;
        }

        const sessionObj = {
            therapistId: newSession.therapistId || '',
            childId: newSession.child,
            date: dateStr,
            startTime: newSession.startTime,
            duration: `${newSession.duration} mins`,
            focus: newSession.program || 'General Therapy',
            status: 'upcoming',
            notes: '',
        };

        try {
            await sessionsApi.create(sessionObj);
            setIsAddModalOpen(false);
            showToast('Sesi berhasil ditambahkan ke jadwal!');
            
            // Reload sessions
            const res = await sessionsApi.getAll();
            setAllSessions(res.data?.data || []);
        } catch(e) {
            showToast('Gagal menambahkan sesi', 'error');
        }
    };

    // ── Edit: save changes ─────────────────────────────────────────────
    const handleEditSave = async (sessionId, form) => {
        const session = allSessions.find(item => item.id === sessionId) || editSession;
        const originalTherapistName = getTherapistName(therapistsList, session?.therapistId);
        const nextTherapistName = getTherapistName(therapistsList, form.therapistId);
        const sensitiveChanges = [];
        const therapistChanged = session?.therapistId !== form.therapistId;
        if (therapistChanged) sensitiveChanges.push(`Terapis: ${originalTherapistName} ke ${nextTherapistName}`);
        if (session?.startTime !== form.startTime) sensitiveChanges.push(`Jam: ${session?.startTime || '-'} ke ${form.startTime}`);
        if ((session?.duration || '').replace(' mins', '') !== String(form.duration)) sensitiveChanges.push(`Durasi: ${session?.duration || '-'} ke ${form.duration} menit`);
        if ((session?.focus || '') !== (form.program || '')) sensitiveChanges.push(`Program: ${session?.focus || '-'} ke ${form.program || '-'}`);
        if (sensitiveChanges.length > 0) {
            const confirmed = await confirmAction({
                tone: 'warning',
                icon: 'rule',
                title: 'Konfirmasi perubahan jadwal',
                message: therapistChanged
                    ? 'Pergantian terapis akan dikirim sebagai permintaan konfirmasi ke terapis utama. Jadwal belum berpindah sampai disetujui.'
                    : 'Perubahan ini akan masuk audit log dan notifikasi dikirim ke terapis utama untuk dicek.',
                details: sensitiveChanges.join(' | '),
                confirmText: therapistChanged ? 'Kirim konfirmasi' : 'Simpan & kirim notifikasi',
                cancelText: 'Batal',
            });
            if (!confirmed) return;
        }
        if (therapistChanged) {
            try {
                const res = await substituteRequestsApi.create({
                    sessionId,
                    leaveType: 'cuti',
                    substituteTherapistId: form.therapistId,
                    note: `Admin mengajukan pergantian terapis dari ${originalTherapistName} ke ${nextTherapistName}. ${form.program !== session?.focus ? `Catatan program: ${session?.focus || '-'} ke ${form.program || '-'}.` : ''}`,
                });
                if (!res.ok) {
                    showToast(res.data?.error || 'Gagal mengirim konfirmasi ke terapis utama.', 'error');
                    return;
                }
                setEditSession(null);
                showToast('Konfirmasi pergantian sudah dikirim ke terapis utama.', 'success');
                window.dispatchEvent(new Event('notificationsUpdated'));
                return;
            } catch (e) {
                showToast('Gagal mengirim konfirmasi ke terapis utama.', 'error');
                return;
            }
        }
        if (sensitiveChanges.length > 0) {
            try {
                const res = await substituteRequestsApi.createSessionUpdate({
                    sessionId,
                    updates: {
                        focus: form.program,
                        startTime: form.startTime,
                        duration: `${form.duration} mins`,
                    },
                    note: `Admin mengajukan perubahan jadwal/program: ${sensitiveChanges.join(' | ')}`,
                });
                if (!res.ok) {
                    showToast(res.data?.error || 'Gagal mengirim konfirmasi perubahan jadwal/program.', 'error');
                    return;
                }
                setEditSession(null);
                showToast('Konfirmasi perubahan jadwal/program dikirim ke terapis utama.', 'success');
                window.dispatchEvent(new Event('notificationsUpdated'));
                return;
            } catch (e) {
                showToast('Gagal mengirim konfirmasi perubahan jadwal/program.', 'error');
                return;
            }
        }
        try {
            await sessionsApi.update(sessionId, {
                therapistId: form.therapistId,
                focus:       form.program,
                startTime:   form.startTime,
                duration:    `${form.duration} mins`,
            });
            showToast('Sesi berhasil diperbarui!');
            setEditSession(null);
            
            const res = await sessionsApi.getAll();
            setAllSessions(res.data?.data || []);
        } catch (e) {
            showToast('Gagal memperbarui sesi', 'error');
        }
    };

    // ── Edit: delete session ───────────────────────────────────────────
    const handleEditDelete = async (sessionId) => {
        const confirmed = await confirmAction({
            tone: 'danger',
            title: 'Hapus sesi ini?',
            message: 'Tindakan ini akan masuk audit log dan tidak bisa dibatalkan dari halaman ini.',
            confirmText: 'Hapus sesi',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        try {
            await sessionsApi.delete(sessionId);
            setEditSession(null);
            showToast('Sesi berhasil dihapus.', 'info');
            
            const res = await sessionsApi.getAll();
            setAllSessions(res.data?.data || []);
        } catch (e) {
            showToast('Gagal menghapus sesi', 'error');
        }
    };

    const handleMarkTherapistLeave = async (sessionId) => {
        const confirmed = await confirmAction({
            tone: 'warning',
            title: 'Tandai terapis off?',
            message: 'Sesi akan ditandai merah. Pastikan orang tua diarahkan untuk reschedule atau gunakan terapis pendamping.',
            confirmText: 'Tandai off',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        try {
            await sessionsApi.updateStatus(sessionId, 'cancelled', 'Terapis cuti - sarankan reschedule atau jadwalkan dengan terapis pendamping.');
            setEditSession(null);
            showToast('Sesi ditandai sebagai cuti terapis.', 'info');
            const res = await sessionsApi.getAll();
            setAllSessions(res.data?.data || []);
        } catch (e) {
            showToast('Gagal menandai cuti terapis', 'error');
        }
    };

    const handleOpenSubstitute = (session) => {
        if (session.status === 'done' || session.status === 'active') {
            showToast('Pergantian terapis hanya bisa dilakukan sebelum sesi berjalan atau setelah sesi dibuka ulang.', 'error');
            return;
        }
        setReplacementSession(session);
    };

    const handleAssignSubstitute = async (sessionId, { leaveType, substituteTherapistId, note }) => {
        const session = allSessions.find(item => item.id === sessionId) || replacementSession;
        if (!session) return;

        try {
            const res = await substituteRequestsApi.create({
                sessionId,
                leaveType,
                substituteTherapistId,
                note,
            });
            if (!res.ok) {
                showToast(res.data?.error || 'Gagal mengirim konfirmasi terapis pengganti.', 'error');
                return;
            }
            setReplacementSession(null);
            setEditSession(null);
            showToast('Konfirmasi sudah dikirim ke terapis utama. Sesi akan berpindah setelah disetujui.', 'success');
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error(e);
            showToast(e.message || 'Gagal mengirim konfirmasi terapis pengganti.', 'error');
        }
    };

    return (
        <>
            {/* Top Navigation Bar */}
            <TopNavBar />

            <div className="relative flex min-w-0 flex-1 overflow-hidden">
                {/* Main Content Area */}
                <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <CalendarHeader
                        currentView={currentView}
                        setCurrentView={setCurrentView}
                        currentMonth={currentMonth}
                        currentYear={currentYear}
                        onPrev={handlePrevMonth}
                        onNext={handleNextMonth}
                        onToday={handleToday}
                        filters={filters}
                        setFilters={setFilters}
                    />

                    {/* Calendar Grid */}
                    <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col">
                        <CalendarGrid
                            currentView={currentView}
                            onDateClick={handleDateClick}
                            onEventClick={handleEventClick}
                            selectedMonth={currentMonth}
                            selectedYear={currentYear}
                            sessions={filteredSessions}
                            childrenList={childrenList}
                        />
                        <Legend />
                    </div>
                </main>

                {/* Side Panel */}
                {isSidePanelOpen ? (
                    <SidePanel
                        onClose={() => setIsSidePanelOpen(false)}
                        selectedDate={selectedDate}
                        sessions={filteredSessions}
                        childrenList={childrenList}
                        therapistsList={therapistsList}
                        onAddSession={handleOpenAddSession}
                        onEditSession={openEditSession}
                    />
                ) : (
                    <div className="fixed bottom-5 right-4 z-30 md:absolute md:bottom-auto md:right-0 md:top-1/2 md:-translate-y-1/2">
                        <button
                            onClick={() => setIsSidePanelOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-xl transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:rounded-l-xl md:rounded-r-none md:px-2 md:py-4"
                            title="Buka info sesi tanggal ini"
                        >
                            <span className="material-symbols-outlined text-primary">chevron_left</span>
                            <span className="md:hidden">Info Sesi</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Add Session Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div
                        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden"
                        style={{ animation: 'scaleIn 0.2s ease-out' }}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">event_available</span>
                                Tambah Sesi
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 flex flex-col gap-4">
                            <div className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light px-4 py-3 rounded-lg flex items-center gap-3">
                                <span className="material-symbols-outlined">calendar_today</span>
                                <div className="text-sm font-semibold">
                                    {selectedDate ? selectedDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Pilih Tanggal'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                                {[
                                    { key: 'regular', label: 'Sesi Anak' },
                                    { key: 'one_time', label: 'One-time Visit' },
                                ].map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => setNewSession(p => ({ ...p, sessionKind: option.key }))}
                                        className={`h-10 rounded-lg text-sm font-black transition-colors ${newSession.sessionKind === option.key ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {newSession.sessionKind === 'regular' ? (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Anak / Pasien <span className="text-red-500">*</span></label>
                                    <select
                                        value={newSession.child}
                                        onChange={handleChildChange}
                                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer"
                                    >
                                        <option value="">Pilih anak...</option>
                                        {childrenList.map((ch) => (
                                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama calon client <span className="text-red-500">*</span></label>
                                    <input
                                        value={newSession.visitorName}
                                        onChange={e => setNewSession(p => ({ ...p, visitorName: e.target.value }))}
                                        placeholder="Contoh: Calon Client - konsultasi awal"
                                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    />
                                    <p className="text-xs text-slate-500">Nama ini hanya masuk log one-time visit dan tidak membuat data anak baru.</p>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex justify-between">
                                    <span>Terapis</span>
                                    <span className="text-xs font-normal opacity-70">Otomatis / dapat diganti</span>
                                </label>
                                <select
                                    value={newSession.therapistId}
                                    onChange={e => setNewSession(p => ({ ...p, therapistId: e.target.value }))}
                                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer"
                                >
                                    <option value="">Pilih Terapis...</option>
                                    {therapistsList.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.specialty})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fokus Program</label>
                                <select
                                    value={newSession.program}
                                    onChange={e => setNewSession(p => ({ ...p, program: e.target.value }))}
                                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer"
                                >
                                    <option value="">Pilih Program...</option>
                                    {programsList.map(prog => (
                                        <option key={prog.id} value={prog.name}>{prog.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jam Mulai</label>
                                    <input
                                        type="time"
                                        value={newSession.startTime}
                                        onChange={e => setNewSession(p => ({ ...p, startTime: e.target.value }))}
                                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Durasi</label>
                                    <select
                                        value={newSession.duration}
                                        onChange={e => setNewSession(p => ({ ...p, duration: e.target.value }))}
                                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer"
                                    >
                                        <option value="15">15 menit</option>
                                        <option value="30">30 menit</option>
                                        <option value="45">45 menit</option>
                                        <option value="60">60 menit</option>
                                        {newSession.sessionKind === 'regular' && <option value="90">90 menit</option>}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveSession}
                                className="px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">save</span>
                                Simpan Sesi
                            </button>
                        </div>
                    </div>
                    <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.93) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
                </div>
            )}

            {/* Edit Session Modal */}
            {editSession && (
                <EditSessionModal
                    session={editSession}
                    childrenList={childrenList}
                    therapistsList={therapistsList}
                    programsList={programsList}
                    onSave={handleEditSave}
                    onDelete={handleEditDelete}
                    onMarkLeave={handleMarkTherapistLeave}
                    onAssignSubstitute={handleOpenSubstitute}
                    onClose={() => setEditSession(null)}
                />
            )}

            {replacementSession && (
                <SubstituteTherapistModal
                    session={replacementSession}
                    childrenList={childrenList}
                    therapistsList={therapistsList}
                    allSessions={allSessions}
                    onSubmit={handleAssignSubstitute}
                    onClose={() => setReplacementSession(null)}
                />
            )}

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}

export default App;
