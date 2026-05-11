import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import { sessionsApi, reportsApi, adminApi, childrenApi } from '../../shared/api/client';
import { useClinicSettings } from '../../shared/clinicSettings';
import { openReportPdf } from '../../shared/reportPdf';

// ── Constants ─────────────────────────────────────────────────────────
const SCALE_MAP = { 1: 'Sangat Kurang', 2: 'Kurang', 3: 'Cukup', 4: 'Baik', 5: 'Sangat Baik' };
const PER_PAGE = 5;
const PARENT_VISIBLE_REPORT_STATUSES = new Set(['approved', 'published', 'ready_for_parent']);
const REPORT_STATUS_LABELS = {
    approved: 'Siap Dibaca',
    published: 'Dipublikasikan',
    ready_for_parent: 'Siap Dibaca',
};

// Dynamic color palette — rotates by index so custom programs get consistent colors
const COLOR_PALETTE = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
];
const DEFAULT_COLOR = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

// Build a color map dynamically from the list of programs
const buildTypeColors = (programs) => {
    const map = {};
    programs.forEach((p, i) => {
        map[p.name] = { bg: COLOR_PALETTE[i % COLOR_PALETTE.length] };
        if (p.code) map[p.code] = { bg: COLOR_PALETTE[i % COLOR_PALETTE.length] };
    });
    return map;
};

const isParentVisibleReport = (report) => PARENT_VISIBLE_REPORT_STATUSES.has(report?.status);
const getReportStatusLabel = (report) => REPORT_STATUS_LABELS[report?.status] || 'Siap Dibaca';

// ── Helpers ────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' });
};

const guessTherapyType = (focus, programs) => {
    if (!focus) return 'Therapy Session';
    const f = focus.toLowerCase();
    
    // Exact match against program names or codes
    const exactMatch = programs.find(p =>
        p.name === focus || p.code === focus ||
        f.includes(p.name.toLowerCase()) ||
        (p.code && f.includes(p.code.toLowerCase()))
    );
    if (exactMatch) return exactMatch.name;

    return focus; // Return the raw focus string if no program matches
};

const renderStars = (rating) => (
    <div className="flex text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
            <span
                key={star}
                className={`material-symbols-outlined text-[18px] ${star <= rating ? '' : 'text-slate-300 dark:text-slate-600'}`}
                style={star <= rating ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
                star
            </span>
        ))}
    </div>
);

// ── Toast ──────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, 3000);
        return () => clearTimeout(t);
    }, []);
    return (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-400 text-[18px]">check_circle</span>
            {message}
        </div>
    );
}

