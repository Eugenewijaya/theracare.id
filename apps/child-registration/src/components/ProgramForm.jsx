import React, { useState, useEffect, useMemo } from 'react';
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

const todayString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

const FALLBACK_OPERATING_WINDOW = { start: 8 * 60, end: 17 * 60 };
const CLOCK_MINUTE_OPTIONS = [0, 15, 30, 45];

const parseClockMinutes = (value) => {
    const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
};

const formatClock = (minutes) => {
    const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const parseOperatingWindow = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return FALLBACK_OPERATING_WINDOW;
    if (/tutup|closed|libur|off/i.test(raw)) return null;
    const match = raw.match(/(\d{1,2}[:.]\d{2}).*?(\d{1,2}[:.]\d{2})/);
    if (!match) return FALLBACK_OPERATING_WINDOW;
    const start = parseClockMinutes(match[1]);
    const end = parseClockMinutes(match[2]);
    if (start === null || end === null || end <= start) return FALLBACK_OPERATING_WINDOW;
    return { start, end };
};

const normalizeClockDraft = (value) => {
    const raw = String(value || '').replace(/[^\d:]/g, '').slice(0, 5);
    if (raw.includes(':')) {
        const [hour = '', minute = ''] = raw.split(':');
        return `${hour.slice(0, 2)}:${minute.slice(0, 2)}`;
    }
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length === 2) {
        const twoDigitHour = Number(digits);
        return twoDigitHour <= 23 ? `${digits}:` : `0${digits.slice(0, 1)}:${digits.slice(1)}`;
    }
    if (digits.length === 3) {
        const twoDigitHour = Number(digits.slice(0, 2));
        return twoDigitHour <= 23 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : `0${digits.slice(0, 1)}:${digits.slice(1)}`;
    }
    if (digits.length > 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    return digits;
};

const normalizeClockOnBlur = (value) => {
    const raw = String(value || '').trim();
    const direct = raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
    const digits = raw.replace(/\D/g, '');
    let hour = '';
    let minute = '';
    if (direct) {
        hour = direct[1];
        minute = direct[2];
    } else if (digits.length === 3) {
        hour = digits.slice(0, 1);
        minute = digits.slice(1);
    } else if (digits.length >= 4) {
        hour = digits.slice(0, 2);
        minute = digits.slice(2, 4);
    } else if (digits.length > 0) {
        hour = digits;
        minute = '00';
    }
    if (!hour || !minute) return raw;
    const parsed = parseClockMinutes(`${hour}:${minute}`);
    return parsed === null ? raw : formatClock(parsed);
};

const buildClockHourOptions = (window, durationValue = 60) => {
    const duration = Math.max(1, Number(durationValue || 60));
    const firstHour = Math.ceil(window.start / 60);
    const lastHour = Math.floor((window.end - duration) / 60);
    const options = [];
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
        const minutes = hour * 60;
        if (minutes >= window.start && minutes + duration <= window.end) options.push(hour);
    }
    return options.length ? options : Array.from({ length: 24 }, (_, hour) => hour);
};

