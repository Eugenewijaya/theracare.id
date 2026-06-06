import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReportCard from './components/ReportCard';
import { useClinicSettings } from '../../shared/clinicSettings';
import { openReportPdf } from '../../shared/reportPdf';
import { adminApi, childrenApi, reportsApi, sessionsApi, therapistsApi } from '../../shared/api/client';
import { confirmAction } from '../../shared/ui/confirmDialog';
import { getReportEditWindow, isParentVisibleReport } from '../../shared/reportRules';

const toDateValue = (date) => date.toISOString().split('T')[0];
const REPORT_REVIEW_QUEUE_STATUSES = ['pending_review'];
const REPORT_REVISION_STATUSES = ['needs_revision'];
const REPORT_HISTORY_STATUSES = ['approved', 'published', 'ready_for_parent'];
const REPORT_MONITORING_STATUSES = [
    ...REPORT_REVIEW_QUEUE_STATUSES,
    ...REPORT_REVISION_STATUSES,
    ...REPORT_HISTORY_STATUSES,
];

const reviewTabs = [
    { value: 'review', label: 'Perlu Review' },
    { value: 'revision', label: 'Menunggu Revisi' },
    { value: 'history', label: 'Riwayat' },
];

const REPORT_STATUS_META = {
    pending_review: {
        label: 'Perlu Review',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    },
    needs_revision: {
        label: 'Revisi',
        className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    },
    approved: {
        label: 'Disetujui',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    },
    published: {
        label: 'Dipublikasikan',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    },
    ready_for_parent: {
        label: 'Tampil ke Orang Tua',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    },
};

const getReportStatusMeta = (status) => REPORT_STATUS_META[String(status || '')] || {
    label: status || 'Draft',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const getReportDateLabel = (report) => {
    if (report.dateFrom || report.dateTo) return [report.dateFrom, report.dateTo].filter(Boolean).join(' - ');
    return report.date || '-';
};

const getReportTypeLabel = (report) => {
    if (report.type === 'periodik') return 'Laporan periodik';
    if (report.type === 'observasi_awal') return 'Observasi awal';
    return 'Laporan harian';
};

const buildRange = (timeframe, customRange) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);

    if (timeframe === 'CUSTOM') {
        const customStart = customRange.from ? new Date(`${customRange.from}T00:00:00`) : null;
        const customEnd = customRange.to ? new Date(`${customRange.to}T23:59:59`) : null;
        const normalizedStart = customStart && !Number.isNaN(customStart.getTime()) ? customStart : new Date(0);
        const normalizedEnd = customEnd && !Number.isNaN(customEnd.getTime()) ? customEnd : end;
        const startDate = normalizedStart <= normalizedEnd ? normalizedStart : normalizedEnd;
        const endDate = normalizedStart <= normalizedEnd ? normalizedEnd : normalizedStart;
        return {
            startDate,
            endDate,
            startValue: toDateValue(startDate),
            endValue: toDateValue(endDate),
            label: customRange.from && customRange.to
                ? `${toDateValue(startDate)} s/d ${toDateValue(endDate)}`
                : 'rentang custom',
        };
    }

    if (timeframe === '12B') {
        start.setMonth(start.getMonth() - 12);
        start.setDate(start.getDate() + 1);
    } else if (timeframe === '1B') {
        start.setMonth(start.getMonth() - 1);
        start.setDate(start.getDate() + 1);
    } else {
        start.setDate(start.getDate() - 6);
    }
    start.setHours(0, 0, 0, 0);

    return {
        startDate: start,
        endDate: end,
        startValue: toDateValue(start),
        endValue: toDateValue(end),
        label: timeframe === '7H' ? '7 hari terakhir' : timeframe === '1B' ? '1 bulan terakhir' : '12 bulan terakhir',
    };
};

