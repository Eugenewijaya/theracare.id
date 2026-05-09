import React, { useState, useEffect } from 'react';
import TopNavBar from './components/TopNavBar';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import Legend from './components/Legend';
import SidePanel from './components/SidePanel';
import { sessionsApi, childrenApi, therapistsApi, adminApi } from '../../shared/api/client';

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
function EditSessionModal({ session, childrenList, therapistsList, programsList, onSave, onDelete, onMarkLeave, onClose }) {
    const [form, setForm] = useState({
        therapistId: session.therapistId || '',
        program:     session.focus || '',
        startTime:   session.startTime || '09:00',
        duration:    (session.duration || '60 mins').replace(' mins', ''),
    });

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const childName = childrenList.find(c => c.id === session.childId)?.name || session.childId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div
                className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden"
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
                <div className="p-6 flex flex-col gap-4">
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
                    <div className="grid grid-cols-2 gap-4">
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
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3">
                    <button
                        onClick={() => onDelete(session.id)}
                        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Hapus
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onMarkLeave(session.id)}
                            className="px-4 py-2 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[16px]">event_busy</span>
                            Cuti Terapis
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={() => onSave(session.id, form)}
                            className="px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors flex items-center gap-2"
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

function App() {
    const today = new Date();
    const [currentView, setCurrentView] = useState('Month');
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editSession, setEditSession] = useState(null); // session object being edited
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

    // Called from CalendarGrid when clicking on a blank date
    const handleDateClick = (dateObj) => {
        setSelectedDate(dateObj);
        setIsAddModalOpen(true);
        setNewSession({ sessionKind: 'regular', child: '', visitorName: '', startTime: '09:00', duration: '60', therapistId: '', program: '' });
    };

    // Called from CalendarGrid when clicking on an event pill
    const handleEventClick = (session, e) => {
        e.stopPropagation();
        if (session.isOneTime) {
            showToast('One-time visit tersimpan sebagai log dan tidak mengubah data anak.', 'info');
            return;
        }
        setEditSession(session);
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
        if (!window.confirm('Yakin ingin menghapus sesi ini? Tindakan ini tidak dapat dibatalkan.')) return;
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
        if (!window.confirm('Tandai sesi ini merah karena terapis cuti? Orang tua perlu diarahkan ke reschedule atau terapis pendamping.')) return;
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

    return (
        <>
            {/* Top Navigation Bar */}
            <TopNavBar />

            <div className="flex flex-1 overflow-hidden relative">
                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <CalendarHeader
                        currentView={currentView}
                        setCurrentView={setCurrentView}
                        currentMonth={currentMonth}
                        currentYear={currentYear}
                        onPrev={handlePrevMonth}
                        onNext={handleNextMonth}
                        filters={filters}
                        setFilters={setFilters}
                    />

                    {/* Calendar Grid */}
                    <div className="flex-1 overflow-auto p-6 flex flex-col">
                        <CalendarGrid
                            currentView={currentView}
                            onDateClick={handleDateClick}
                            onEventClick={handleEventClick}
                            selectedMonth={currentMonth}
                            selectedYear={currentYear}
                            sessions={filteredSessions}
                        />
                        <Legend />
                    </div>
                </main>

                {/* Side Panel */}
                {isSidePanelOpen ? (
                    <SidePanel onClose={() => setIsSidePanelOpen(false)} selectedDate={selectedDate} sessions={filteredSessions} onEventClick={handleEventClick} />
                ) : (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                        <button
                            onClick={() => setIsSidePanelOpen(true)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-l-lg py-4 px-1 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            title="Buka Side Panel"
                        >
                            <span className="material-symbols-outlined text-slate-500">chevron_left</span>
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
                    onClose={() => setEditSession(null)}
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
