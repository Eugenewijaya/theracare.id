import React, { useState, useEffect, useMemo } from 'react';
import ReportCard from './components/ReportCard';
import { useClinicSettings } from '../../shared/clinicSettings';
import { openReportPdf } from '../../shared/reportPdf';
import { adminApi, childrenApi, reportsApi, sessionsApi, therapistsApi } from '../../shared/api/client';
import { confirmAction } from '../../shared/ui/confirmDialog';
import { getReportEditWindow, isParentVisibleReport } from '../../shared/reportRules';

const toDateValue = (date) => date.toISOString().split('T')[0];

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
    const [data, setData] = useState({ children: [], sessions: [], therapists: [], programs: [], stats: {}, pendingReports: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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

    const loadReportData = async () => {
        setLoading(true);
        setError('');
        try {
            const requests = [
                ['statistik', adminApi.getStats()],
                ['jadwal', sessionsApi.getAll()],
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
            setData({
                stats: statsRes.ok ? statsRes.data?.data || {} : {},
                sessions: sessionsRes.ok ? sessionsRes.data?.data || [] : [],
                children: childrenRes.ok ? childrenRes.data?.data || [] : [],
                therapists: therapistsRes.ok ? therapistsRes.data?.data || [] : [],
                programs: programsRes.ok ? programsRes.data?.data || [] : [],
                pendingReports: pendingReportsRes.ok ? (pendingReportsRes.data?.data || []).filter(report => ['pending_review', 'needs_revision', 'approved', 'published', 'ready_for_parent'].includes(report.status)).slice(0, 12) : [],
            });
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
                pendingReports: [],
            });
            setError('Backend belum bisa memuat laporan.');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

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

        const activeTherapists = Number(stats.totalTherapists ?? therapists.filter(t => t.status !== 'inactive').length);
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
            showToast('Tunggu terapis mengirim revisi dulu. Setelah disubmit ulang, status akan kembali menunggu review.', 'info');
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
                pendingReports: prev.pendingReports.map(item => item.id === report.id ? updatedReport : item),
            }));
            setReviewNotes(prev => ({ ...prev, [report.id]: '' }));
            window.dispatchEvent(new CustomEvent('reportUpdated', { detail: { id: report.id, status } }));
            showToast(status === 'approved' ? 'Laporan disetujui dan tersedia di portal orang tua.' : 'Laporan dikirim kembali untuk revisi.', 'success');
            loadReportData();
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 bg-background-light dark:bg-background-dark">
            {/* Header */}
            <header className="flex flex-col gap-4 border-b border-solid border-slate-200 pb-6 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-2xl">analytics</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold leading-tight tracking-[-0.015em]">Laporan Pusat Terapi</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">Wawasan waktu nyata dan metrik kinerja.</p>
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
                    {timeframe === 'CUSTOM' && (
                        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[1fr_1fr]">
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
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Review Laporan Terapis</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Laporan pending harus disetujui sebelum tampil di portal orang tua.</p>
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
                {data.pendingReports.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {data.pendingReports.slice(0, 6).map((report) => {
                            const editWindow = getReportEditWindow(report);
                            const revisionLocked = isParentVisibleReport(report.status) && !editWindow.canEdit;
                            const isApproved = ['approved', 'published', 'ready_for_parent'].includes(report.status);
                            const isBusy = reviewAction?.id === report.id;
                            const approveBusy = isBusy && reviewAction?.status === 'approved';
                            const revisionBusy = isBusy && reviewAction?.status === 'needs_revision';
                            return (
                            <article key={report.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{report.sessionFocus || report.title || 'Laporan Terapi'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {report.childName || 'Anak'} - {report.therapistName || 'Terapis'} - {report.date || report.dateFrom || '-'}
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                        ['approved', 'published', 'ready_for_parent'].includes(report.status)
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            : report.status === 'needs_revision'
                                                ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                    }`}>
                                        {report.status === 'pending_review' ? 'Pending' : report.status === 'needs_revision' ? 'Revisi' : 'Disetujui'}
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
                                <textarea
                                    value={reviewNotes[report.id] || ''}
                                    onChange={e => setReviewNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                                    rows={2}
                                    placeholder="Catatan review / alasan revisi untuk terapis..."
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePreviewReport(report)}
                                        disabled={isBusy}
                                        className="flex-1 rounded-lg bg-slate-900 dark:bg-white px-3 py-2 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
                                    >
                                        Preview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleReviewReport(report, 'approved')}
                                        disabled={isApproved || isBusy}
                                        className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700"
                                    >
                                        {approveBusy ? 'Menyetujui...' : isApproved ? 'Sudah Disetujui' : 'Setujui'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleReviewReport(report, 'needs_revision')}
                                        disabled={revisionLocked || isBusy}
                                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-slate-700"
                                    >
                                        {revisionBusy ? 'Mengirim...' : 'Minta Revisi'}
                                    </button>
                                </div>
                            </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm font-semibold text-slate-400">
                        Tidak ada laporan yang menunggu review.
                    </div>
                )}
            </section>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Sesi Terapi dari Waktu ke Waktu</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Berdasarkan jadwal sesi yang tersimpan di backend.</p>
                        </div>
                        <button onClick={loadReportData} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Refresh data">
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    </div>
                    <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 flex items-end gap-2 overflow-x-auto">
                        {kpis.series.length > 0 ? (
                            kpis.series.map((item) => (
                                <div key={item.label} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
                                    <div className="w-full h-56 flex items-end rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div
                                            className="w-full bg-primary rounded-t-lg transition-all"
                                            style={{ height: `${Math.max(8, (item.count / kpis.maxSeries) * 100)}%` }}
                                            title={`${item.count} sesi`}
                                        />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{item.count}</span>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.label}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-1 items-center justify-center flex-col text-slate-400 dark:text-slate-500 gap-2">
                                <span className="material-symbols-outlined text-4xl">bar_chart</span>
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