// ── EvalBar ────────────────────────────────────────────────────────────
function EvalBar({ label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium truncate pr-2">{label}</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">{SCALE_MAP[value] || '—'}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                {[1, 2, 3, 4, 5].map(step => (
                    <div
                        key={step}
                        className={`flex-1 border-r border-white dark:border-slate-900 last:border-0 ${
                            step <= value
                                ? (value <= 2 ? 'bg-amber-400' : value === 3 ? 'bg-sky-400' : 'bg-teal-400')
                                : 'bg-transparent'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

// ── DailyReportCard ────────────────────────────────────────────────────
function DailyReportCard({ report, onRate, onDownload, typeColors = {} }) {
    return (
        <div className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-colors shadow-sm">
            {/* Top Row */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-5 border-b border-slate-100 dark:border-slate-700">
                <div className="flex flex-col gap-1 sm:min-w-[140px] sm:border-r sm:border-slate-200 sm:dark:border-slate-700 sm:pr-4">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Tanggal</span>
                    <p className="text-slate-900 dark:text-slate-100 font-bold text-sm">{formatDate(report.date)}</p>
                    <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold w-fit ${typeColors[report.type]?.bg || DEFAULT_COLOR}`}>
                        {report.type}
                    </div>
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold w-fit bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {report.statusLabel}
                    </div>
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-start gap-3">
                        <div>
                            <h3 className="text-slate-900 dark:text-slate-100 text-sm font-bold">{report.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{report.therapist}</p>
                        </div>
                        {report.parentRating ? (
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                {renderStars(report.parentRating)}
                                <span className="text-[10px] text-slate-400">Penilaian Anda</span>
                            </div>
                        ) : !report.canRate ? (
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg shrink-0">
                                Rating belum tersedia
                            </span>
                        ) : (
                            <button
                                onClick={() => onRate(report)}
                                className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
                            >
                                <span className="material-symbols-outlined text-[14px]">star</span>
                                Beri Rating
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Eval + Notes */}
            <div className="p-5 flex flex-col gap-4">
                {/* Aspect evaluations */}
                {report.evaluations && Object.keys(report.evaluations).length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Indikator Capaian Terapi</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            {Object.entries(report.evaluations).map(([key, val]) => (
                                <EvalBar key={key} label={key} value={val} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Description */}
                <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Catatan Deskriptif:</span>
                    <p className={`text-sm leading-relaxed ${report.hasNotes ? 'text-slate-600 dark:text-slate-400' : 'italic text-slate-400 dark:text-slate-500'}`}>
                        {report.description}
                    </p>
                </div>

                {/* Parent notes */}
                {report.parentNotes && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl">
                        <span className="font-bold flex items-center gap-1.5 text-green-700 dark:text-green-400 text-xs mb-1">
                            <span className="material-symbols-outlined text-[15px]">lightbulb</span>
                            Masukan untuk Orang Tua:
                        </span>
                        <p className="text-sm text-green-800/80 dark:text-green-200/80 leading-relaxed">{report.parentNotes}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={() => onDownload(report)}
                        className="flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity text-xs font-bold shadow-md"
                    >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        Unduh PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── PeriodicReportCard ─────────────────────────────────────────────────
function PeriodicReportCard({ report, onDownload }) {
    return (
        <div className="border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
            {/* Header */}
            <div className="bg-amber-50 dark:bg-amber-900/20 px-5 py-4 flex items-center justify-between gap-3">
                <div>
                    <p className="font-black text-amber-900 dark:text-amber-200">Laporan Periodik</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        {formatDate(report.dateFrom)} s/d {formatDate(report.dateTo)}
                    </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-white dark:bg-slate-800 rounded-full border border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 shrink-0">
                    {getReportStatusLabel(report)}
                </span>
            </div>

            <div className="p-5 flex flex-col gap-5">
                {/* Aspect Evaluations */}
                {report.evaluations && Object.keys(report.evaluations).length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Indikator Capaian</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            {Object.entries(report.evaluations).map(([key, val]) => (
                                <EvalBar key={key} label={key} value={val} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Progress Points */}
                {report.progressPoints && report.progressPoints.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">trending_up</span>
                            Pencapaian Periode Ini
                        </p>
                        <ul className="flex flex-col gap-1.5">
                            {report.progressPoints.map((p, i) => (
                                <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="text-green-500 font-black shrink-0 mt-0.5">✓</span>
                                    {p}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Improvement Points */}
                {report.improvementPoints && report.improvementPoints.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">priority_high</span>
                            Perlu Ditingkatkan
                        </p>
                        <ul className="flex flex-col gap-1.5">
                            {report.improvementPoints.map((p, i) => (
                                <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="text-sky-400 font-black shrink-0 mt-0.5">›</span>
                                    {p}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Summary */}
                {report.summary && (
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Kesimpulan:</span>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{report.summary}</p>
                    </div>
                )}

                {/* Parent Notes */}
                {report.parentNotes && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30">
                        <p className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1 mb-1">
                            <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                            Masukan untuk Orang Tua
                        </p>
                        <p className="text-sm text-green-800/80 dark:text-green-200/80 leading-relaxed">{report.parentNotes}</p>
                    </div>
                )}

                <div className="flex gap-3 pt-1">
                    <button
                        onClick={() => onDownload(report)}
                        className="flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity text-xs font-bold shadow-md"
                    >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        Unduh PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Empty State ────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-16 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-4xl text-slate-400">{icon}</span>
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-white">{title}</p>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{subtitle}</p>}
        </div>
    );
}

// ── App ────────────────────────────────────────────────────────────────
function App({ onLogout }) {
    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [dailyReports, setDailyReports] = useState([]);
    const [periodicReports, setPeriodicReports] = useState([]);
    const [toast, setToast]           = useState('');
    const [page, setPage]             = useState(1);
    const [activeTab, setActiveTab]   = useState('harian');
    const [childrenList, setChildrenList] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [selectedChild, setSelectedChild] = useState('');
    const [ratingModal, setRatingModal] = useState(null);
    const [hoverRating, setHoverRating] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const centerSettings = useClinicSettings();

    const typeColors = React.useMemo(() => buildTypeColors(programsList), [programsList]);

    const loadReports = async () => {
        const saved = sessionStorage.getItem('parent_user');
        let childId = selectedChild;
        let availableChildren = childrenList;

        if (saved && !childId) {
            try {
                const user = JSON.parse(saved);
                let children = [];
                if (user.parentId) {
                    const childRes = await childrenApi.getByParent(user.parentId);
                    children = childRes.data?.data || [];
                } else if (user.childId) {
                    const childRes = await childrenApi.getById(user.childId);
                    children = childRes.data?.data ? [childRes.data.data] : [];
                }
                availableChildren = children;
                
                setChildrenList(children);
                const pRes = await adminApi.getPrograms();
                const progList = pRes.data?.data || [];
                setProgramsList(progList);
                if (children.length > 0) {
                    const preferredChild = children.find(c => c.id === user.childId || c.nita === user.childId) || children[0];
                    childId = preferredChild.id || preferredChild.nita;
                    setSelectedChild(childId);
                }
            } catch { /* ignore */ }
        } else {
            try {
                const pRes = await adminApi.getPrograms();
                setProgramsList(pRes.data?.data || []);
            } catch(e){}
        }

        if (!childId) return;

        const savedUser = saved ? (() => { try { return JSON.parse(saved); } catch { return {}; } })() : {};

        try {
            const rRes = await reportsApi.getForChild(childId);
            if (!rRes.ok) {
                setToast(rRes.data?.error || 'Gagal memuat laporan anak.');
                return;
            }
            const therapistReports = rRes.data?.data || [];
            const visibleReports = therapistReports.filter(isParentVisibleReport);
            const visibleDailyReports = visibleReports.filter(report => report.type === 'harian');

            const sRes = await sessionsApi.getCompletedForChild(childId);
            const sessions = sRes.data?.data || [];
            const sessionMap = new Map(sessions.map(session => [session.id, session]));
            
            const pRes = await adminApi.getPrograms();
            const allProg = pRes.data?.data || [];
            const childProfile =
                availableChildren.find(c => c.id === childId || c.nita === childId) ||
                (savedUser.children || []).find(c => c.id === childId || c.nita === childId);

            const mapped = await Promise.all(visibleDailyReports.map(async savedReport => {
                const s = savedReport.sessionId ? sessionMap.get(savedReport.sessionId) : null;
                let rating = null;
                if (savedReport.sessionId) {
                    try {
                        const rtgRes = await sessionsApi.getRating(savedReport.sessionId);
                        rating = rtgRes.data?.data;
                    } catch(e){}
                }
                
                return {
                    id:           savedReport.id,
                    sessionId:    savedReport.sessionId || s?.id || '',
                    childId,
                    childName:    savedReport.childName || s?.child?.name || childProfile?.name || 'Anak',
                    parentId:     savedUser.parentId || childProfile?.parentId || s?.child?.parentId || '',
                    date:         savedReport.date || s?.date,
                    type:         guessTherapyType(savedReport.sessionFocus || savedReport.program || s?.focus, allProg),
                    title:        savedReport.sessionFocus || s?.focus || 'Laporan Harian Terapi',
                    therapist:    savedReport.therapistName || s?.therapist?.name || 'Terapis',
                    parentRating: rating?.rating || null,
                    ratingComment: rating?.comment || '',
                    description:  savedReport.description || savedReport.summary || 'Laporan sudah tersedia, namun catatan deskriptif belum diisi.',
                    hasNotes:     !!(savedReport.description || savedReport.summary || '').trim(),
                    evaluations:  savedReport.evaluations || {},
                    parentNotes:  savedReport.recommendations || savedReport.parentNotes || '',
                    status:       savedReport.status,
                    statusLabel:  getReportStatusLabel(savedReport),
                    canRate:      !!savedReport.sessionId,
                };
            }));

            setDailyReports(mapped);
            setPeriodicReports(visibleReports.filter(report => report.type === 'periodik'));
        } catch(e) {
            console.error(e);
            setToast('Gagal memuat arsip laporan.');
        }
    };

    useEffect(() => {
        loadReports();
        window.addEventListener('parentChildSelectionChanged', loadReports);
        return () => window.removeEventListener('parentChildSelectionChanged', loadReports);
    }, [selectedChild]);

    // Filtered daily
    const filtered = dailyReports.filter(r => {
        const matchSearch = !search ||
            r.title.toLowerCase().includes(search.toLowerCase()) ||
            r.therapist.toLowerCase().includes(search.toLowerCase()) ||
            r.description.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'All' || r.type === typeFilter;
        return matchSearch && matchType;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const handleDownload = (report) => {
        const result = openReportPdf(report, centerSettings.settings || centerSettings);
        if (result.ok) {
            setToast('Preview PDF laporan dibuka. Pilih Cetak / Simpan PDF untuk menyimpan.');
        } else {
            setToast('Browser tidak dapat membuka template PDF saat ini.');
        }
    };

    const handleSubmitRating = async () => {
        if (!ratingModal || hoverRating === 0) return;
        if (!ratingModal.sessionId) {
            setToast('Rating hanya bisa disimpan untuk laporan yang terhubung ke sesi.');
            return;
        }
        if (!ratingModal.parentId) {
            setToast('Data orang tua belum lengkap untuk menyimpan rating.');
            return;
        }
        try {
            const response = await sessionsApi.addRating(ratingModal.sessionId, {
                childId: ratingModal.childId,
                parentId: ratingModal.parentId,
                rating: hoverRating,
                comment: ratingComment.trim()
            });
            if (!response.ok) {
                setToast(response.data?.error || 'Rating gagal disimpan.');
                return;
            }
            setRatingModal(null);
            setHoverRating(0);
            setRatingComment('');
            setToast('Rating sesi berhasil disimpan!');
            loadReports();
        } catch(e){
            console.error(e);
            setToast('Rating gagal disimpan.');
        }
    };

    return (
        <div className="layout-container flex h-full grow flex-col">
            <div className="px-4 sm:px-8 md:px-12 lg:px-20 flex flex-1 justify-center py-5">
                <div className="layout-content-container flex flex-col max-w-[900px] flex-1 w-full gap-6">
                    <Header onLogout={onLogout} />

                    {/* Top Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Arsip Laporan Kemajuan</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Laporan terapi anak Anda dari terapis.</p>
                        </div>

                        {childrenList.length > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">Pilih Anak:</span>
                                <select
                                    value={selectedChild}
                                    onChange={e => setSelectedChild(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-sky-500 appearance-none"
                                >
                                    <option value="" disabled>Pilih profil...</option>
                                    {childrenList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="flex border-b border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => { setActiveTab('harian'); setPage(1); }}
                                className={`flex-1 sm:flex-none px-6 py-3.5 font-bold text-sm border-b-2 transition-colors ${activeTab === 'harian' ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50/30 dark:bg-sky-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                📋 Laporan Harian
                            </button>
                            <button
                                onClick={() => { setActiveTab('periodik'); setPage(1); }}
                                className={`flex-1 sm:flex-none px-6 py-3.5 font-bold text-sm border-b-2 transition-colors ${activeTab === 'periodik' ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                📊 Laporan Periodik
                            </button>
                        </div>

                        <div className="p-5 flex flex-col gap-5">
                            {/* ── HARIAN TAB ── */}
                            {activeTab === 'harian' && (
                                <>
                                    {/* Search + Filters */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-stretch rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden h-11">
                                            <div className="flex items-center pl-4 text-slate-400">
                                                <span className="material-symbols-outlined text-[22px]">search</span>
                                            </div>
                                            <input
                                                value={search}
                                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                                className="flex-1 bg-transparent px-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none"
                                                placeholder="Cari berdasarkan judul, terapis, atau catatan..."
                                            />
                                            {search && (
                                                <button onClick={() => { setSearch(''); setPage(1); }} className="pr-4 text-slate-400 hover:text-slate-600 transition-colors">
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-2 flex-wrap">
                                            {['All', ...programsList.map(p => p.name)].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => { setTypeFilter(type); setPage(1); }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                        typeFilter === type
                                                            ? 'bg-sky-500 text-white border-sky-500'
                                                            : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-sky-300'
                                                    }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Reports */}
                                    {paginated.length > 0 ? (
                                        <div className="flex flex-col gap-4">
                                            {paginated.map(report => (
                                                <DailyReportCard
                                                    key={report.id}
                                                    report={report}
                                                    typeColors={typeColors}
                                                    onRate={r => { setRatingModal(r); setHoverRating(0); setRatingComment(''); }}
                                                    onDownload={handleDownload}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon="folder_open"
                                            title={search ? 'Tidak ada laporan yang cocok.' : 'Belum ada laporan harian.'}
                                            subtitle={search ? 'Coba kata kunci lain.' : 'Laporan harian akan muncul setelah terapis mengirim laporan dan admin menyetujuinya.'}
                                        />
                                    )}

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <button
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                ← Sebelumnya
                                            </button>
                                            <span className="text-sm font-medium text-slate-500">Halaman {page} / {totalPages}</span>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                Berikutnya →
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── PERIODIK TAB ── */}
                            {activeTab === 'periodik' && (
                                <>
                                    {periodicReports.length > 0 ? (
                                        <div className="flex flex-col gap-5">
                                            {periodicReports.map((r, idx) => (
                                                <PeriodicReportCard key={idx} report={r} onDownload={handleDownload} />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon="auto_graph"
                                            title="Laporan periodik belum tersedia."
                                            subtitle="Terapis belum menyusun laporan rangkuman periodik untuk anak Anda. Laporan periodik dibuat setelah seluruh sesi program selesai."
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Rating Modal */}
            {ratingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setRatingModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 w-full max-w-md flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">Beri Rating Sesi</h2>
                            <p className="text-sm text-slate-500 mt-0.5">{ratingModal.title} · {formatDate(ratingModal.date)}</p>
                        </div>

                        <div className="flex items-center gap-2 justify-center py-2">
                            {[1, 2, 3, 4, 5].map(s => (
                                <button
                                    key={s}
                                    onMouseEnter={() => setHoverRating(s)}
                                    onMouseLeave={() => {}}
                                    onClick={() => setHoverRating(s)}
                                    className={`transition-transform hover:scale-110 ${s <= (hoverRating || 0) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                                >
                                    <span className="material-symbols-outlined text-4xl" style={s <= (hoverRating || 0) ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={ratingComment}
                            onChange={e => setRatingComment(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm placeholder:text-slate-400 dark:text-slate-100 text-slate-900 focus:ring-2 focus:ring-amber-400 outline-none resize-none h-20"
                            placeholder="Tulis komentar Anda (opsional)..."
                        />

                        <div className="flex gap-3">
                            <button onClick={() => setRatingModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                            <button
                                onClick={handleSubmitRating}
                                disabled={hoverRating === 0}
                                className="flex-1 py-3 rounded-xl bg-amber-400 text-white font-bold hover:bg-amber-500 transition-colors shadow-md disabled:opacity-40"
                            >
                                Simpan Rating
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <Toast message={toast} onDone={() => setToast('')} />}
        </div>
    );
}

export default App;
