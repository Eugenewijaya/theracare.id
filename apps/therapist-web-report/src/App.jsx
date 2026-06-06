import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import { getRoleHistoryFilters, sessionsApi, reportsApi, adminApi } from '../../shared/api/client';
import { useClinicSettings } from '../../shared/clinicSettings';
import { openReportPdf } from '../../shared/reportPdf';
import { readTherapistUser } from '../../shared/sessionIdentity';
import { getCurrentTherapyPeriods } from '../../shared/therapyPeriods';
import {
    buildDailyReportQueue,
    getReportEditWindow,
    hasPriorMissingDailyReport,
    normalizeDateValue,
    sessionSortKey,
} from '../../shared/reportRules';

// ── Shared data store helpers ──────────

const isTherapistAssignedToPeriod = (period, therapistId) => {
    if (!therapistId || !period) return false;
    const scheduleRules = Array.isArray(period.scheduleRules) ? period.scheduleRules : [];
    return scheduleRules.some(rule => rule?.therapistId === therapistId)
        || (Array.isArray(period.assistantTherapistIds) && period.assistantTherapistIds.includes(therapistId));
};

const getChildrenFromSessions = (sessions, options = {}) => {
    const therapistId = options.therapistId || '';
    const programOnly = Boolean(options.programOnly);
    try {
        const childMap = new Map();
        sessions.forEach(s => {
            if (s.child && !childMap.has(s.child.id)) {
                const childSessions = sessions.filter(sess => sess.childId === s.child.id);
                const currentPeriods = getCurrentTherapyPeriods(s.child);
                const activePeriod = currentPeriods.find(period => String(period.status || '').toLowerCase() === 'active') || currentPeriods[0] || null;
                if (programOnly && !isTherapistAssignedToPeriod(activePeriod, therapistId)) return;
                const periodSessions = activePeriod?.id
                    ? childSessions.filter(sess => sess.therapyPeriodId === activePeriod.id)
                    : childSessions;
                const completed = activePeriod?.completedSessions ?? periodSessions.filter(sess => sess.status === 'done').length;
                const total = activePeriod?.totalSessions || periodSessions.length || childSessions.length;
                childMap.set(s.child.id, {
                    ...s.child,
                    program: activePeriod?.program?.name || activePeriod?.therapyProgram?.type || s.child.therapyPrograms?.[0]?.type || 'General Therapy',
                    activePeriodId: activePeriod?.id || '',
                    totalSessions: total,
                    completedSessions: completed
                });
            }
        });
        return Array.from(childMap.values());
    } catch { return []; }
};

const buildEvaluationMap = (values) => {
    const result = {};
    EVAL_ASPECTS.forEach(aspect => {
        if (values?.[aspect.id]) {
            result[aspect.label] = values[aspect.id];
        }
    });
    return result;
};

const parseCommaList = (value) => String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const getDailyContextFromRoute = () => {
    if (typeof window === 'undefined') return { openComposer: false, reportId: '', childId: '', sessionId: '' };
    const url = new URL(window.location.href);
    const openComposer = url.pathname.endsWith('/reports/new');
    const reportId = url.searchParams.get('reportId') || '';
    const childId = url.searchParams.get('childId') || '';
    const sessionId = url.searchParams.get('sessionId') || '';

    return {
        openComposer,
        reportId,
        childId,
        sessionId,
    };
};

const findLinkedSession = (sessions, childId, preferredSessionId = '') => {
    if (!childId) return null;

    const childSessions = sessions
        .filter(session => session.childId === childId)
        .sort((a, b) => sessionSortKey(b).localeCompare(sessionSortKey(a)));

    if (preferredSessionId) {
        const preferred = childSessions.find(session => session.id === preferredSessionId);
        if (preferred) return preferred;
    }

    return childSessions.find(session => session.status === 'done') || childSessions[0] || null;
};

