import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import { sessionsApi, reportsApi } from '../../shared/api/client';
import { useClinicSettings } from '../../shared/clinicSettings';
import { openReportPdf } from '../../shared/reportPdf';
import { readTherapistUser } from '../../shared/sessionIdentity';

// ── Shared data store helpers ──────────

const getChildrenFromSessions = (sessions) => {
    try {
        const childMap = new Map();
        sessions.forEach(s => {
            if (s.child && !childMap.has(s.child.id)) {
                const childSessions = sessions.filter(sess => sess.childId === s.child.id);
                const completed = childSessions.filter(sess => sess.status === 'done').length;
                childMap.set(s.child.id, {
                    ...s.child,
                    program: s.child.therapyPrograms?.[0]?.type || 'General Therapy',
                    totalSessions: childSessions.length,
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

const getDailyContextFromRoute = () => {
    if (typeof window === 'undefined') return { openComposer: false, childId: '', sessionId: '' };
    const url = new URL(window.location.href);
    const openComposer = url.pathname.endsWith('/reports/new');
    const childId = url.searchParams.get('childId') || '';
    const sessionId = url.searchParams.get('sessionId') || '';

    return {
        openComposer,
        childId,
        sessionId,
    };
};

const findLinkedSession = (sessions, childId, preferredSessionId = '') => {
    if (!childId) return null;

    const childSessions = sessions
        .filter(session => session.childId === childId)
        .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

    if (preferredSessionId) {
        const preferred = childSessions.find(session => session.id === preferredSessionId);
        if (preferred) return preferred;
    }

    return childSessions.find(session => session.status === 'done') || childSessions[0] || null;
};

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                        Rangkuman kemajuan anak dalam sebuah periode program. Tersedia setelah target sesi program terpenuhi.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-sm group-hover:gap-3 transition-all">
                        Buat Laporan Periodik <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>
                </button>
            </div>

            {/* Report History */}
            <div>
                <h2 className="text-lg font-bold mb-4">Riwayat Laporan</h2>
                {children}
            </div>
        </div>
    );
}

// ── Daily Report Gate ────────────────────────────────────────────────
function DailyReportGate({ onConfirm, onBack, childrenData, initialChildId = '' }) {
    const children = childrenData;
    const [selectedChild, setSelectedChild] = useState(initialChildId);

    useEffect(() => {
        setSelectedChild(initialChildId);
    }, [initialChildId]);

    const child = children.find(c => c.id === selectedChild);

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
                            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.round((child.completedSessions/child.totalSessions)*100)}%` }}></div>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => selectedChild && onConfirm(selectedChild)}
                    disabled={!selectedChild}
                    className="w-full px-6 py-3 rounded-xl font-bold bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">edit_document</span>
                    Lanjut ke Formulir Laporan
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
    const isComplete = child ? child.completedSessions >= child.totalSessions : false;
    const pct = child ? Math.round((child.completedSessions/child.totalSessions)*100) : 0;

    const handleAttempt = () => {
        if (!selectedChild) return;
        if (!isComplete) { setShowBlock(true); return; }
        onConfirm(selectedChild);
    };

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span> Kembali
            </button>

            <div>
                <h1 className="text-2xl font-black">Laporan Periodik</h1>
                <p className="text-slate-500 text-sm mt-1">Laporan periodik hanya dapat dibuat setelah seluruh sesi program terselesaikan.</p>
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
                    <div className={`p-4 rounded-xl border animate-in fade-in ${isComplete ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50'}`}>
                        <div className="flex items-center gap-3 mb-3">
                            <span className={`material-symbols-outlined ${isComplete ? 'text-green-600' : 'text-amber-500'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                {isComplete ? 'check_circle' : 'pending'}
                            </span>
                            <p className={`font-bold text-sm ${isComplete ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                {isComplete ? 'Seluruh sesi telah selesai — Laporan periodik dapat dibuat!' : `Sesi belum terpenuhi (${child.completedSessions}/${child.totalSessions})`}
                            </p>
                        </div>
                        <div className="w-full bg-white dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                            <div className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }}></div>
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
                                Terapis hanya dapat membuat laporan periodik setelah semua sesi dalam program selesai dilaksanakan, atau jika Admin telah mengizinkan secara khusus.
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
function DailyReportForm({ childId, sessionId, onBack, onSaved, currentUser, childrenData, sessions, onReportSaved }) {
    const children = childrenData;
    const child = children.find(c => c.id === childId);
    const linkedSession = findLinkedSession(sessions, childId, sessionId);

    const [aspects, setAspects] = useState({});
    const [rating, setRating] = useState(4);
    const [description, setDescription] = useState('');
    const [childResponse, setChildResponse] = useState('');
    const [obstacles, setObstacles] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const toggleAspect = (key) => setAspects(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSubmit = async () => {
        const report = {
            type: 'harian',
            childId,
            childName: child?.name || '',
            therapistId: currentUser?.id || '',
            therapistName: currentUser?.name || '',
            sessionId: linkedSession?.id || sessionId || '',
            sessionFocus: linkedSession?.focus || child?.program || 'Therapy Session',
            date: linkedSession?.date || new Date().toISOString().split('T')[0],
            aspects: Object.keys(aspects).filter(k => aspects[k]),
            evaluations: buildEvaluationMap({}),
            sessionScore: rating,
            description,
            childResponse,
            obstacles,
            recommendations,
            internalNotes
        };
        try {
            await reportsApi.save(report);
            onReportSaved && onReportSaved();
            setSubmitted(true);
        } catch (e) {
            console.error(e);
        }
    };

    if (submitted) return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center ring-8 ring-green-50 dark:ring-green-900/10">
                <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
            </div>
            <h2 className="text-2xl font-black">Laporan Berhasil Disimpan!</h2>
            <p className="text-slate-500 text-sm max-w-sm">Laporan harian sesi terapi {child?.name} telah disimpan dan tersedia untuk orang tua setelah ditinjau Admin.</p>
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

            {/* Activity Description */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Deskripsi Aktivitas Sesi</h3>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/50 transition-all">
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-transparent p-4 min-h-[120px] resize-y text-slate-900 dark:text-slate-100 focus:ring-0 outline-none placeholder:text-slate-400 text-sm" placeholder="Jelaskan aktivitas yang dilakukan selama sesi..." />
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
                    <button onClick={handleSubmit} className="px-8 py-2.5 rounded-xl bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px]">send</span> Simpan Laporan Harian
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Periodic Report Form ─────────────────────────────────────────────
function PeriodicReportForm({ childId, onBack, currentUser, childrenData, onReportSaved }) {
    const children = childrenData;
    const child = children.find(c => c.id === childId);

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo]   = useState('');
    const [evaluations, setEvaluations] = useState({});
    const [progressPoints, setProgressPoints] = useState(['', '', '']);
    const [improvementPoints, setImprovementPoints] = useState(['', '', '']);
    const [summary, setSummary] = useState('');
    const [parentNotes, setParentNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleEvalChange = (id, val) => setEvaluations(prev => ({...prev, [id]: val}));
    const updateList = (setter, idx, val) => setter(prev => prev.map((v, i) => i === idx ? val : v));
    const addItem = (setter) => setter(prev => [...prev, '']);
    const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

    const handleSubmit = async () => {
        const report = {
            type: 'periodik',
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
            await reportsApi.save(report);
            onReportSaved && onReportSaved();
            setSubmitted(true);
        } catch (e) {
            console.error(e);
        }
    };

    if (submitted) return (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center ring-8 ring-amber-50 dark:ring-amber-900/10">
                <span className="material-symbols-outlined text-5xl text-amber-600 dark:text-amber-400" style={{fontVariationSettings:"'FILL' 1"}}>task_alt</span>
            </div>
            <h2 className="text-2xl font-black">Laporan Periodik Tersimpan!</h2>
            <p className="text-slate-500 text-sm max-w-sm">Laporan periodik untuk {child?.name} telah disimpan dan menunggu persetujuan Admin sebelum tampil di dasbor orang tua.</p>
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
                    <button onClick={handleSubmit} className="px-8 py-2.5 rounded-xl bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px]">send</span> Simpan & Kirim untuk Ditinjau Admin
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── History Panel (inside landing) ──────────────────────────────────
function ReportHistory({ onSelectReport, reports }) {
    const statusLabel = (status) => {
        if (status === 'approved' || status === 'published' || status === 'ready_for_parent') return 'Siap Dibaca';
        if (status === 'needs_revision') return 'Perlu Revisi';
        return 'Menunggu Review';
    };

    if (!reports.length) return (
        <div className="py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">inventory_2</span>
            <p className="text-sm font-semibold text-slate-400 mt-2">Belum ada laporan yang disimpan.</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            {reports.slice(0, 5).map(r => (
                <div
                    key={r.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/40 transition-colors cursor-pointer"
                    onClick={() => onSelectReport(r)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.type === 'periodik' ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-teal-50 dark:bg-teal-900/30'}`}>
                            <span className={`material-symbols-outlined text-[20px] ${r.type === 'periodik' ? 'text-amber-600' : 'text-teal-600'}`}>{r.type === 'periodik' ? 'auto_graph' : 'edit_document'}</span>
                        </div>
                        <div>
                            <p className="font-bold text-sm">{r.childName || 'Anak'}</p>
                            <p className="text-xs text-slate-500">{r.type === 'periodik' ? 'Laporan Periodik' : 'Laporan Harian'} · {r.date || r.dateFrom}</p>
                        </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                        {statusLabel(r.status)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Main App ─────────────────────────────────────────────────────────

function ReportDetail({ report, onBack }) {
    const centerSettings = useClinicSettings();
    const statusLabel = (status) => {
        if (status === 'approved' || status === 'published' || status === 'ready_for_parent') return 'Siap Dibaca';
        if (status === 'needs_revision') return 'Perlu Revisi';
        return 'Menunggu Review';
    };
    const isReady = ['approved', 'published', 'ready_for_parent'].includes(report.status);
    const handleDownload = () => {
        openReportPdf(report, centerSettings.settings || centerSettings);
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg mt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <button onClick={onBack} className="text-sm text-primary hover:underline font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span> Kembali
                </button>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                    Download PDF
                </button>
            </div>
            <h2 className="text-2xl font-bold mb-4">Detail {report.type === 'periodik' ? 'Laporan Periodik' : 'Laporan Harian'}</h2>
            <div className="space-y-3">
                <p><strong>Nama Anak:</strong> {report.childName || report.childId}</p>
                <p><strong>Tanggal:</strong> {report.date || report.dateFrom || '—'}</p>
                <p><strong>Status:</strong> <span className={`px-2 py-1 rounded font-bold text-xs ${isReady ? 'bg-green-100 text-green-700' : report.status === 'needs_revision' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabel(report.status)}</span></p>
                {report.summary && <div className="mt-4"><p><strong>Ringkasan:</strong></p><p className="mt-1 text-slate-600 dark:text-slate-300">{report.summary}</p></div>}
                {report.description && <div className="mt-4"><p><strong>Deskripsi:</strong></p><p className="mt-1 text-slate-600 dark:text-slate-300">{report.description}</p></div>}
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

    const [sessions, setSessions] = useState([]);
    const [reports, setReports] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    const loadData = async () => {
        if (!currentUser?.id) { setLoadingData(false); return; }
        try {
            const [sessRes, repRes] = await Promise.all([
                sessionsApi.getForTherapist(currentUser.id),
                reportsApi.getForTherapist(currentUser.id)
            ]);
            setSessions(sessRes.data?.data || []);
            setReports(repRes.data?.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoadingData(false);
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
    };

    const handleSelectReport = (report) => {
        setSelectedReport(report);
        setScreen('report-detail');
    };

    const childrenData = getChildrenFromSessions(sessions);

    return (
        <div className="relative flex min-h-full w-full flex-col bg-slate-50 dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100">
            <main className="flex min-h-full flex-1 flex-col">
                <Header />
                <div className="flex-1">
                    {loadingData ? (
                        <div className="flex justify-center p-10"><span className="text-slate-500">Loading data...</span></div>
                    ) : (
                        <>
                            {screen === 'landing' && (
                                <ReportLanding onSelectType={(type) => setScreen(type === 'harian' ? 'daily-gate' : 'periodic-gate')}>
                                    <ReportHistory onSelectReport={handleSelectReport} reports={reports} />
                                </ReportLanding>
                            )}
                            {screen === 'daily-gate' && (
                                <DailyReportGate
                                    onBack={goBack}
                                    childrenData={childrenData}
                                    initialChildId={selectedChildId}
                                    onConfirm={(id) => { setSelectedChildId(id); setScreen('daily-form'); }}
                                />
                            )}
                            {screen === 'daily-form' && (
                                <DailyReportForm childId={selectedChildId} sessionId={selectedSessionId} onBack={goBack} onSaved={goBack} currentUser={currentUser} childrenData={childrenData} sessions={sessions} onReportSaved={loadData} />
                            )}
                            {screen === 'periodic-gate' && (
                                <PeriodicReportGate
                                    onBack={goBack}
                                    childrenData={childrenData}
                                    onConfirm={(id) => { setSelectedChildId(id); setSelectedSessionId(''); setScreen('periodic-form'); }}
                                />
                            )}
                            {screen === 'periodic-form' && (
                                <PeriodicReportForm childId={selectedChildId} onBack={goBack} currentUser={currentUser} childrenData={childrenData} onReportSaved={loadData} />
                            )}
                            {screen === 'report-detail' && selectedReport && (
                                <ReportDetail report={selectedReport} onBack={goBack} />
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
