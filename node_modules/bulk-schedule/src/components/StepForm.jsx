import React, { useState, useEffect } from 'react';
import { therapistsApi, childrenApi, adminApi } from '../../../shared/api/client';

// ── Step 1: Criteria ──────────────────────────────────────────────────
function StepCriteria({ data, update }) {
    const [therapists, setTherapists] = useState([]);
    const [children, setChildren] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [rooms, setRooms] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [tRes, cRes, pRes, rRes] = await Promise.all([
                    therapistsApi.getAll(),
                    childrenApi.getAll(),
                    adminApi.getPrograms(),
                    adminApi.getRooms()
                ]);
                setTherapists(tRes.data?.data || []);
                setChildren(cRes.data?.data || []);
                setPrograms(pRes.data?.data || []);
                setRooms(rRes.data?.data || []);
            } catch(e) {}
        };
        loadData();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Terapis</label>
                <select value={data.therapist} onChange={e => update('therapist', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3">
                    <option value="">Pilih terapis...</option>
                    {therapists.map(t => (
                        <option key={t.id} value={t.id}>{t.name} — {t.specialty || t.id}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anak / Pasien</label>
                <select value={data.child} onChange={e => update('child', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3">
                    <option value="">Pilih anak...</option>
                    {children.map(c => (
                        <option key={c.nita || c.id} value={c.nita || c.id}>{c.name} (NITA: {c.nita || c.id})</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Program / Jenis Terapi</label>
                <select value={data.program} onChange={e => update('program', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3">
                    <option value="">Pilih program...</option>
                    {programs.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ruang Terapi</label>
                <select value={data.room} onChange={e => update('room', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3">
                    <option value="">Pilih ruang...</option>
                    {rooms.map(r => (
                        <option key={r.id} value={r.name}>{r.name} ({r.type})</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// ── Step 2: Frequency ─────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ID = { Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu' };

function StepFrequency({ data, update }) {
    const toggleDay = (day) => {
        const days = data.days || [];
        update('days', days.includes(day) ? days.filter(d => d !== day) : [...days, day]);
    };
    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Ulangi pada Hari</label>
                <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => {
                        const selected = (data.days || []).includes(day);
                        return (
                            <button key={day} type="button" onClick={() => toggleDay(day)}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${selected
                                    ? 'bg-primary/10 border-primary text-primary dark:border-primary/60'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                                }`}>
                                {DAY_ID[day]}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pola Pengulangan</label>
                <select value={data.recurrence} onChange={e => update('recurrence', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3">
                    <option value="weekly">Setiap minggu</option>
                    <option value="biweekly">Setiap 2 minggu</option>
                    <option value="monthly">Sekali sebulan</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Total Sesi</label>
                <input type="number" min="1" max="100" value={data.totalSessions} onChange={e => update('totalSessions', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3"
                    placeholder="contoh: 24" />
            </div>
        </div>
    );
}

// ── Step 3: Timing ────────────────────────────────────────────────────
function StepTiming({ data, update }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jam Mulai</label>
                    <input type="time" value={data.startTime} onChange={e => update('startTime', e.target.value)}
                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Durasi (menit)</label>
                    <select value={data.duration} onChange={e => update('duration', e.target.value)}
                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3">
                        <option value="30">30 menit</option>
                        <option value="45">45 menit</option>
                        <option value="60">60 menit</option>
                        <option value="90">90 menit</option>
                        <option value="120">120 menit</option>
                    </select>
                </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">Rentang Tanggal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Mulai</label>
                        <input type="date" value={data.startDate} onChange={e => update('startDate', e.target.value)}
                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Selesai</label>
                        <input type="date" value={data.endDate} onChange={e => update('endDate', e.target.value)}
                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-10 px-3" />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sesi berulang berhenti pada atau sebelum tanggal ini.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Step 4: Preview (shows resolved names) ─────────────────────────────
function StepPreview({ data }) {
    const [resolved, setResolved] = useState({ therapistName: '', childName: '' });

    useEffect(() => {
        const load = async () => {
            try {
                const [tRes, cRes] = await Promise.all([
                    therapistsApi.getAll(),
                    childrenApi.getAll()
                ]);
                const therapists = tRes.data?.data || [];
                const children = cRes.data?.data || [];
                
                const t = therapists.find(th => th.id === data.therapist);
                const c = children.find(ch => (ch.nita || ch.id) === data.child);
                setResolved({ therapistName: t?.name || data.therapist || '—', childName: c?.name || data.child || '—' });
            } catch(e) {}
        };
        load();
    }, [data.therapist, data.child]);

    const rows = [
        { label: 'Terapis',     value: resolved.therapistName },
        { label: 'Anak',        value: resolved.childName },
        { label: 'Program',     value: data.program || '—' },
        { label: 'Ruang',       value: data.room || '—' },
        { label: 'Hari',        value: (data.days || []).map(d => DAY_ID[d] || d).join(', ') || '—' },
        { label: 'Pengulangan', value: data.recurrence === 'weekly' ? 'Setiap Minggu' : data.recurrence === 'biweekly' ? 'Setiap 2 Minggu' : 'Sekali Sebulan' },
        { label: 'Total Sesi',  value: data.totalSessions ? `${data.totalSessions} sesi` : '—' },
        { label: 'Jam Mulai',   value: data.startTime || '—' },
        { label: 'Durasi',      value: data.duration ? `${data.duration} menit` : '—' },
        { label: 'Rentang',     value: (data.startDate && data.endDate) ? `${data.startDate} → ${data.endDate}` : '—' },
    ];
    return (
        <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">info</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">Periksa konfigurasi di bawah sebelum generate jadwal. Setelah dikonfirmasi, sesi akan langsung masuk ke semua dashboard.</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {rows.map((row, i) => (
                    <div key={row.label} className={`flex items-center px-5 py-3 gap-4 ${i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/30' : 'bg-white dark:bg-background-dark'}`}>
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 w-28 shrink-0">{row.label}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main StepForm ─────────────────────────────────────────────────────
const StepForm = ({ currentStep, data, update }) => {
    const titles = ['Kriteria', 'Frekuensi', 'Waktu & Tanggal', 'Pratinjau'];

    return (
        <div className="p-8 flex-1">
            <h2 className="text-lg font-semibold mb-6">
                Langkah {currentStep}: {titles[currentStep - 1]}
            </h2>
            {currentStep === 1 && <StepCriteria data={data} update={update} />}
            {currentStep === 2 && <StepFrequency data={data} update={update} />}
            {currentStep === 3 && <StepTiming data={data} update={update} />}
            {currentStep === 4 && <StepPreview data={data} />}
        </div>
    );
};

export default StepForm;