const ProgramForm = ({ data, onChange, errors }) => {
    const selected = data.program || '';
    const [therapists, setTherapists] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [programPricing, setProgramPricing] = useState({});
    const [clinicSettings, setClinicSettings] = useState({});
    const [isClockPickerOpen, setIsClockPickerOpen] = useState(false);
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
                if (settingsRes.ok) {
                    const settings = settingsRes.data?.data || {};
                    setClinicSettings(settings);
                    setProgramPricing(parsePricing(settings));
                }
            } catch (e) {
                console.error(e);
                setResourceError(e.message || 'Gagal memuat Program Layanan dan data terapis.');
            } finally {
                setIsLoadingResources(false);
            }
        };
        load();
    }, []);

    const operatingWindow = useMemo(
        () => parseOperatingWindow(clinicSettings.operatingHoursWeekday) || FALLBACK_OPERATING_WINDOW,
        [clinicSettings.operatingHoursWeekday]
    );
    const sessionStartMinutes = parseClockMinutes(data.sessionStartTime);
    const sessionDurationMinutes = Math.max(1, Number(data.sessionDuration || 60));
    const clockHourOptions = useMemo(
        () => buildClockHourOptions(operatingWindow, sessionDurationMinutes),
        [operatingWindow, sessionDurationMinutes]
    );
    const selectedMinutes = sessionStartMinutes ?? operatingWindow.start;
    const selectedHour = Math.floor(selectedMinutes / 60);
    const selectedMinute = selectedMinutes % 60;
    const sessionTimeIssue = !data.sessionStartTime
        ? ''
        : sessionStartMinutes === null
            ? 'Gunakan format 24 jam HH:mm, contoh 12:30.'
            : sessionStartMinutes < operatingWindow.start || sessionStartMinutes + sessionDurationMinutes > operatingWindow.end
                ? `Jam ${formatClock(sessionStartMinutes)} berada di luar jam operasional center (${formatClock(operatingWindow.start)}-${formatClock(operatingWindow.end)}).`
                : '';

    const toggleDay = (day) => {
        const current = Array.isArray(data.therapyDays) ? data.therapyDays : [];
        const next = current.includes(day) ? current.filter(item => item !== day) : [...current, day];
        onChange({ ...data, therapyDays: next });
    };

    const updateClockPart = (part, value) => {
        const base = sessionStartMinutes ?? operatingWindow.start;
        const hour = part === 'hour' ? value : Math.floor(base / 60);
        const minute = part === 'minute' ? value : base % 60;
        onChange({ ...data, sessionStartTime: formatClock((hour * 60) + minute) });
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
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
                                placeholder="12:30"
                                value={data.sessionStartTime || ''}
                                onChange={(e) => onChange({ ...data, sessionStartTime: normalizeClockDraft(e.target.value) })}
                                onBlur={(e) => onChange({ ...data, sessionStartTime: normalizeClockOnBlur(e.target.value) })}
                                className={`w-full h-11 rounded-lg border py-2 pl-3 pr-12 ${errors?.sessionStartTime ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-primary focus:border-primary'} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
                            />
                            <button
                                type="button"
                                onClick={() => setIsClockPickerOpen(open => !open)}
                                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
                                aria-label="Pilih jam dari clock picker"
                            >
                                <span className="material-symbols-outlined text-[20px]">schedule</span>
                            </button>
                            {isClockPickerOpen && (
                                <div className="absolute left-0 top-12 z-40 w-[min(320px,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase text-slate-500">Clock picker 24 jam</p>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">{formatClock(selectedMinutes)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsClockPickerOpen(false)}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            aria-label="Tutup clock picker"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                    </div>
                                    <div className="relative mx-auto h-44 w-44 rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                                        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                                        {clockHourOptions.map((hour, index) => {
                                            const angle = ((index / clockHourOptions.length) * 360) - 90;
                                            const radius = 72;
                                            const x = Math.cos((angle * Math.PI) / 180) * radius;
                                            const y = Math.sin((angle * Math.PI) / 180) * radius;
                                            const active = hour === selectedHour;
                                            return (
                                                <button
                                                    type="button"
                                                    key={hour}
                                                    onClick={() => updateClockPart('hour', hour)}
                                                    className={`absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-black transition-colors ${active ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-white text-slate-700 hover:bg-primary/10 hover:text-primary dark:bg-slate-800 dark:text-slate-200'}`}
                                                    style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                                                >
                                                    {String(hour).padStart(2, '0')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 grid grid-cols-4 gap-2">
                                        {CLOCK_MINUTE_OPTIONS.map((minute) => {
                                            const active = minute === selectedMinute;
                                            return (
                                                <button
                                                    type="button"
                                                    key={minute}
                                                    onClick={() => updateClockPart('minute', minute)}
                                                    className={`h-9 rounded-lg border text-sm font-black transition-colors ${active ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                                                >
                                                    :{String(minute).padStart(2, '0')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        {errors?.sessionStartTime && <p className="text-xs text-red-500 mt-1">{errors.sessionStartTime}</p>}
                        {sessionTimeIssue && (
                            <p className="text-xs text-red-500 mt-1">
                                {sessionTimeIssue}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">Ketik manual format 24 jam, contoh 09:00 atau 12:30. Jangan gunakan AM/PM.</p>
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
                <p className="mt-2 text-xs text-slate-500">Sistem akan membuat jadwal sesi periode ini dari hari, jam manual 24 jam, durasi, dan terapis utama yang dipilih.</p>
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
