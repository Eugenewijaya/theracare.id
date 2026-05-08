import React, { useState, useEffect, useMemo } from 'react';
import ReportCard from './components/ReportCard';
import { useClinicSettings } from '../../shared/clinicSettings';
import { openReportPdf } from '../../shared/reportPdf';

const getStore = () => {
    try { return JSON.parse(localStorage.getItem('clinicData') || '{}'); }
    catch { return {}; }
};

function App() {
    const [timeframe, setTimeframe] = useState('7H'); // 7 Hari
    const [toast, setToast] = useState(null);
    const [data, setData] = useState(getStore());
    const centerSettings = useClinicSettings();

    useEffect(() => {
        const handleUpdate = () => setData(getStore());
        window.addEventListener('clinicDataUpdated', handleUpdate);
        return () => window.removeEventListener('clinicDataUpdated', handleUpdate);
    }, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Calculate dynamic KPIs
    const kpis = useMemo(() => {
        const children = data.children || [];
        const sessions = data.sessions || [];
        const therapists = data.therapists || [];

        const activeChildren = children.filter(c => c.status !== 'inactive').length;
        const totalCompleted = sessions.filter(s => s.status === 'done' || s.status === 'completed').length;
        
        let cancellationRate = 0;
        if (sessions.length > 0) {
            const cancelled = sessions.filter(s => s.status === 'cancelled').length;
            cancellationRate = (cancelled / sessions.length) * 100;
        }

        const activeTherapists = therapists.filter(t => t.status === 'active').length;
        // Mock utilization based on arbitrary limits (e.g. 10 sessions per active therapist is considered 100%)
        let utilization = 0;
        if (activeTherapists > 0) {
            // just a mock derived stat that moves with data
            const expectedSessions = activeTherapists * 10; 
            utilization = Math.min(((sessions.length / expectedSessions) * 100), 100) || 82;
            if (sessions.length === 0) utilization = 0;
        }

        // Program distribution
        const progCounts = {};
        let progTotal = 0;
        sessions.forEach(s => {
            const focus = s.focus || 'Terapi Umum';
            let label = 'Terapi Umum';
            if (focus.includes('OT') || focus.includes('Occupational')) label = 'Terapi Okupasi (OT)';
            else if (focus.includes('ST') || focus.includes('Speech') || focus.includes('Wicara')) label = 'Terapi Wicara (ST)';
            else if (focus.includes('PT') || focus.includes('Physical') || focus.includes('Fisik')) label = 'Fisioterapi (PT)';
            else if (focus.includes('ABA') || focus.includes('Behavior')) label = 'Terapi Perilaku (ABA)';
            else if (focus.includes('SI') || focus.includes('Sensory')) label = 'Sensory Integration (SI)';
            
            progCounts[label] = (progCounts[label] || 0) + 1;
            progTotal++;
        });


        const dist = Object.keys(progCounts).map(k => ({
            label: k,
            pct: Math.round((progCounts[k] / progTotal) * 100)
        })).sort((a, b) => b.pct - a.pct);

        return {
            activeChildren,
            totalCompleted,
            cancellationRate: cancellationRate.toFixed(1),
            utilization: utilization.toFixed(0),
            dist
        };
    }, [data]);

    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
    const handleExportPdf = () => {
        const today = new Date().toISOString().split('T')[0];
        openReportPdf({
            type: 'periodik',
            title: `Ringkasan Operasional Pusat Terapi (${timeframe})`,
            childName: 'Seluruh Anak',
            therapistName: 'Admin',
            program: 'Monitoring operasional pusat terapi',
            dateFrom: today,
            dateTo: today,
            summary: 'Ringkasan ini dibuat dari data dashboard admin untuk memantau aktivitas, sesi terapi, dan pemanfaatan terapis.',
            progressPoints: [
                `Total anak aktif: ${kpis.activeChildren}`,
                `Sesi selesai: ${kpis.totalCompleted}`,
                `Tingkat pembatalan: ${kpis.cancellationRate}%`,
                `Pemanfaatan terapis: ${kpis.utilization}%`,
            ],
            improvementPoints: kpis.dist.length
                ? kpis.dist.map((item) => `${item.label}: ${item.pct}% dari total sesi`)
                : ['Belum ada distribusi sesi yang dapat dihitung.'],
            status: 'approved',
        }, centerSettings.settings || centerSettings);
        showToast('Template PDF ringkasan operasional dibuka. Pilih Save as PDF untuk menyimpan.', 'info');
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
            <header className="flex flex-col md:flex-row items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 pb-6 gap-4">
                <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-2xl">analytics</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold leading-tight tracking-[-0.015em]">Laporan Pusat Terapi</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">Wawasan waktu nyata dan metrik kinerja.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                        {['7H','30H','12B'].map((tf, i, arr) => (
                            <button key={tf} onClick={() => setTimeframe(tf)} className={`px-4 py-2 text-sm font-medium transition-colors ${i < arr.length-1 ? 'border-r border-slate-200 dark:border-slate-700' : ''} ${timeframe === tf ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                {tf}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleExportPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-background-dark rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Export PDF
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportCard
                    title="Total Anak Aktif"
                    value={kpis.activeChildren.toString()}
                    trend={{ isPositive: true, value: 5.2 }}
                    icon="group"
                    color="text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400"
                />
                <ReportCard
                    title="Sesi Selesai"
                    value={kpis.totalCompleted.toString()}
                    trend={{ isPositive: true, value: 12.4 }}
                    icon="event_available"
                    color="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400"
                />
                <ReportCard
                    title="Tingkat Pembatalan"
                    value={`${kpis.cancellationRate}%`}
                    trend={{ isPositive: false, value: 1.5 }}
                    icon="event_busy"
                    color="text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400"
                />
                <ReportCard
                    title="Pemanfaatan Terapis"
                    value={`${kpis.utilization}%`}
                    trend={{ isPositive: true, value: 3.1 }}
                    icon="trending_up"
                    color="text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-400"
                />
            </section>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart Placeholder */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Sesi Terapi dari Waktu ke Waktu</h3>
                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                    <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center flex-col text-slate-400 dark:text-slate-500 gap-2">
                        <span className="material-symbols-outlined text-4xl">bar_chart</span>
                        <p className="text-sm font-medium">Area visualisasi grafik detail (Dalam Pengembangan)</p>
                    </div>
                </div>

                {/* Popular Disciplines List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col overflow-hidden">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-6">Sesi Berdasarkan Disiplin</h3>
                    <div className="flex flex-col gap-6 flex-1 overflow-y-auto pr-2">
                        {kpis.dist.map((d, i) => (
                            <div key={d.label} className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-slate-700 dark:text-slate-300">{d.label}</span>
                                    <span className="text-slate-900 dark:text-white">{d.pct}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                    <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${d.pct}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => showToast('Laporan detail lengkap akan segera tersedia.', 'info')} className="w-full mt-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        Lihat Rincian Detail
                    </button>
                </div>
            </div>
            
        </main>
        </>
    );
}

export default App;