function App() {
    const [timeframe, setTimeframe] = useState('7H'); // 7 Hari
    const [customRange, setCustomRange] = useState({ from: '', to: '' });
    const [toast, setToast] = useState(null);
    const [reviewNotes, setReviewNotes] = useState({});
    const [reviewAction, setReviewAction] = useState(null);
    const [reviewTab, setReviewTab] = useState('review');
    const [data, setData] = useState({ children: [], sessions: [], therapists: [], programs: [], stats: {}, reports: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const toastTimerRef = useRef(null);
    const centerSettings = useClinicSettings();
    const selectedRange = useMemo(() => buildRange(timeframe, customRange), [timeframe, customRange]);

    useEffect(() => {
        loadReportData();
        const handleUpdate = () => loadReportData();
        window.addEventListener('childUpdated', handleUpdate);
        window.addEventListener('sessionUpdated', handleUpdate);
        window.addEventListener('reportUpdated', handleUpdate);
        return () => {
            window.removeEventListener('childUpdated', handleUpdate);
            window.removeEventListener('sessionUpdated', handleUpdate);
            window.removeEventListener('reportUpdated', handleUpdate);
        };
    }, []);

    useEffect(() => () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }, []);

    const loadReportData = async () => {
        setLoading(true);
        setError('');
        try {
            const requests = [
                ['statistik', adminApi.getStats()],
                ['jadwal', sessionsApi.getAll({ from: selectedRange.startValue, to: selectedRange.endValue })],
                ['data anak', childrenApi.getAll()],
                ['terapis', therapistsApi.getAll()],
                ['program', adminApi.getPrograms()],
                ['review laporan', reportsApi.getAll()],
            ];
            const results = await Promise.all(requests.map(([, request]) => request));
            const [statsRes, sessionsRes, childrenRes, therapistsRes, programsRes, pendingReportsRes] = results;
            const failedLabels = requests
                .map(([label], index) => results[index]?.ok ? null : label)
                .filter(Boolean);
            const reportRows = pendingReportsRes.ok ? pendingReportsRes.data?.data || [] : [];
            setData({
                stats: statsRes.ok ? statsRes.data?.data || {} : {},
                sessions: sessionsRes.ok ? sessionsRes.data?.data || [] : [],
                children: childrenRes.ok ? childrenRes.data?.data || [] : [],
                therapists: therapistsRes.ok ? therapistsRes.data?.data || [] : [],
                programs: programsRes.ok ? programsRes.data?.data || [] : [],
                reports: reportRows.filter(report => REPORT_MONITORING_STATUSES.includes(String(report.status || ''))),
            });
            setLastUpdated(new Date());
            if (failedLabels.length > 0) {
                setError(`Sebagian data belum bisa dimuat: ${failedLabels.join(', ')}. Metrik lain tetap ditampilkan dari data yang tersedia.`);
            }
        } catch (err) {
            console.error(err);
            setData({
                stats: {},
                sessions: [],
                children: [],
                therapists: [],
                programs: [],
                reports: [],
            });
            setError('Backend belum bisa memuat laporan.');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ msg, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    };

    const reportReviewGroups = useMemo(() => {
        const reports = data.reports || [];
        return {
            review: reports
                .filter(report => REPORT_REVIEW_QUEUE_STATUSES.includes(report.status))
                .slice(0, 12),
            revision: reports
                .filter(report => REPORT_REVISION_STATUSES.includes(report.status))
                .slice(0, 12),
            history: reports
                .filter(report => REPORT_HISTORY_STATUSES.includes(report.status))
                .slice(0, 24),
        };
    }, [data.reports]);

    const activeReviewReports = reportReviewGroups[reviewTab] || [];
    const reportStatusCounts = useMemo(() => {
        const reports = data.reports || [];
        return {
            review: reports.filter(report => REPORT_REVIEW_QUEUE_STATUSES.includes(String(report.status || ''))).length,
            revision: reports.filter(report => REPORT_REVISION_STATUSES.includes(String(report.status || ''))).length,
            history: reports.filter(report => REPORT_HISTORY_STATUSES.includes(String(report.status || ''))).length,
            total: reports.length,
        };
    }, [data.reports]);

    // Calculate dynamic KPIs from persisted backend data.
    const kpis = useMemo(() => {
        const children = data.children || [];
        const sessions = data.sessions || [];
        const therapists = data.therapists || [];
        const programs = data.programs || [];
        const stats = data.stats || {};
        const inRangeSessions = sessions.filter((session) => {
            if (!session.date) return false;
            const sessionDate = new Date(`${session.date}T00:00:00`);
            return !Number.isNaN(sessionDate.getTime()) && sessionDate >= selectedRange.startDate && sessionDate <= selectedRange.endDate;
        });

        const activeChildren = Number(stats.activeChildren ?? children.filter(c => c.status !== 'inactive').length);
        const totalCompleted = inRangeSessions.filter(s => s.status === 'done' || s.status === 'completed').length;
        
        let cancellationRate = 0;
        if (inRangeSessions.length > 0) {
            const cancelled = inRangeSessions.filter(s => s.status === 'cancelled').length;
            cancellationRate = (cancelled / inRangeSessions.length) * 100;
        }

        const activeTherapists = Number(stats.activeTherapists ?? therapists.filter(t => (t.status || 'active') === 'active').length);
        const avgSessionsPerTherapist = activeTherapists > 0 ? (inRangeSessions.length / activeTherapists) : 0;

        const progCounts = {};
        let progTotal = 0;
        inRangeSessions.forEach(s => {
            const focus = s.programName || s.program || s.focus || 'Terapi Umum';
            const lowerFocus = String(focus).toLowerCase();
            const matchedProgram = programs.find((program) => {
                const name = String(program.name || '').toLowerCase();
                const code = String(program.code || '').toLowerCase();
                return (name && lowerFocus.includes(name)) || (code && lowerFocus.includes(code));
            });
            const label = matchedProgram?.name || focus;
            
            progCounts[label] = (progCounts[label] || 0) + 1;
            progTotal++;
        });


        const dist = Object.keys(progCounts).map(k => ({
            label: k,
            pct: Math.round((progCounts[k] / progTotal) * 100)
        })).sort((a, b) => b.pct - a.pct);

        const seriesMap = new Map();
        const rangeDays = Math.ceil((selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / 86400000);
        const useMonthlyBuckets = timeframe === '12B' || rangeDays > 90;
        const crossesYear = selectedRange.startDate.getFullYear() !== selectedRange.endDate.getFullYear();
        inRangeSessions.forEach((session) => {
            const date = new Date(`${session.date}T00:00:00`);
            const key = useMonthlyBuckets
                ? date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
                : date.toLocaleDateString('id-ID', crossesYear ? { day: '2-digit', month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' });
            seriesMap.set(key, (seriesMap.get(key) || 0) + 1);
        });
        const series = Array.from(seriesMap.entries()).map(([label, count]) => ({ label, count }));
        const maxSeries = Math.max(1, ...series.map((item) => item.count));

        return {
            activeChildren,
            totalCompleted,
            cancellationRate: cancellationRate.toFixed(1),
            avgSessionsPerTherapist: avgSessionsPerTherapist.toFixed(1),
            dist,
            series,
            maxSeries,
            rangeLabel: selectedRange.label,
        };
    }, [data, timeframe, selectedRange]);

    const trendChart = useMemo(() => {
        if (!kpis.series.length) return { points: [], linePath: '', areaPath: '' };
        const max = Math.max(1, kpis.maxSeries);
        const width = 100;
        const height = 100;
        const points = kpis.series.map((item, index) => {
            const x = kpis.series.length === 1 ? 50 : (index / (kpis.series.length - 1)) * width;
            const y = height - Math.max(8, (item.count / max) * 86);
            return { ...item, x, y };
        });
        const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
        const first = points[0];
        const last = points[points.length - 1];
        const areaPath = `${linePath} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`;
        return { points, linePath, areaPath };
    }, [kpis.series, kpis.maxSeries]);

    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
    const getReportMeta = (report) => [
        `Anak: ${report.childName || report.child?.name || '-'}`,
        `Terapis: ${report.therapistName || report.therapist?.user?.name || '-'}`,
        `Tanggal: ${report.date || report.dateFrom || '-'}`,
    ].join(' | ');

    const handlePreviewReport = (report) => {
        const result = openReportPdf(report, centerSettings.settings || centerSettings);
        showToast(
            result.ok
                ? 'Preview laporan dibuka. Gunakan tombol Cetak / Simpan PDF jika perlu unduhan.'
                : 'Preview gagal dibuka karena pop-up browser diblokir. Izinkan pop-up lalu coba lagi.',
            result.ok ? 'success' : 'info'
        );
    };

    const handleExportPdf = () => {
        const today = new Date().toISOString().split('T')[0];
        const result = openReportPdf({
            type: 'periodik',
            title: `Ringkasan Operasional Pusat Terapi (${kpis.rangeLabel})`,
            childName: 'Seluruh Anak',
            therapistName: 'Admin',
            program: 'Monitoring operasional pusat terapi',
            dateFrom: selectedRange.startValue || today,
            dateTo: selectedRange.endValue || today,
            summary: 'Ringkasan ini dibuat dari data dashboard admin untuk memantau aktivitas, sesi terapi, dan pemanfaatan terapis.',
            progressPoints: [
                `Total anak aktif: ${kpis.activeChildren}`,
                `Sesi selesai (${kpis.rangeLabel}): ${kpis.totalCompleted}`,
                `Tingkat pembatalan: ${kpis.cancellationRate}%`,
                `Rata-rata sesi per terapis: ${kpis.avgSessionsPerTherapist}`,
                `Laporan perlu review: ${reportStatusCounts.review}`,
                `Laporan menunggu revisi: ${reportStatusCounts.revision}`,
                `Riwayat laporan tampil ke orang tua: ${reportStatusCounts.history}`,
            ],
            improvementPoints: kpis.dist.length
                ? kpis.dist.map((item) => `${item.label}: ${item.pct}% dari total sesi`)
                : ['Belum ada distribusi sesi yang dapat dihitung.'],
            status: 'approved',
        }, centerSettings.settings || centerSettings);
        showToast(
            result.ok
                ? 'Preview PDF ringkasan operasional dibuka. Pilih Cetak / Simpan PDF untuk menyimpan.'
                : 'Browser memblokir preview PDF. Izinkan pop-up untuk export laporan.',
            'info'
        );
    };

    const handleReviewReport = async (report, status) => {
        if (!['approved', 'needs_revision'].includes(status) || reviewAction) return;
        const currentNote = (reviewNotes[report.id] || '').trim();
        const editWindow = getReportEditWindow(report);
        if (status === 'needs_revision' && isParentVisibleReport(report.status) && !editWindow.canEdit) {
            showToast('Masa ubah/revisi laporan yang sudah dipublikasikan sudah lewat 48 jam.', 'info');
            return;
        }
        if (status === 'approved' && report.status === 'needs_revision') {
            showToast('Tunggu terapis mengirim revisi dulu. Setelah disubmit ulang, laporan akan langsung tersedia kembali untuk orang tua.', 'info');
            return;
        }
        const confirmed = await confirmAction({
            tone: status === 'approved' ? 'success' : 'warning',
            icon: status === 'approved' ? 'verified' : 'rate_review',
            title: status === 'approved' ? 'Setujui laporan?' : 'Kirim permintaan revisi?',
            message: status === 'approved'
                ? 'Laporan akan tersedia di portal orang tua.'
                : 'Terapis utama akan menerima notifikasi revisi dan log review tersimpan. Alasan revisi wajib jelas.',
            details: getReportMeta(report),
            confirmText: status === 'approved' ? 'Setujui' : 'Kirim Revisi',
            cancelText: 'Batal',
            inputLabel: status === 'approved' ? 'Catatan admin (opsional)' : 'Alasan revisi',
            inputPlaceholder: status === 'approved'
                ? 'Contoh: sudah sesuai dan siap dibaca orang tua.'
                : 'Jelaskan bagian yang harus diperbaiki oleh terapis...',
            requireText: status === 'needs_revision',
            initialInput: currentNote,
            templates: status === 'needs_revision'
                ? [
                    'Mohon lengkapi respons anak dan rekomendasi untuk orang tua.',
                    'Mohon perjelas goals/aktivitas hari ini dan hasil pengamatan.',
                    'Mohon cek kembali aspek terapi, ruangan, dan alat peraga yang digunakan.',
                ]
                : [],
        });
        if (!confirmed) return;

        const note = (confirmed.input || currentNote).trim();
        setReviewAction({ id: report.id, status });
        try {
            const res = await reportsApi.updateStatus(report.id, status, note);
            if (!res.ok) {
                showToast(res.data?.error || 'Status laporan gagal diperbarui.', 'info');
                return;
            }
            const updatedPayload = res.data?.data || {};
            const updatedReport = {
                ...report,
                ...updatedPayload,
                childName: updatedPayload.childName || report.childName,
                therapistName: updatedPayload.therapistName || report.therapistName,
            };
            setData(prev => ({
                ...prev,
                reports: prev.reports.map(item => item.id === report.id ? updatedReport : item),
            }));
            setReviewNotes(prev => ({ ...prev, [report.id]: '' }));
            window.dispatchEvent(new CustomEvent('reportUpdated', { detail: { id: report.id, status } }));
            showToast(status === 'approved' ? 'Laporan disetujui dan tersedia di portal orang tua.' : 'Laporan dikirim kembali untuk revisi.', 'success');
            loadReportData();
        } catch (err) {
            console.error(err);
            showToast(err?.message || 'Status laporan gagal diperbarui.', 'info');
        } finally {
            setReviewAction(null);
        }
    };

    return (
        <>
        {toast && (
            <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold border backdrop-blur-sm ${
                toast.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                {toast.msg}
            </div>
        )}
        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-8 bg-background-light px-4 py-8 dark:bg-background-dark sm:px-6 lg:px-8">
            {/* Header */}
            <header className="flex flex-col gap-4 border-b border-solid border-slate-200 pb-6 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-2xl">analytics</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold leading-tight tracking-[-0.015em]">Laporan Pusat Terapi</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">Pantau performa sesi, riwayat laporan, dan revisi terapis dari data backend.</p>
                    </div>
                </div>
                <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            {[
                                { value: '7H', label: '7H' },
                                { value: '1B', label: '1B' },
                                { value: '12B', label: '12B' },
                                { value: 'CUSTOM', label: 'Custom' },
                            ].map((option, i, arr) => (
                            <button key={option.value} onClick={() => setTimeframe(option.value)} className={`px-3 py-2 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${i < arr.length-1 ? 'border-r border-slate-200 dark:border-slate-700' : ''} ${timeframe === option.value ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                                {option.label}
                            </button>
                        ))}
                        </div>
                        <button
                            onClick={handleExportPdf}
                            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background-dark shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            Export PDF
                        </button>
                    </div>
                    {lastUpdated && (
                        <p className="text-xs font-semibold text-slate-400">
                            Terakhir diperbarui {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                    {timeframe === 'CUSTOM' && (
                        <div className="grid min-w-0 w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                Dari tanggal
                                <input
                                    type="date"
                                    value={customRange.from}
                                    onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                Sampai tanggal
                                <input
                                    type="date"
                                    value={customRange.to}
                                    onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                />
                            </label>
                        </div>
                    )}
                </div>
            </header>

            {(loading || error) && (
                <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                    error
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}>
                    {error || 'Memuat data laporan dari backend...'}
                </div>
            )}

            {/* KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportCard
                    title="Total Anak Aktif"
                    value={kpis.activeChildren.toString()}
                    icon="group"
                    color="text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400"
                />
                <ReportCard
                    title="Sesi Selesai"
                    value={kpis.totalCompleted.toString()}
                    icon="event_available"
                    color="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400"
                />
                <ReportCard
                    title="Tingkat Pembatalan"
                    value={`${kpis.cancellationRate}%`}
                    icon="event_busy"
                    color="text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400"
                />
                <ReportCard
                    title="Rata-rata Sesi/Terapis"
                    value={kpis.avgSessionsPerTherapist}
                    icon="trending_up"
                    color="text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-400"
                />
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Monitoring & Review Laporan Terapis</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Laporan direct-to-parent masuk riwayat, sedangkan laporan lama yang masih pending tetap masuk antrean review.</p>
                    </div>
                    <button
                        type="button"
                        onClick={loadReportData}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Refresh
                    </button>
                </div>
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">Perlu Review</p>
                        <p className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-100">{reportStatusCounts.review}</p>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
                        <p className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">Menunggu Revisi</p>
                        <p className="mt-1 text-2xl font-black text-red-900 dark:text-red-100">{reportStatusCounts.revision}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Riwayat Tampil</p>
                        <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-100">{reportStatusCounts.history}</p>
                    </div>
                </div>
                <div className="mb-5 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/70">
                    {reviewTabs.map(tab => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setReviewTab(tab.value)}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition sm:flex-none ${
                                reviewTab === tab.value
                                    ? 'bg-white text-primary shadow-sm dark:bg-slate-800 dark:text-blue-300'
                                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                            }`}
                        >
                            {tab.label}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                reviewTab === tab.value
                                    ? 'bg-primary/10 text-primary dark:bg-blue-400/10 dark:text-blue-300'
                                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                                {reportStatusCounts[tab.value] || 0}
                            </span>
                        </button>
                    ))}
                </div>
                {activeReviewReports.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {activeReviewReports.map((report) => {
                            const editWindow = getReportEditWindow(report);
                            const revisionLocked = isParentVisibleReport(report.status) && !editWindow.canEdit;
                            const isApproved = ['approved', 'published', 'ready_for_parent'].includes(report.status);
                            const statusMeta = getReportStatusMeta(report.status);
                            const isBusy = reviewAction?.id === report.id;
                            const approveBusy = isBusy && reviewAction?.status === 'approved';
                            const revisionBusy = isBusy && reviewAction?.status === 'needs_revision';
                            const isReviewQueue = reviewTab === 'review';
                            const isRevisionQueue = reviewTab === 'revision';
                            const isHistory = reviewTab === 'history';
                            return (
                            <article key={report.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{report.sessionFocus || report.title || 'Laporan Terapi'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {report.childName || 'Anak'} - {report.therapistName || 'Terapis'} - {getReportDateLabel(report)}
                                        </p>
                                        <p className="mt-1 text-[11px] font-bold text-slate-400">{getReportTypeLabel(report)}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${statusMeta.className}`}>
                                        {statusMeta.label}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                    {report.description || report.summary || report.parentNotes || 'Belum ada ringkasan yang ditampilkan.'}
                                </p>
                                {Array.isArray(report.reviewLog) && report.reviewLog.length > 0 && (
                                    <div className="rounded-lg bg-slate-50 p-3 text-[11px] font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                                        <p className="mb-1 font-black text-slate-700 dark:text-slate-200">Log review terakhir</p>
                                        {report.reviewLog.slice(-2).map((log, index) => (
                                            <p key={`${log.createdAt}-${index}`}>{log.status}: {log.note || 'Tanpa catatan'}</p>
                                        ))}
                                    </div>
                                )}
                                {revisionLocked && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                                        Masa ubah laporan sudah lewat 48 jam sejak dipublikasikan ke orang tua.
                                    </div>
                                )}
                                {(isReviewQueue || isHistory) && (
                                    <textarea
                                        value={reviewNotes[report.id] || ''}
                                        onChange={e => setReviewNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                                        rows={2}
                                        disabled={revisionLocked}
                                        placeholder={isHistory ? 'Catatan jika perlu meminta revisi ulang...' : 'Catatan review / alasan revisi untuk terapis...'}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-900/60"
                                    />
                                )}
                                {isRevisionQueue && (
                                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                                        Menunggu terapis mengirim revisi. Laporan ini tidak masuk antrean approval sampai dikirim ulang.
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePreviewReport(report)}
                                        disabled={isBusy}
                                        className="flex-1 rounded-lg bg-slate-900 dark:bg-white px-3 py-2 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
                                    >
                                        Preview
                                    </button>
                                    {isReviewQueue && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleReviewReport(report, 'approved')}
                                                disabled={isApproved || isBusy}
                                                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700"
                                            >
                                                {approveBusy ? 'Menyetujui...' : 'Setujui'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReviewReport(report, 'needs_revision')}
                                                disabled={revisionLocked || isBusy}
                                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                                            >
                                                {revisionBusy ? 'Mengirim...' : 'Minta Revisi'}
                                            </button>
                                        </>
                                    )}
                                    {isHistory && (
                                        <>
                                            <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                Sudah Tampil
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleReviewReport(report, 'needs_revision')}
                                                disabled={revisionLocked || isBusy}
                                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                                            >
                                                {revisionBusy ? 'Mengirim...' : 'Minta Revisi'}
                                            </button>
                                        </>
                                    )}
                                    {isRevisionQueue && (
                                        <div className="flex-1 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                            Menunggu Revisi
                                        </div>
                                    )}
                                </div>
                            </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm font-semibold text-slate-400">
                        {reviewTab === 'review'
                            ? 'Belum ada laporan baru yang perlu direview.'
                            : reviewTab === 'revision'
                                ? 'Belum ada laporan yang sedang menunggu revisi terapis.'
                                : 'Belum ada riwayat laporan yang sudah disetujui.'}
                    </div>
                )}
            </section>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Sesi Terapi dari Waktu ke Waktu</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Grafik garis dari jadwal sesi yang tersimpan di backend.</p>
                        </div>
                        <button onClick={loadReportData} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Refresh data">
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    </div>
                    <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 overflow-hidden">
                        {kpis.series.length > 0 ? (
                            <div className="flex h-full min-h-[280px] flex-col gap-4">
                                <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                                        {[20, 40, 60, 80].map((y) => (
                                            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" strokeWidth="0.25" className="text-slate-200 dark:text-slate-700" />
                                        ))}
                                        <path d={trendChart.areaPath} fill="currentColor" className="text-primary/10 dark:text-blue-400/10" />
                                        <path d={trendChart.linePath} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="text-primary" />
                                        {trendChart.points.map((point) => (
                                            <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="1.4" fill="currentColor" className="text-primary" />
                                        ))}
                                    </svg>
                                </div>
                                <div className="flex gap-3 overflow-x-auto pb-1">
                                    {trendChart.points.map((item) => (
                                        <div key={item.label} className="min-w-[72px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-sm font-black text-slate-900 dark:text-white">{item.count}</p>
                                            <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-[280px] flex-1 items-center justify-center flex-col text-slate-400 dark:text-slate-500 gap-2">
                                <span className="material-symbols-outlined text-4xl">show_chart</span>
                                <p className="text-sm font-medium">Belum ada sesi pada rentang {kpis.rangeLabel}.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Popular Disciplines List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col overflow-hidden">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-6">Sesi Berdasarkan Disiplin</h3>
                    <div className="flex flex-col gap-6 flex-1 overflow-y-auto pr-2">
                        {kpis.dist.length > 0 ? (
                            kpis.dist.map((d, i) => (
                                <div key={d.label} className="flex flex-col gap-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-slate-700 dark:text-slate-300">{d.label}</span>
                                        <span className="text-slate-900 dark:text-white">{d.pct}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                        <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${d.pct}%` }}></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-1 items-center justify-center text-center text-sm text-slate-400">
                                Belum ada distribusi program pada rentang ini.
                            </div>
                        )}
                    </div>
                    <p className="mt-6 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        Distribusi dihitung dari fokus/program sesi pada rentang {kpis.rangeLabel}.
                    </p>
                </div>
            </div>
            
        </main>
        </>
    );
}

export default App;