const formatSessionDate = (session) => {
    const date = normalizeDateValue(session?.date);
    if (!date) return '-';
    return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const reportErrorMessage = (res, fallback) => res?.data?.error || res?.data?.message || fallback;

// ── Constants ────────────────────────────────────────────────────────
const EVAL_ASPECTS = [
    { id: 'communication', label: 'Kemampuan Komunikasi & Bicara', icon: 'record_voice_over' },
    { id: 'fine_motor',    label: 'Motorik Halus (Fine Motor)',   icon: 'pan_tool_alt' },
    { id: 'gross_motor',   label: 'Motorik Kasar (Gross Motor)',  icon: 'directions_run' },
    { id: 'sensory',       label: 'Pemrosesan Sensori',           icon: 'accessibility_new' },
    { id: 'social_play',   label: 'Keterampilan Sosial & Bermain',icon: 'extension' },
    { id: 'cognitive',     label: 'Kemampuan Kognitif',           icon: 'psychology' },
    { id: 'self_care',     label: 'Kemandirian (Self-Care)',      icon: 'self_improvement' },
];

const SCALES = [
    { value: 1, label: 'Sangat Kurang', color: 'bg-red-400' },
    { value: 2, label: 'Kurang',        color: 'bg-orange-400' },
    { value: 3, label: 'Cukup',         color: 'bg-amber-400' },
    { value: 4, label: 'Baik',          color: 'bg-teal-400' },
    { value: 5, label: 'Sangat Baik',   color: 'bg-green-500' },
];

const ASPECTS_CHECKBOX = ['Fine Motor Skills', 'Gross Motor Skills', 'Speech & Language', 'Cognitive', 'Social Emotional', 'Self-Care', 'Sensory Processing'];
const PERIODIC_UNLOCK_PERCENT = 50;
const REPORT_SUBMIT_STATUS = 'ready_for_parent';
const REPORT_DRAFT_STATUS = 'draft';

const INITIAL_OBSERVATION_ITEMS = [
    {
        id: 'eye_contact',
        aspect: 'Kontak Mata',
        prompt: 'Respons kontak mata saat diajak bicara dan saat memperhatikan materi terapi.',
    },
    {
        id: 'name_response',
        aspect: 'Respons Ketika Nama Dipanggil',
        prompt: 'Konsistensi anak melihat atau merespons saat namanya dipanggil.',
    },
    {
        id: 'dominant_hand',
        aspect: 'Dominan Tangan',
        prompt: 'Tangan yang paling sering digunakan saat aktivitas, tos, memegang alat tulis, atau bermain.',
    },
    {
        id: 'learning_endurance',
        aspect: 'Ketahanan Belajar',
        prompt: 'Durasi anak dapat duduk, mengikuti instruksi, menunggu giliran, dan menyelesaikan aktivitas.',
    },
    {
        id: 'communication',
        aspect: 'Komunikasi',
        prompt: 'Cara anak meminta sesuatu, menolak aktivitas, mengikuti instruksi, dan menyampaikan kebutuhan.',
    },
    {
        id: 'cognitive',
        aspect: 'Kognitif',
        prompt: 'Pemahaman anggota tubuh, warna, huruf, angka, urutan, pra-akademik, dan pemecahan masalah sederhana.',
    },
    {
        id: 'pre_school',
        aspect: 'Kemampuan Pra Sekolah',
        prompt: 'Kemampuan meniru, menulis, memegang alat tulis, mengikuti tugas meja, dan kesiapan belajar.',
    },
    {
        id: 'motor',
        aspect: 'Kemampuan Motorik',
        prompt: 'Motorik halus, motorik kasar, keseimbangan, koordinasi bilateral, dan respons terhadap aktivitas sensori.',
    },
    {
        id: 'independence',
        aspect: 'Kemandirian',
        prompt: 'Kemampuan menyelesaikan tugas, merapikan alat, mengikuti rutinitas, dan kebutuhan bantuan.',
    },
];

// ── Sub Components ───────────────────────────────────────────────────
function ScaleSelector({ aspectId, value, onChange }) {
    return (
        <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1 flex-wrap sm:flex-nowrap">
            {SCALES.map(scale => (
                <button
                    key={scale.value}
                    type="button"
                    onClick={() => onChange(aspectId, scale.value)}
                    className={`flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold transition-all rounded-md whitespace-nowrap ${
                        value === scale.value
                            ? `${scale.color} text-white shadow-sm`
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    {scale.label}
                </button>
            ))}
        </div>
    );
}

// ── Landing / Gate ───────────────────────────────────────────────────
function ReportLanding({ children, onSelectType }) {
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Laporan Anak</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1.5">Pilih jenis laporan yang ingin Anda buat.</p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Daily Report Card */}
                <button
                    onClick={() => onSelectType('harian')}
                    className="group text-left p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-600 bg-white dark:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                    <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                        <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-[28px]">edit_document</span>
                    </div>
                    <h2 className="text-lg font-bold mb-1.5">Laporan Harian</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Dokumentasikan aktivitas dan kemajuan anak per sesi terapi. Dapat diisi setelah setiap sesi berlangsung.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold text-sm group-hover:gap-3 transition-all">
                        Buat Laporan Harian <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>
                </button>

                {/* Periodic Report Card */}
                <button
                    onClick={() => onSelectType('periodik')}
                    className="group text-left p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[28px]">auto_graph</span>
                    </div>
                    <h2 className="text-lg font-bold mb-1.5">Laporan Periodik</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Rangkuman kemajuan anak dalam sebuah periode program. Bisa mulai dicicil saat progres program mencapai 50%.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-sm group-hover:gap-3 transition-all">
                        Buat Laporan Periodik <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>
                </button>

                <button
                    onClick={() => onSelectType('observasi_awal')}
                    className="group text-left p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 bg-white dark:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                    <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center mb-4 group-hover:bg-sky-100 transition-colors">
                        <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-[28px]">fact_check</span>
                    </div>
                    <h2 className="text-lg font-bold mb-1.5">Observasi Awal</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Catatan kemampuan awal anak dari beberapa sesi observasi sebagai dasar program terapi berikutnya.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-bold text-sm group-hover:gap-3 transition-all">
                        Buat Observasi Awal <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>
                </button>
            </div>

            {/* Report History */}
            <div>
                <h2 className="text-lg font-bold mb-4">Riwayat Sesi & Laporan</h2>
                {children}
            </div>
        </div>
    );
}

// ── Daily Report Gate ────────────────────────────────────────────────
function DailyReportGate({ onConfirm, onBack, childrenData, sessions = [], reports = [], initialChildId = '' }) {
    const children = childrenData;
    const [selectedChild, setSelectedChild] = useState(initialChildId);

    useEffect(() => {
        setSelectedChild(initialChildId);
    }, [initialChildId]);

    const child = children.find(c => c.id === selectedChild);
    const childQueue = buildDailyReportQueue(sessions, reports, selectedChild);
    const missingSession = childQueue.find(row => row.missing)?.session || null;
    const recentRows = [...childQueue].reverse().slice(0, 5);

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span> Kembali
            </button>

            <div>
                <h1 className="text-2xl font-black">Laporan Harian Sesi Terapi</h1>
                <p className="text-slate-500 text-sm mt-1">Pilih anak yang akan dilaporkan sesinya hari ini.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
                <div>
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Pilih Pasien Anak</label>
                    <select
                        value={selectedChild}
                        onChange={e => setSelectedChild(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none font-medium"
                    >
                        <option value="" disabled>Pilih anak yang ditangani...</option>
                        {children.map(c => <option key={c.id} value={c.id}>{c.name} — {c.program}</option>)}
                    </select>
                </div>

                {child && (
                    <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 animate-in fade-in">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-bold text-teal-900 dark:text-teal-200">{child.name}</p>
                                <p className="text-sm text-teal-700 dark:text-teal-400">{child.program}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{child.completedSessions}/{child.totalSessions} Sesi</p>
                                <p className="text-xs text-teal-600">Selesai</p>
                            </div>
                        </div>
                        <div className="mt-3 w-full bg-teal-100 dark:bg-teal-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${child.totalSessions ? Math.round((child.completedSessions / child.totalSessions) * 100) : 0}%` }}></div>
                        </div>
                    </div>
                )}

                {child && missingSession && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-[20px]">priority_high</span>
                            <div>
                                <p className="font-black">Ada laporan sesi sebelumnya yang belum selesai.</p>
                                <p className="mt-1 text-xs font-semibold opacity-80">
                                    Mulai dari sesi {formatSessionDate(missingSession)} pukul {missingSession.startTime || missingSession.time || '-'} agar urutan laporan tetap rapi.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {child && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                        <p className="px-1 pb-2 text-xs font-black uppercase tracking-wider text-slate-500">Riwayat sesi selesai</p>
                        {recentRows.length ? (
                            <div className="space-y-2">
                                {recentRows.map(({ session, report, missing }) => (
                                    <button
                                        key={session.id}
                                        type="button"
                                        onClick={() => missing && onConfirm(selectedChild, session.id)}
                                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                            missing
                                                ? 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-slate-900 dark:text-amber-300'
                                                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        }`}
                                    >
                                        <span className="min-w-0 truncate">{formatSessionDate(session)} - {session.startTime || session.time || '-'} - {session.focus || child.program || 'Sesi terapi'}</span>
                                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${missing ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                                            {missing ? (report?.status === 'needs_revision' ? 'Perlu revisi' : report?.status === REPORT_DRAFT_STATUS ? 'Draft' : 'Belum dilaporkan') : 'Sudah ada laporan'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="px-1 py-4 text-center text-sm font-semibold text-slate-400">Belum ada sesi selesai untuk anak ini.</p>
                        )}
                    </div>
                )}

                <button
                    onClick={() => selectedChild && onConfirm(selectedChild, missingSession?.id || '')}
                    disabled={!selectedChild}
                    className="w-full px-6 py-3 rounded-xl font-bold bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">edit_document</span>
                    {missingSession ? 'Lengkapi Laporan Tertunda' : 'Lanjut ke Formulir Laporan'}
                </button>
            </div>
        </div>
    );
}

// ── Periodic Report Gate ─────────────────────────────────────────────
function PeriodicReportGate({ onConfirm, onBack, childrenData }) {
    const children = childrenData;
    const [selectedChild, setSelectedChild] = useState('');
    const [showBlock, setShowBlock] = useState(false);

    const child = children.find(c => c.id === selectedChild);
    const pct = child && child.totalSessions ? Math.round((child.completedSessions / child.totalSessions) * 100) : 0;
    const canStartDraft = child ? pct >= PERIODIC_UNLOCK_PERCENT : false;

    const handleAttempt = () => {
        if (!selectedChild) return;
        if (!canStartDraft) { setShowBlock(true); return; }
        onConfirm(selectedChild);
    };

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span> Kembali
            </button>

            <div>
                <h1 className="text-2xl font-black">Laporan Periodik</h1>
                <p className="text-slate-500 text-sm mt-1">Laporan periodik dapat mulai dicicil saat progres program mencapai {PERIODIC_UNLOCK_PERCENT}%.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
                <div>
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Pilih Pasien Anak</label>
                    <select
                        value={selectedChild}
                        onChange={e => { setSelectedChild(e.target.value); setShowBlock(false); }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                    >
                        <option value="" disabled>Pilih anak yang akan dilaporkan...</option>
                        {children.map(c => <option key={c.id} value={c.id}>{c.name} — {c.program} ({c.completedSessions}/{c.totalSessions} sesi)</option>)}
                    </select>
                </div>

                {child && (
                    <div className={`p-4 rounded-xl border animate-in fade-in ${canStartDraft ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50'}`}>
                        <div className="flex items-center gap-3 mb-3">
                            <span className={`material-symbols-outlined ${canStartDraft ? 'text-green-600' : 'text-amber-500'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                {canStartDraft ? 'check_circle' : 'pending'}
                            </span>
                            <p className={`font-bold text-sm ${canStartDraft ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                {canStartDraft ? 'Progress sudah cukup untuk mulai draft laporan periodik.' : `Belum mencapai ${PERIODIC_UNLOCK_PERCENT}% (${child.completedSessions}/${child.totalSessions || 0} sesi)`}
                            </p>
                        </div>
                        <div className="w-full bg-white dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                            <div className={`h-2 rounded-full transition-all ${canStartDraft ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }}></div>
                        </div>
                        <p className="text-xs mt-1.5 text-right font-medium opacity-70">{pct}% selesai</p>
                    </div>
                )}

                {showBlock && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 flex items-start gap-3 animate-in fade-in">
                        <span className="material-symbols-outlined text-red-500 mt-0.5">block</span>
                        <div>
                            <p className="font-bold text-red-700 dark:text-red-400 text-sm">Sesi Program Belum Terpenuhi</p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                                Terapis dapat mulai mencicil laporan periodik setelah progress anak mencapai minimal {PERIODIC_UNLOCK_PERCENT}%.
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleAttempt}
                    disabled={!selectedChild}
                    className="w-full px-6 py-3 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">auto_graph</span>
                    Mulai Buat Laporan Periodik
                </button>
            </div>
        </div>
    );
}

// ── Daily Form ───────────────
function ObservationReportGate({ onConfirm, onBack, childrenData }) {
    const [selectedChild, setSelectedChild] = useState('');

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span> Kembali
            </button>
            <div>
                <h1 className="text-2xl font-black">Laporan Observasi Awal</h1>
                <p className="text-slate-500 text-sm mt-1">Pilih anak untuk membuat catatan kemampuan awal dari beberapa sesi observasi.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
                <div>
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Pilih Pasien Anak</label>
                    <select
                        value={selectedChild}
                        onChange={e => setSelectedChild(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none font-medium"
                    >
                        <option value="" disabled>Pilih anak yang diobservasi...</option>
                        {childrenData.map(c => <option key={c.id} value={c.id}>{c.name} - {c.program}</option>)}
                    </select>
                </div>
                <button
                    onClick={() => selectedChild && onConfirm(selectedChild)}
                    disabled={!selectedChild}
                    className="w-full px-6 py-3 rounded-xl font-bold bg-sky-500 text-white hover:bg-sky-600 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">fact_check</span>
                    Lanjut ke Form Observasi
                </button>
            </div>
        </div>
    );
}

function ObservationReportForm({ childId, onBack, currentUser, childrenData, reports = [], initialReport, onReportSaved }) {
    const child = childrenData.find(c => c.id === childId);
    const sourceReport = initialReport || reports.find(report => (
        report.type === 'observasi_awal'
        && report.childId === childId
        && [REPORT_DRAFT_STATUS, 'needs_revision'].includes(report.status)
    )) || null;
    const sourceItems = sourceReport?.evaluations?.observationItems;

    const [dateFrom, setDateFrom] = useState(sourceReport?.dateFrom || '');
    const [dateTo, setDateTo] = useState(sourceReport?.dateTo || '');
    const [observationSessions, setObservationSessions] = useState(sourceReport?.evaluations?.observationSessions || '3 sesi');
    const [items, setItems] = useState(Array.isArray(sourceItems) && sourceItems.length ? sourceItems : INITIAL_OBSERVATION_ITEMS.map(item => ({ ...item, note: '' })));
    const [summary, setSummary] = useState(sourceReport?.summary || sourceReport?.description || '');
    const [recommendations, setRecommendations] = useState(sourceReport?.recommendations || sourceReport?.parentNotes || '');
    const [internalNotes, setInternalNotes] = useState(sourceReport?.internalNotes || '');
    const [submitted, setSubmitted] = useState(false);
    const [submittedAsDraft, setSubmittedAsDraft] = useState(false);
    const [formError, setFormError] = useState('');

    const updateItem = (id, note) => setItems(prev => prev.map(item => item.id === id ? { ...item, note } : item));

    const handleSubmit = async (status = REPORT_SUBMIT_STATUS) => {
        const isDraft = status === REPORT_DRAFT_STATUS;
        const report = {
            ...(sourceReport?.id ? { id: sourceReport.id } : {}),
            type: 'observasi_awal',
            status,
            childId,
            childName: child?.name || '',
            therapistId: currentUser?.id || '',
            therapistName: currentUser?.name || '',
            sessionType: 'Observasi awal',
            dateFrom,
            dateTo,
            aspects: items.map(item => item.aspect),
            evaluations: { observationSessions, observationItems: items },
            description: summary,
            summary,
            recommendations,
            parentNotes: recommendations,
            internalNotes,
        };
        try {
            const res = await reportsApi.save(report);
            if (!res.ok) {
                setFormError(reportErrorMessage(res, 'Laporan observasi awal belum bisa disimpan.'));
                return;
            }
            onReportSaved && onReportSaved();
            window.dispatchEvent(new CustomEvent('reportUpdated', { detail: { id: res.data?.data?.id || report.id || '', type: 'observasi_awal' } }));
            window.dispatchEvent(new Event('notificationsUpdated'));
            setSubmittedAsDraft(isDraft);
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            setFormError('Laporan observasi awal belum bisa disimpan. Coba ulang beberapa saat lagi.');
        }
    };

    if (submitted) return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center ring-8 ring-sky-50 dark:ring-sky-900/10">
                <span className="material-symbols-outlined text-5xl text-sky-600 dark:text-sky-400">task_alt</span>
            </div>
            <h2 className="text-2xl font-black">{submittedAsDraft ? 'Draft Observasi Tersimpan!' : 'Observasi Awal Terkirim!'}</h2>
            <p className="text-slate-500 text-sm max-w-sm">
                {submittedAsDraft
                    ? `Draft observasi awal ${child?.name || 'anak'} tersimpan dan bisa dilanjutkan lagi nanti.`
                    : `Laporan observasi awal ${child?.name || 'anak'} telah tersimpan dan tersedia untuk orang tua.`}
            </p>
            <button onClick={onBack} className="mt-4 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 hover:bg-slate-50 transition-colors">Kembali ke Laporan Anak</button>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-8 pb-24">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-2xl font-black">Observasi Kemampuan Awal</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Pasien: <span className="font-bold text-sky-600">{child?.name || '-'}</span></p>
                </div>
            </div>

            {formError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    {formError}
                </div>
            )}

            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-500">event_note</span> Detail Observasi
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">Jumlah Sesi Observasi</label>
                        <input value={observationSessions} onChange={e => setObservationSessions(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400 outline-none" placeholder="Contoh: 3 sesi" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">Tanggal Mulai</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">Tanggal Akhir</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400 outline-none" />
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-sky-500">psychology_alt</span> Aspek Observasi
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Struktur ini disarikan dari template IEP observasi awal, lalu disesuaikan agar bisa diisi fleksibel di aplikasi.</p>
                </div>
                <div className="space-y-4">
                    {items.map(item => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                            <div className="mb-3">
                                <p className="text-sm font-black text-slate-900 dark:text-white">{item.aspect}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{item.prompt}</p>
                            </div>
                            <textarea
                                value={item.note || ''}
                                onChange={e => updateItem(item.id, e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[90px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400/40 outline-none text-sm placeholder:text-slate-400"
                                placeholder={`Catatan ${item.aspect.toLowerCase()}...`}
                            />
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                <div>
                    <h3 className="font-bold text-lg mb-3">Kesimpulan Observasi</h3>
                    <textarea value={summary} onChange={e => setSummary(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[120px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400/50 outline-none text-sm placeholder:text-slate-400" placeholder="Tuliskan gambaran umum kemampuan awal anak dan prioritas terapi..." />
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-3">Rekomendasi Awal untuk Orang Tua</h3>
                    <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} className="w-full bg-green-50/30 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-400/40 outline-none text-sm placeholder:text-slate-400" placeholder="Saran aktivitas rumah atau hal yang perlu diperhatikan orang tua..." />
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-3">Catatan Internal</h3>
                    <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} className="w-full bg-amber-50/40 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 min-h-[80px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-400/40 outline-none text-sm placeholder:text-slate-400" placeholder="Catatan khusus tim internal..." />
                </div>
            </section>

            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center gap-4 px-4 sm:px-8">
                    <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors text-sm">Batal</button>
                    <button onClick={() => handleSubmit(REPORT_DRAFT_STATUS)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">draft</span> Simpan Draft
                    </button>
                    <button onClick={() => handleSubmit(REPORT_SUBMIT_STATUS)} className="px-8 py-2.5 rounded-xl bg-sky-500 text-white font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px]">send</span> Kirim ke Orang Tua
                    </button>
                </div>
            </div>
        </div>
    );
}

function DailyReportForm({ childId, sessionId, onBack, currentUser, childrenData, sessions, reports, initialReport, onReportSaved }) {
    const children = childrenData;
    const child = children.find(c => c.id === childId);
    const linkedSession = findLinkedSession(sessions, childId, sessionId || initialReport?.sessionId || '');
    const sourceReport = initialReport || reports.find(report => (
        report.type === 'harian'
        && report.sessionId
        && report.sessionId === linkedSession?.id
        && [REPORT_DRAFT_STATUS, 'needs_revision'].includes(report.status)
    )) || null;
    const priorMissingSession = hasPriorMissingDailyReport(sessions, reports, linkedSession);

    const [aspects, setAspects] = useState(() => Object.fromEntries((sourceReport?.aspects || []).map(item => [item, true])));
    const [rating, setRating] = useState(sourceReport?.sessionScore || 4);
    const [sessionType, setSessionType] = useState(sourceReport?.sessionType || 'Sesi harian');
    const [description, setDescription] = useState(sourceReport?.description || '');
    const [toysText, setToysText] = useState((sourceReport?.toysUsed || []).join(', '));
    const [toolsText, setToolsText] = useState((sourceReport?.toolsUsed || []).join(', '));
    const [rooms, setRooms] = useState([]);
    const [roomsUsed, setRoomsUsed] = useState(sourceReport?.roomsUsed || []);
    const [childResponse, setChildResponse] = useState(sourceReport?.childResponse || '');
    const [obstacles, setObstacles] = useState(sourceReport?.obstacles || '');
    const [recommendations, setRecommendations] = useState(sourceReport?.recommendations || '');
    const [internalNotes, setInternalNotes] = useState(sourceReport?.internalNotes || '');
    const [submitted, setSubmitted] = useState(false);
    const [submittedAsDraft, setSubmittedAsDraft] = useState(false);
    const [formError, setFormError] = useState('');
    const toggleAspect = (key) => setAspects(prev => ({ ...prev, [key]: !prev[key] }));
    const activeRooms = rooms.filter(room => room.status === 'active');
    const toggleRoom = (roomName) => setRoomsUsed(prev => (
        prev.includes(roomName) ? prev.filter(item => item !== roomName) : [...prev, roomName]
    ));

    useEffect(() => {
        let active = true;
        const loadRooms = async () => {
            try {
                const res = await adminApi.getRooms();
                if (active) setRooms(res.data?.data || []);
            } catch (e) {
                console.error(e);
                if (active) setRooms([]);
            }
        };
        loadRooms();
        return () => { active = false; };
    }, []);

    const handleSubmit = async (status = REPORT_SUBMIT_STATUS) => {
        const isDraft = status === REPORT_DRAFT_STATUS;
        if (!isDraft && priorMissingSession) {
            setFormError(`Selesaikan laporan sesi sebelumnya dulu: ${formatSessionDate(priorMissingSession)} pukul ${priorMissingSession.startTime || priorMissingSession.time || '-'}.`);
            return;
        }
        const report = {
            ...(sourceReport?.id ? { id: sourceReport.id } : {}),
            type: 'harian',
            status,
            childId,
            childName: child?.name || '',
            therapistId: currentUser?.id || '',
            therapistName: currentUser?.name || '',
            sessionId: linkedSession?.id || sessionId || '',
            sessionFocus: linkedSession?.focus || child?.program || 'Therapy Session',
            sessionType,
            date: linkedSession?.date || new Date().toISOString().split('T')[0],
            aspects: Object.keys(aspects).filter(k => aspects[k]),
            evaluations: buildEvaluationMap({}),
            sessionScore: rating,
            description,
            toysUsed: parseCommaList(toysText),
            toolsUsed: parseCommaList(toolsText),
            roomsUsed: roomsUsed.filter(roomName => activeRooms.some(room => room.name === roomName)),
            childResponse,
            obstacles,
            recommendations,
            internalNotes
        };
        try {
            const res = await reportsApi.save(report);
            if (!res.ok) {
                setFormError(reportErrorMessage(res, 'Laporan belum bisa disimpan.'));
                return;
            }
            onReportSaved && onReportSaved();
            window.dispatchEvent(new CustomEvent('reportUpdated', { detail: { id: res.data?.data?.id || report.id || '', type: 'harian' } }));
            window.dispatchEvent(new Event('notificationsUpdated'));
            setSubmittedAsDraft(isDraft);
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            setFormError('Laporan belum bisa disimpan. Coba ulang beberapa saat lagi.');
        }
    };

    if (submitted) return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center ring-8 ring-green-50 dark:ring-green-900/10">
                <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
            </div>
            <h2 className="text-2xl font-black">{submittedAsDraft ? 'Draft Laporan Tersimpan!' : 'Laporan Berhasil Dikirim!'}</h2>
            <p className="text-slate-500 text-sm max-w-sm">
                {submittedAsDraft
                    ? `Draft laporan harian sesi terapi ${child?.name || 'anak'} tersimpan dan belum tampil di portal orang tua.`
                    : `Laporan harian sesi terapi ${child?.name || 'anak'} telah disimpan dan langsung tersedia untuk orang tua. Admin ikut menerima notifikasi pemantauan.`}
            </p>
            <div className="flex gap-3 mt-4">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 hover:bg-slate-50 transition-colors">Buat Laporan Lain</button>
            </div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-8 pb-24">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-2xl font-black">Laporan Harian Sesi</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Pasien: <span className="font-bold text-teal-600">{child?.name || '—'}</span>
                        {linkedSession?.focus ? ` · ${linkedSession.focus}` : ''}
                        {' · '}
                        {(linkedSession?.date ? new Date(`${linkedSession.date}T00:00:00`) : new Date()).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {(priorMissingSession || formError) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[20px]">warning</span>
                        <p>{formError || `Sesi sebelumnya pada ${formatSessionDate(priorMissingSession)} pukul ${priorMissingSession.startTime || priorMissingSession.time || '-'} belum memiliki laporan. Isi laporan itu terlebih dahulu sebelum lanjut ke sesi ini.`}</p>
                    </div>
                </div>
            )}

            {/* Therapy Aspects */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Aspek Terapi yang Ditangani</h3>
                <div className="flex flex-wrap gap-2">
                    {ASPECTS_CHECKBOX.map(key => (
                        <label key={key} className="cursor-pointer">
                            <input type="checkbox" className="peer sr-only" checked={!!aspects[key]} onChange={() => toggleAspect(key)} />
                            <div className="flex h-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 px-4 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-700 dark:peer-checked:text-teal-300 peer-checked:border peer-checked:border-teal-300 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">
                                {key}
                            </div>
                        </label>
                    ))}
                </div>
            </section>

            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                <div>
                    <h3 className="font-bold text-lg">Jenis Sesi & Media Bermain</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Program utama tetap mengikuti periode anak. Bagian ini hanya mencatat jenis sesi dan media yang dipakai hari ini.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Jenis Sesi</label>
                        <select
                            value={sessionType}
                            onChange={e => setSessionType(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                            <option>Sesi harian</option>
                            <option>Sesi pengganti / reschedule</option>
                            <option>Observasi</option>
                            <option>Evaluasi target</option>
                            <option>Parent coaching</option>
                            <option>One time visit</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Mainan yang Digunakan</label>
                        <input
                            value={toysText}
                            onChange={e => setToysText(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="Contoh: puzzle, balok, bola sensori"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Alat Peraga / Media Terapi</label>
                        <input
                            value={toolsText}
                            onChange={e => setToolsText(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="Contoh: kartu emosi, weighted lap pad"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Ruang yang Dipakai</label>
                        <div className="flex min-h-[44px] flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                            {rooms.length === 0 ? (
                                <span className="px-2 py-1 text-xs font-semibold text-slate-400">Data ruangan belum tersedia.</span>
                            ) : rooms.map(room => {
                                const disabled = room.status !== 'active';
                                const selected = roomsUsed.includes(room.name);
                                return (
                                    <button
                                        key={room.id}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => toggleRoom(room.name)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-black transition-colors ${
                                            disabled
                                                ? 'cursor-not-allowed border-red-100 bg-red-50 text-red-300'
                                                : selected
                                                    ? 'border-teal-300 bg-teal-50 text-teal-700'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        }`}
                                        title={disabled ? 'Ruangan maintenance tidak bisa dipilih' : room.name}
                                    >
                                        {room.name}{disabled ? ' (maintenance)' : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Activity Description */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Goals / Aktivitas Hari Ini</h3>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/50 transition-all">
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-transparent p-4 min-h-[120px] resize-y text-slate-900 dark:text-slate-100 focus:ring-0 outline-none placeholder:text-slate-400 text-sm" placeholder="Tuliskan goals dan aktivitas utama hari ini sesuai kebutuhan anak..." />
                </div>
            </section>

            {/* Child Response & Obstacles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold text-base mb-3">Respon Anak</h3>
                    <textarea value={childResponse} onChange={e => setChildResponse(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 outline-none text-sm placeholder:text-slate-400" placeholder="Bagaimana reaksi anak terhadap aktivitas?" />
                </section>
                <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold text-base mb-3">Hambatan & Tantangan</h3>
                    <textarea value={obstacles} onChange={e => setObstacles(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 outline-none text-sm placeholder:text-slate-400" placeholder="Catat kesulitan atau hambatan yang ditemui..." />
                </section>
            </div>

            {/* Rating */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Penilaian Capaian Sesi</h3>
                <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(s => (
                        <button key={s} type="button" onClick={() => setRating(s)} className={s <= rating ? 'text-teal-500 hover:scale-110 transition-transform' : 'text-slate-300 dark:text-slate-600 hover:scale-110 transition-transform'}>
                            <span className="material-symbols-outlined text-3xl" style={s <= rating ? {fontVariationSettings:"'FILL' 1"} : {}}>star</span>
                        </button>
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-500">{rating}/5</span>
                </div>
            </section>

            {/* Recommendations for Parents */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-green-500">lightbulb</span>
                    <h3 className="font-bold text-lg">Rekomendasi / Masukan untuk Orang Tua</h3>
                </div>
                <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} className="w-full bg-green-50/30 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500/30 outline-none text-sm placeholder:text-slate-400" placeholder="Aktivitas atau latihan yang disarankan untuk dilakukan di rumah..." />
            </section>

            {/* Internal Notes */}
            <section className="p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-amber-600">lock</span>
                    <h3 className="font-bold text-amber-900 dark:text-amber-400">Catatan Internal <span className="text-sm font-normal opacity-70">(Khusus Klinik)</span></h3>
                </div>
                <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 min-h-[80px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm placeholder:text-slate-400" placeholder="Catatan rahasia untuk tim klinik saja..." />
            </section>

            {/* Footer Submit */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center gap-4 px-4 sm:px-8">
                    <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors text-sm">Batal</button>
                    <button onClick={() => handleSubmit(REPORT_DRAFT_STATUS)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">draft</span> Simpan Draft
                    </button>
                    <button onClick={() => handleSubmit(REPORT_SUBMIT_STATUS)} className="px-8 py-2.5 rounded-xl bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px]">send</span> Kirim ke Orang Tua
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Periodic Report Form ─────────────────────────────────────────────
function PeriodicReportForm({ childId, onBack, currentUser, childrenData, reports = [], initialReport, onReportSaved }) {
    const children = childrenData;
    const child = children.find(c => c.id === childId);
    const sourceReport = initialReport || reports.find(report => (
        report.type === 'periodik'
        && report.childId === childId
        && [REPORT_DRAFT_STATUS, 'needs_revision'].includes(report.status)
    )) || null;

    const [dateFrom, setDateFrom] = useState(sourceReport?.dateFrom || '');
    const [dateTo, setDateTo]   = useState(sourceReport?.dateTo || '');
    const [evaluations, setEvaluations] = useState(sourceReport?.evaluations || {});
    const [progressPoints, setProgressPoints] = useState(sourceReport?.progressPoints?.length ? sourceReport.progressPoints : ['', '', '']);
    const [improvementPoints, setImprovementPoints] = useState(sourceReport?.improvementPoints?.length ? sourceReport.improvementPoints : ['', '', '']);
    const [summary, setSummary] = useState(sourceReport?.summary || '');
    const [parentNotes, setParentNotes] = useState(sourceReport?.parentNotes || '');
    const [submitted, setSubmitted] = useState(false);
    const [submittedAsDraft, setSubmittedAsDraft] = useState(false);
    const [formError, setFormError] = useState('');

    const handleEvalChange = (id, val) => setEvaluations(prev => ({...prev, [id]: val}));
    const updateList = (setter, idx, val) => setter(prev => prev.map((v, i) => i === idx ? val : v));
    const addItem = (setter) => setter(prev => [...prev, '']);
    const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

    const handleSubmit = async (status = REPORT_SUBMIT_STATUS) => {
        const isDraft = status === REPORT_DRAFT_STATUS;
        const report = {
            ...(sourceReport?.id ? { id: sourceReport.id } : {}),
            type: 'periodik',
            status,
            childId,
            childName: child?.name || '',
            therapistId: currentUser?.id || '',
            therapistName: currentUser?.name || '',
            program: child?.program || '',
            dateFrom,
            dateTo,
            evaluations: buildEvaluationMap(evaluations),
            progressPoints: progressPoints.filter(p => p.trim()),
            improvementPoints: improvementPoints.filter(p => p.trim()),
            summary,
            parentNotes
        };
        try {
            const res = await reportsApi.save(report);
            if (!res.ok) {
                setFormError(reportErrorMessage(res, 'Laporan periodik belum bisa disimpan.'));
                return;
            }
            onReportSaved && onReportSaved();
            window.dispatchEvent(new CustomEvent('reportUpdated', { detail: { id: res.data?.data?.id || report.id || '', type: 'periodik' } }));
            window.dispatchEvent(new Event('notificationsUpdated'));
            setSubmittedAsDraft(isDraft);
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            setFormError('Laporan periodik belum bisa disimpan. Coba ulang beberapa saat lagi.');
        }
    };

    if (submitted) return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center ring-8 ring-amber-50 dark:ring-amber-900/10">
                <span className="material-symbols-outlined text-5xl text-amber-600 dark:text-amber-400" style={{fontVariationSettings:"'FILL' 1"}}>task_alt</span>
            </div>
            <h2 className="text-2xl font-black">{submittedAsDraft ? 'Draft Periodik Tersimpan!' : 'Laporan Periodik Terkirim!'}</h2>
            <p className="text-slate-500 text-sm max-w-sm">
                {submittedAsDraft
                    ? `Draft laporan periodik untuk ${child?.name || 'anak'} tersimpan dan bisa dilanjutkan lagi nanti.`
                    : `Laporan periodik untuk ${child?.name || 'anak'} telah disimpan dan langsung tersedia untuk orang tua. Admin tetap dapat meninjau dan meminta revisi bila diperlukan.`}
            </p>
            <button onClick={onBack} className="mt-4 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 hover:bg-slate-50 transition-colors">Kembali ke Laporan Anak</button>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-8 pb-24">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-2xl font-black">Laporan Periodik</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Pasien: <span className="font-bold text-amber-600">{child?.name || '—'}</span></p>
                </div>
            </div>

            {formError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    {formError}
                </div>
            )}

            {/* Date Range */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">date_range</span> Rentang Periode Laporan
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">Dari Tanggal</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-600 dark:text-slate-400">Sampai Tanggal</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                </div>
            </section>

            {/* Aspect Evaluations */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">query_stats</span> Penilaian Indikator Aspek
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Pilih tingkatan capaian untuk setiap aspek perkembangan anak selama periode ini.</p>
                </div>
                <div className="flex flex-col gap-5">
                    {EVAL_ASPECTS.map(aspect => (
                        <div key={aspect.id} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    <span className="material-symbols-outlined text-slate-500 text-[18px]">{aspect.icon}</span>
                                </div>
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{aspect.label}</span>
                            </div>
                            <ScaleSelector aspectId={aspect.id} value={evaluations[aspect.id]} onChange={handleEvalChange} />
                        </div>
                    ))}
                </div>
            </section>

            {/* Progress Points */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500">trending_up</span> Poin Kemajuan yang Dicapai
                </h3>
                <p className="text-xs text-slate-500 mb-4">Tuliskan pencapaian nyata anak selama periode ini secara spesifik.</p>
                <div className="flex flex-col gap-3">
                    {progressPoints.map((pt, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                            <span className="mt-2.5 text-xs font-black text-green-500 w-4 shrink-0">{idx + 1}.</span>
                            <input
                                value={pt}
                                onChange={e => updateList(setProgressPoints, idx, e.target.value)}
                                className="flex-1 bg-green-50/30 dark:bg-green-900/10 border border-green-100 dark:border-green-900/40 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-400/40 outline-none placeholder:text-slate-400"
                                placeholder={`Pencapaian ke-${idx + 1}...`}
                            />
                            {progressPoints.length > 1 && (
                                <button type="button" onClick={() => removeItem(setProgressPoints, idx)} className="mt-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={() => addItem(setProgressPoints)} className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-bold hover:underline mt-1 w-fit">
                        <span className="material-symbols-outlined text-[18px]">add_circle</span> Tambah Poin Kemajuan
                    </button>
                </div>
            </section>

            {/* Improvement Points */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-500">priority_high</span> Area yang Masih Perlu Ditingkatkan
                </h3>
                <p className="text-xs text-slate-500 mb-4">Tuliskan aspek yang masih perlu fokus dan perhatian lebih lanjut.</p>
                <div className="flex flex-col gap-3">
                    {improvementPoints.map((pt, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                            <span className="mt-2.5 text-xs font-black text-sky-500 w-4 shrink-0">{idx + 1}.</span>
                            <input
                                value={pt}
                                onChange={e => updateList(setImprovementPoints, idx, e.target.value)}
                                className="flex-1 bg-sky-50/30 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/40 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400/40 outline-none placeholder:text-slate-400"
                                placeholder={`Area yang perlu ditingkatkan ke-${idx + 1}...`}
                            />
                            {improvementPoints.length > 1 && (
                                <button type="button" onClick={() => removeItem(setImprovementPoints, idx)} className="mt-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={() => addItem(setImprovementPoints)} className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 text-sm font-bold hover:underline mt-1 w-fit">
                        <span className="material-symbols-outlined text-[18px]">add_circle</span> Tambah Area Peningkatan
                    </button>
                </div>
            </section>

            {/* Summary & Parent Notes */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                <div>
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">summarize</span> Kesimpulan & Evaluasi Deskriptif
                    </h3>
                    <textarea value={summary} onChange={e => setSummary(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[120px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-400/50 outline-none text-sm placeholder:text-slate-400" placeholder="Tuliskan ringkasan perkembangan anak secara keseluruhan selama periode ini..." />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-green-500">lightbulb</span>
                        <h3 className="font-bold text-lg">Catatan & Saran untuk Orang Tua</h3>
                    </div>
                    <textarea value={parentNotes} onChange={e => setParentNotes(e.target.value)} className="w-full bg-green-50/30 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-400/40 outline-none text-sm placeholder:text-slate-400" placeholder="Berikan masukan, PR, atau tips yang dapat dilakukan di rumah untuk mendukung kemajuan anak..." />
                </div>
            </section>

            {/* Footer Submit */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center gap-4 px-4 sm:px-8">
                    <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors text-sm">Batal</button>
                    <button onClick={() => handleSubmit(REPORT_DRAFT_STATUS)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">draft</span> Simpan Draft
                    </button>
                    <button onClick={() => handleSubmit(REPORT_SUBMIT_STATUS)} className="px-8 py-2.5 rounded-xl bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px]">send</span> Kirim ke Orang Tua
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── History Panel (inside landing) ──────────────────────────────────
function DailySessionHistory({ rows, onCreateReport }) {
    const recentRows = [...rows].reverse().slice(0, 8);
    const missingCount = rows.filter(row => row.missing).length;

    return (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Riwayat sesi selesai</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Laporan harian dibuat berurutan dari sesi paling lama yang belum dilaporkan.</p>
                </div>
                {missingCount > 0 && (
                    <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                        {missingCount} perlu diisi
                    </span>
                )}
            </div>
            {recentRows.length ? (
                <div className="grid grid-cols-1 gap-2">
                    {recentRows.map(({ session, report, missing }) => (
                        <div key={session.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{session.child?.name || session.childName || session.childId || 'Anak'}</p>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {formatSessionDate(session)} - {session.startTime || session.time || '-'} - {session.focus || 'Sesi terapi'}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${missing ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}`}>
                                    {missing ? (report?.status === 'needs_revision' ? 'Perlu revisi' : report?.status === REPORT_DRAFT_STATUS ? 'Draft' : 'Belum dilaporkan') : 'Sudah dilaporkan'}
                                </span>
                                {missing && (
                                    <button
                                        type="button"
                                        onClick={() => onCreateReport(session, report)}
                                        className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-black text-white hover:bg-teal-600"
                                    >
                                        {report?.status === 'needs_revision' ? 'Revisi' : report?.status === REPORT_DRAFT_STATUS ? 'Lanjutkan' : 'Isi'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm font-semibold text-slate-400 dark:border-slate-700">
                    Belum ada sesi selesai.
                </p>
            )}
        </section>
    );
}

function ReportHistory({ onSelectReport, reports }) {
    const statusLabel = (status) => {
        if (status === 'draft') return 'Draft';
        if (status === 'approved' || status === 'published' || status === 'ready_for_parent') return 'Siap Dibaca';
        if (status === 'needs_revision') return 'Perlu Revisi';
        return 'Menunggu Review';
    };
    const typeLabel = (type) => {
        if (type === 'periodik') return 'Laporan Periodik';
        if (type === 'observasi_awal') return 'Observasi Awal';
        return 'Laporan Harian';
    };
    const typeIcon = (type) => {
        if (type === 'periodik') return 'auto_graph';
        if (type === 'observasi_awal') return 'fact_check';
        return 'edit_document';
    };
    const typeColor = (type) => {
        if (type === 'periodik') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600';
        if (type === 'observasi_awal') return 'bg-sky-50 dark:bg-sky-900/30 text-sky-600';
        return 'bg-teal-50 dark:bg-teal-900/30 text-teal-600';
    };

    if (!reports.length) return (
        <div className="py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">inventory_2</span>
            <p className="text-sm font-semibold text-slate-400 mt-2">Belum ada laporan yang disimpan.</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            {reports.map(r => {
                const editWindow = getReportEditWindow(r);
                return (
                <div
                    key={r.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/40 transition-colors cursor-pointer"
                    onClick={() => onSelectReport(r)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColor(r.type)}`}>
                            <span className="material-symbols-outlined text-[20px]">{typeIcon(r.type)}</span>
                        </div>
                        <div>
                            <p className="font-bold text-sm">{r.childName || 'Anak'}</p>
                            <p className="text-xs text-slate-500">{typeLabel(r.type)} · {r.date || r.dateFrom || '-'}</p>
                        </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                        {editWindow.editLocked ? 'Edit terkunci' : statusLabel(r.status)}
                    </span>
                </div>
                );
            })}
        </div>
    );
}

// ── Main App ─────────────────────────────────────────────────────────

function ReportDetail({ report, onBack, onEdit }) {
    const centerSettings = useClinicSettings();
    const statusLabel = (status) => {
        if (status === 'draft') return 'Draft';
        if (status === 'approved' || status === 'published' || status === 'ready_for_parent') return 'Siap Dibaca';
        if (status === 'needs_revision') return 'Perlu Revisi';
        return 'Menunggu Review';
    };
    const reportTypeLabel = report.type === 'periodik'
        ? 'Laporan Periodik'
        : report.type === 'observasi_awal'
            ? 'Observasi Awal'
            : 'Laporan Harian';
    const isReady = ['approved', 'published', 'ready_for_parent'].includes(report.status);
    const editWindow = getReportEditWindow(report);
    const handleDownload = () => {
        openReportPdf(report, centerSettings.settings || centerSettings);
    };
    const renderList = (title, items) => {
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) return null;
        return (
            <div className="mt-4">
                <p className="font-bold">{title}:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {list.map(item => (
                        <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{item}</span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg mt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <button onClick={onBack} className="text-sm text-primary hover:underline font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span> Kembali
                </button>
                <div className="flex flex-wrap justify-end gap-2">
                    {editWindow.canEdit && (
                        <button
                            onClick={() => onEdit(report)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Ubah Laporan
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        Cetak / PDF
                    </button>
                </div>
            </div>
            {editWindow.editLocked && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                    Akses ubah laporan sudah ditutup karena laporan ini sudah dipublikasikan lebih dari {editWindow.editWindowHours || 48} jam.
                </div>
            )}
            <h2 className="text-2xl font-bold mb-4">Detail {reportTypeLabel}</h2>
            <div className="space-y-3">
                <p><strong>Nama Anak:</strong> {report.childName || report.childId}</p>
                <p><strong>Tanggal:</strong> {report.date || report.dateFrom || '—'}</p>
                <p><strong>Jenis Sesi:</strong> {report.sessionType || report.sessionFocus || report.type || '-'}</p>
                <p><strong>Status:</strong> <span className={`px-2 py-1 rounded font-bold text-xs ${isReady ? 'bg-green-100 text-green-700' : report.status === 'needs_revision' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabel(report.status)}</span></p>
                {report.summary && <div className="mt-4"><p><strong>Ringkasan:</strong></p><p className="mt-1 text-slate-600 dark:text-slate-300">{report.summary}</p></div>}
                {report.description && <div className="mt-4"><p><strong>Goals / Aktivitas Hari Ini:</strong></p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{report.description}</p></div>}
                {report.childResponse && <div className="mt-4"><p><strong>Respons Anak:</strong></p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{report.childResponse}</p></div>}
                {report.obstacles && <div className="mt-4"><p><strong>Kendala / Observasi:</strong></p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{report.obstacles}</p></div>}
                {Array.isArray(report.evaluations?.observationItems) && report.evaluations.observationItems.length > 0 && (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                        <p className="text-sm font-black">Aspek Observasi Awal</p>
                        <div className="mt-3 space-y-3">
                            {report.evaluations.observationItems.map(item => (
                                <div key={item.id || item.aspect} className="rounded-lg bg-white p-3 text-sm dark:bg-slate-800">
                                    <p className="font-black text-slate-800 dark:text-slate-100">{item.aspect}</p>
                                    {item.note && <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{item.note}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {renderList('Aspek terapi', report.aspects)}
                {renderList('Mainan', report.toysUsed)}
                {renderList('Ruang dipakai', report.roomsUsed)}
                {renderList('Alat peraga', report.toolsUsed)}
                {Array.isArray(report.reviewLog) && report.reviewLog.length > 0 && (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                        <p className="text-sm font-black">Log Review</p>
                        <div className="mt-3 space-y-2">
                            {report.reviewLog.map((log, index) => (
                                <div key={`${log.createdAt}-${index}`} className="text-xs text-slate-500 dark:text-slate-400">
                                    <strong className="text-slate-700 dark:text-slate-200">{log.status}</strong> - {log.note || 'Tanpa catatan'} <span className="opacity-70">({log.createdAt})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main App ─────────────────────────────────────────────────────────
function App() {
    const [currentUser, setCurrentUser] = useState(() => {
        return readTherapistUser();
    });
    const initialDailyContext = getDailyContextFromRoute();

    // screen: 'landing' | 'daily-gate' | 'daily-form' | 'periodic-gate' | 'periodic-form'
    const [screen, setScreen] = useState(() => {
        if (!initialDailyContext.openComposer) return 'landing';
        return initialDailyContext.childId ? 'daily-form' : 'daily-gate';
    });
    const [selectedChildId, setSelectedChildId] = useState(initialDailyContext.childId);
    const [selectedSessionId, setSelectedSessionId] = useState(initialDailyContext.sessionId);
    const [selectedReport, setSelectedReport] = useState(null);
    const [editingReport, setEditingReport] = useState(null);
    const [pendingReportId, setPendingReportId] = useState(initialDailyContext.reportId);

    const [sessions, setSessions] = useState([]);
    const [reports, setReports] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [dataError, setDataError] = useState('');

    const loadData = async () => {
        if (!currentUser?.id) { setLoadingData(false); return; }
        try {
            setDataError('');
            const historyFilters = getRoleHistoryFilters({ futureMonths: 0 });
            const [sessRes, repRes] = await Promise.all([
                sessionsApi.getForTherapist(currentUser.id, historyFilters),
                reportsApi.getForTherapist(currentUser.id, historyFilters)
            ]);
            if (sessRes?.ok === false) throw new Error(sessRes.data?.error || sessRes.data?.message || 'Sesi terapi belum bisa dimuat.');
            if (repRes?.ok === false) throw new Error(repRes.data?.error || repRes.data?.message || 'Riwayat laporan belum bisa dimuat.');
            setSessions(sessRes.data?.data || []);
            setReports(repRes.data?.data || []);
        } catch (e) {
            console.error(e);
            setDataError(e?.message || 'Data laporan belum bisa dimuat.');
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        setLoadingData(true);
        loadData();
    }, [currentUser]);

    const goBack = () => {
        setScreen('landing');
        setSelectedChildId('');
        setSelectedSessionId('');
        setSelectedReport(null);
        setEditingReport(null);
    };

    const handleSelectReport = (report) => {
        setSelectedReport(report);
        setScreen('report-detail');
    };

    useEffect(() => {
        if (!pendingReportId || loadingData) return;
        const report = reports.find(item => item.id === pendingReportId);
        if (!report) return;
        handleSelectReport(report);
        setPendingReportId('');
    }, [pendingReportId, reports, loadingData]);

    const handleEditReport = (report) => {
        const editWindow = getReportEditWindow(report);
        if (!editWindow.canEdit) return;
        setEditingReport(report);
        setSelectedReport(null);
        setSelectedChildId(report.childId || '');
        setSelectedSessionId(report.sessionId || '');
        if (report.type === 'periodik') setScreen('periodic-form');
        else if (report.type === 'observasi_awal') setScreen('observation-form');
        else setScreen('daily-form');
    };

    const handleCreateDailyFromSession = (session, report = null) => {
        const blockedSession = hasPriorMissingDailyReport(sessions, reports, session);
        const target = blockedSession || session;
        setEditingReport(blockedSession ? (reports.find(item => item.sessionId === blockedSession.id && item.type === 'harian') || null) : report);
        setSelectedChildId(target.childId || '');
        setSelectedSessionId(target.id || '');
        setScreen('daily-form');
    };

    const dailyChildrenData = getChildrenFromSessions(sessions);
    const programChildrenData = getChildrenFromSessions(sessions, { therapistId: currentUser?.id, programOnly: true });
    const editingProgramChild = editingReport && editingReport.type !== 'harian' && !programChildrenData.some(child => child.id === editingReport.childId)
        ? dailyChildrenData.find(child => child.id === editingReport.childId)
        : null;
    const programReportChildrenData = editingProgramChild
        ? [editingProgramChild, ...programChildrenData]
        : programChildrenData;
    const dailyReportQueue = buildDailyReportQueue(sessions, reports);

    return (
        <div className="relative flex min-h-full w-full flex-col bg-slate-50 dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100">
            <main className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
                <Header />
                <div className="flex-1">
                    {dataError && (
                        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:mx-8">
                            {dataError}
                        </div>
                    )}
                    {loadingData ? (
                        <div className="flex justify-center p-10"><span className="text-slate-500">Loading data...</span></div>
                    ) : (
                        <>
                            {screen === 'landing' && (
                                <ReportLanding onSelectType={(type) => {
                                    if (type === 'harian') setScreen('daily-gate');
                                    else if (type === 'observasi_awal') setScreen('observation-gate');
                                    else setScreen('periodic-gate');
                                }}>
                                    <DailySessionHistory rows={dailyReportQueue} onCreateReport={handleCreateDailyFromSession} />
                                    <ReportHistory onSelectReport={handleSelectReport} reports={reports} />
                                </ReportLanding>
                            )}
                            {screen === 'daily-gate' && (
                                <DailyReportGate
                                    onBack={goBack}
                                    childrenData={dailyChildrenData}
                                    sessions={sessions}
                                    reports={reports}
                                    initialChildId={selectedChildId}
                                    onConfirm={(id, nextSessionId = '') => { setEditingReport(null); setSelectedChildId(id); setSelectedSessionId(nextSessionId); setScreen('daily-form'); }}
                                />
                            )}
                            {screen === 'daily-form' && (
                                <DailyReportForm childId={selectedChildId} sessionId={selectedSessionId} onBack={goBack} currentUser={currentUser} childrenData={dailyChildrenData} sessions={sessions} reports={reports} initialReport={editingReport} onReportSaved={loadData} />
                            )}
                            {screen === 'periodic-gate' && (
                                <PeriodicReportGate
                                    onBack={goBack}
                                    childrenData={programReportChildrenData}
                                    onConfirm={(id) => { setEditingReport(null); setSelectedChildId(id); setSelectedSessionId(''); setScreen('periodic-form'); }}
                                />
                            )}
                            {screen === 'periodic-form' && (
                                <PeriodicReportForm childId={selectedChildId} onBack={goBack} currentUser={currentUser} childrenData={programReportChildrenData} reports={reports} initialReport={editingReport} onReportSaved={loadData} />
                            )}
                            {screen === 'observation-gate' && (
                                <ObservationReportGate
                                    onBack={goBack}
                                    childrenData={programReportChildrenData}
                                    onConfirm={(id) => { setEditingReport(null); setSelectedChildId(id); setSelectedSessionId(''); setScreen('observation-form'); }}
                                />
                            )}
                            {screen === 'observation-form' && (
                                <ObservationReportForm childId={selectedChildId} onBack={goBack} currentUser={currentUser} childrenData={programReportChildrenData} reports={reports} initialReport={editingReport} onReportSaved={loadData} />
                            )}
                            {screen === 'report-detail' && selectedReport && (
                                <ReportDetail report={selectedReport} onBack={goBack} onEdit={handleEditReport} />
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
