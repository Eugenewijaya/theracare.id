import React, { useState, useEffect } from 'react';
import { therapistsApi, adminApi } from '../../../shared/api/client';

const colors = {
    emerald: { border: 'border-emerald-500',  bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600' },
    blue:    { border: 'border-blue-500',     bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: 'text-blue-600'    },
    amber:   { border: 'border-amber-500',    bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: 'text-amber-600'   },
    sky:     { border: 'border-sky-500',      bg: 'bg-sky-50 dark:bg-sky-900/20',         icon: 'text-sky-600'     },
    purple:  { border: 'border-purple-500',   bg: 'bg-purple-50 dark:bg-purple-900/20',   icon: 'text-purple-600'  },
};

const DEFAULT_PROGRAM_ICONS = {
    'OT': 'accessibility_new',
    'ST': 'record_voice_over',
    'ABA': 'psychology',
    'PT': 'directions_run',
    'SSG': 'groups',
    'SI': 'waves'
};

const DEFAULT_PROGRAM_COLORS = {
    'OT': 'emerald',
    'ST': 'blue',
    'ABA': 'amber',
    'PT': 'sky',
    'SSG': 'purple',
    'SI': 'blue'
};

const DAY_OPTIONS = [
    { value: 'Monday', label: 'Senin' },
    { value: 'Tuesday', label: 'Selasa' },
    { value: 'Wednesday', label: 'Rabu' },
    { value: 'Thursday', label: 'Kamis' },
    { value: 'Friday', label: 'Jumat' },
    { value: 'Saturday', label: 'Sabtu' },
    { value: 'Sunday', label: 'Minggu' },
];

const todayString = () => new Date().toISOString().split('T')[0];

const parsePricing = (settings = {}) => {
    try {
        const raw = settings.programPricing;
        return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    } catch {
        return {};
    }
};

const formatCurrency = (value) => {
    const amount = Number(value || 0);
    if (!amount) return 'Harga belum diset';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};

const calculateTotalForMode = ({ billingMode, totalSessions, pricePerSession, pricePerMonth, totalPrice }) => {
    if (billingMode === 'package') return Number(totalPrice || 0);
    if (billingMode === 'per_month') return Number(pricePerMonth || 0);
    return Number(pricePerSession || 0) * Number(totalSessions || 0);
};

const ProgramForm = ({ data, onChange, errors }) => {
    const selected = data.program || '';
    const [therapists, setTherapists] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [programPricing, setProgramPricing] = useState({});
    const [isLoadingResources, setIsLoadingResources] = useState(true);
    const [resourceError, setResourceError] = useState('');
    
    useEffect(() => {
        const load = async () => {
            setIsLoadingResources(true);
            setResourceError('');
            try {
                const [tRes, pRes, settingsRes] = await Promise.all([
                    therapistsApi.getAll(),
                    adminApi.getPrograms(),
                    adminApi.getSettings()
                ]);
                if (tRes.ok === false) throw new Error(tRes.data?.error || tRes.data?.message || 'Gagal memuat data terapis.');
                if (pRes.ok === false) throw new Error(pRes.data?.error || pRes.data?.message || 'Gagal memuat Program Layanan.');
                setTherapists(tRes.data?.data || []);
                setProgramsList(pRes.data?.data || []);
                if (settingsRes.ok) setProgramPricing(parsePricing(settingsRes.data?.data));
            } catch (e) {
                console.error(e);
                setResourceError(e.message || 'Gagal memuat Program Layanan dan data terapis.');
            } finally {
                setIsLoadingResources(false);
            }
        };
        load();
    }, []);

    const toggleDay = (day) => {
        const current = Array.isArray(data.therapyDays) ? data.therapyDays : [];
        const next = current.includes(day) ? current.filter(item => item !== day) : [...current, day];
        onChange({ ...data, therapyDays: next });
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">Pilih program, periode terapi, harga, dan pola jadwal awal. Data ini akan menjadi enrollment aktif anak.</p>
            {isLoadingResources && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                    Memuat Program Layanan dan daftar terapis...
                </div>
            )}
            {resourceError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-200">
                    {resourceError}
                </div>
            )}
            {!isLoadingResources && !resourceError && programsList.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-bold">Belum ada Program Layanan.</p>
                    <p className="mt-1">Registrasi belum bisa dilanjutkan sampai admin membuat minimal satu program di menu Program Layanan. Setelah program dibuat, kembali ke halaman ini lalu pilih programnya.</p>
                </div>
            )}
            {!isLoadingResources && !resourceError && therapists.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-bold">Belum ada terapis aktif.</p>
                    <p className="mt-1">Daftarkan terapis terlebih dahulu agar anak bisa ditetapkan ke terapis utama.</p>
                </div>
            )}
            {programsList.map(prog => {
                const isSelected = selected === prog.name;
                const colorKey = prog.color || DEFAULT_PROGRAM_COLORS[prog.code] || 'emerald';
                const icon = prog.icon || DEFAULT_PROGRAM_ICONS[prog.code] || 'star';
                const c = colors[colorKey] || colors.emerald;
                const pricing = programPricing[prog.code] || {};
                const nextBillingMode = data.billingMode || pricing.billingMode || 'per_session';
                const nextTotalSessions = Number(data.totalSessions || pricing.totalSessions || 12);
                const nextPricePerSession = Number(pricing.pricePerSession || 0);
                const nextPricePerMonth = Number(pricing.pricePerMonth || 0);
                const nextPackagePrice = Number(pricing.totalPrice || 0);
                
                return (
                    <label key={prog.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? `${c.border} ${c.bg}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/30'}`}>
                        <input type="radio" name="program" value={prog.name} checked={isSelected}
                            onChange={() => onChange({
                                ...data,
                                program: prog.name,
                                programId: prog.id,
                                programCode: prog.code,
                                programDuration: prog.duration,
                                programGoal: Array.isArray(prog.goals) ? prog.goals[0] || '' : '',
                                programPricePerSession: nextPricePerSession,
                                programPricePerMonth: nextPricePerMonth,
                                totalPrice: calculateTotalForMode({
                                    billingMode: nextBillingMode,
                                    totalSessions: nextTotalSessions,
                                    pricePerSession: nextPricePerSession,
                                    pricePerMonth: nextPricePerMonth,
                                    totalPrice: nextPackagePrice,
                                }),
                                billingMode: nextBillingMode,
                                periodStartDate: data.periodStartDate || todayString(),
                                totalSessions: nextTotalSessions,
                            })} className="sr-only" />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                            <span className={`material-symbols-outlined text-[20px] ${c.icon}`}>{icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{prog.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{prog.target || prog.desc}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                                <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                                    Per sesi: {formatCurrency(pricing.pricePerSession)}
                                </span>
                                <span className="rounded-full bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                                    Per bulan: {formatCurrency(pricing.pricePerMonth)}
                                </span>
                            </div>
                        </div>
                        {isSelected && <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0">check_circle</span>}
                    </label>
                );
            })}
            {errors?.program && <p className="text-xs text-red-500 mt-1">{errors.program}</p>}

            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2">
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        Mulai Periode <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={data.periodStartDate || ''}
                        onChange={(e) => onChange({ ...data, periodStartDate: e.target.value })}
                        className={`w-full h-11 px-3 rounded-lg border ${errors?.periodStartDate ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
                    />
                    {errors?.periodStartDate && <p className="text-xs text-red-500 mt-1">{errors.periodStartDate}</p>}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Selesai Periode</label>
                    <input
                        type="date"
                        value={data.periodEndDate || ''}
                        onChange={(e) => onChange({ ...data, periodEndDate: e.target.value })}
                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        {data.billingMode === 'package' ? 'Jumlah Sesi Paket' : 'Jumlah Sesi'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={data.totalSessions || ''}
                        onChange={(e) => {
                            const totalSessions = Number(e.target.value || 0);
                            onChange({
                                ...data,
                                totalSessions,
                                totalPrice: calculateTotalForMode({
                                    billingMode: data.billingMode || 'per_session',
                                    totalSessions,
                                    pricePerSession: data.programPricePerSession,
                                    pricePerMonth: data.programPricePerMonth,
                                    totalPrice: data.totalPrice,
                                }),
                            });
                        }}
                        className={`w-full h-11 px-3 rounded-lg border ${errors?.totalSessions ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
                        placeholder={data.billingMode === 'package' ? '8' : '12'}
                    />
                    {data.billingMode === 'package' && (
                        <p className="mt-1 text-xs text-slate-500">Contoh: paket 8 sesi, isi 8 di sini lalu isi harga paket di bawah.</p>
                    )}
                    {errors?.totalSessions && <p className="text-xs text-red-500 mt-1">{errors.totalSessions}</p>}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Mode Biaya</label>
                    <select
                        value={data.billingMode || 'per_session'}
                        onChange={(e) => {
                            const billingMode = e.target.value;
                            onChange({
                                ...data,
                                billingMode,
                                totalPrice: calculateTotalForMode({
                                    billingMode,
                                    totalSessions: data.totalSessions,
                                    pricePerSession: data.programPricePerSession,
                                    pricePerMonth: data.programPricePerMonth,
                                    totalPrice: data.totalPrice,
                                }),
                            });
                        }}
                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary"
                    >
                        <option value="per_session">Per sesi</option>
                        <option value="per_month">Per bulan</option>
                        <option value="package">Paket/periode</option>
                    </select>
                </div>
            </div>

            <div className={`grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40 ${data.billingMode === 'package' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Harga per Sesi</label>
                    <input
                        type="number"
                        min="0"
                        value={data.programPricePerSession || ''}
                        onChange={(e) => {
                            const programPricePerSession = Number(e.target.value || 0);
                            onChange({
                                ...data,
                                programPricePerSession,
                                totalPrice: calculateTotalForMode({
                                    billingMode: data.billingMode || 'per_session',
                                    totalSessions: data.totalSessions,
                                    pricePerSession: programPricePerSession,
                                    pricePerMonth: data.programPricePerMonth,
                                    totalPrice: data.totalPrice,
                                }),
                            });
                        }}
                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Harga per Bulan</label>
                    <input
                        type="number"
                        min="0"
                        value={data.programPricePerMonth || ''}
                        onChange={(e) => {
                            const programPricePerMonth = Number(e.target.value || 0);
                            onChange({
                                ...data,
                                programPricePerMonth,
                                totalPrice: calculateTotalForMode({
                                    billingMode: data.billingMode || 'per_session',
                                    totalSessions: data.totalSessions,
                                    pricePerSession: data.programPricePerSession,
                                    pricePerMonth: programPricePerMonth,
                                    totalPrice: data.totalPrice,
                                }),
                            });
                        }}
                        className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary"
                    />
                </div>
                {data.billingMode === 'package' && (
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Harga Paket</label>
                        <input
                            type="number"
                            min="0"
                            value={data.totalPrice || ''}
                            onChange={(e) => onChange({ ...data, totalPrice: Number(e.target.value || 0) })}
                            className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary"
                            placeholder="4000000"
                        />
                        <p className="mt-1 text-xs text-slate-500">Contoh: 8 sesi = Rp 4.000.000.</p>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
                    Hari Terapi <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DAY_OPTIONS.map(day => (
                        <button
                            type="button"
                            key={day.value}
                            onClick={() => toggleDay(day.value)}
                            className={`h-10 rounded-lg border px-3 text-sm font-bold transition-colors ${Array.isArray(data.therapyDays) && data.therapyDays.includes(day.value) ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>
                {errors?.therapyDays && <p className="text-xs text-red-500 mt-2">{errors.therapyDays}</p>}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                            Jam Mulai Default <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="time"
                            value={data.sessionStartTime || '09:00'}
                            onChange={(e) => onChange({ ...data, sessionStartTime: e.target.value })}
                            className={`w-full h-11 px-3 rounded-lg border ${errors?.sessionStartTime ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
                        />
                        {errors?.sessionStartTime && <p className="text-xs text-red-500 mt-1">{errors.sessionStartTime}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Durasi Default</label>
                        <select
                            value={data.sessionDuration || '60'}
                            onChange={(e) => onChange({ ...data, sessionDuration: e.target.value })}
                            className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary"
                        >
                            <option value="30">30 menit</option>
                            <option value="45">45 menit</option>
                            <option value="60">60 menit</option>
                            <option value="90">90 menit</option>
                        </select>
                    </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Sistem akan membuat jadwal sesi periode ini dari hari, jam, durasi, dan terapis utama yang dipilih.</p>
            </div>

            <div className="pt-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Terapis Utama (Primary Therapist) <span className="text-red-500">*</span>
                </label>
                <select
                    value={data.therapistId || ''}
                    onChange={(e) => {
                        const therapistId = e.target.value;
                        onChange({
                            ...data,
                            therapistId,
                            assistantTherapistId: data.assistantTherapistId === therapistId ? '' : data.assistantTherapistId,
                        });
                    }}
                    className={`w-full h-11 px-3 rounded-lg border ${errors?.therapistId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50 appearance-none cursor-pointer`}
                >
                    <option value="">Pilih Terapis Utama...</option>
                    {therapists.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.specialty || 'Terapis'})</option>
                    ))}
                </select>
                {errors?.therapistId && <p className="text-xs text-red-500 mt-1">{errors.therapistId}</p>}
                <p className="text-xs text-slate-500 mt-2">Terapis utama akan ditetapkan sebagai terapis default untuk sesi anak ini, namun dapat diubah secara spesifik setiap sesinya.</p>
            </div>

            <div className="pt-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Terapis Pendamping
                </label>
                <select
                    value={data.assistantTherapistId || ''}
                    onChange={(e) => onChange({
                        ...data,
                        assistantTherapistId: e.target.value,
                        assistantTherapistIds: e.target.value ? [e.target.value] : [],
                    })}
                    className={`w-full h-11 px-3 rounded-lg border ${errors?.assistantTherapistId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50 appearance-none cursor-pointer`}
                >
                    <option value="">Tidak ada pendamping tetap</option>
                    {therapists
                        .filter(t => t.id !== data.therapistId)
                        .map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.specialty || 'Terapis'})</option>
                        ))}
                </select>
                {errors?.assistantTherapistId && <p className="text-xs text-red-500 mt-1">{errors.assistantTherapistId}</p>}
                <p className="text-xs text-slate-500 mt-2">Pendamping diprioritaskan sebagai saran terapis pengganti saat terapis utama berhalangan. Laporan periodik tetap menjadi tanggung jawab terapis utama.</p>
            </div>
        </div>
    );
};

export default ProgramForm;
