import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { adminApi } from '../../shared/api/client';
import { DEFAULT_CLINIC_SETTINGS, useClinicSettings } from '../../shared/clinicSettings';
import { confirmAction } from '../../shared/ui/confirmDialog';

const ASSET_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,image/vnd.microsoft.icon,.ico';
const ACCEPTED_ASSET_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_ASSET_SIZE = 5 * 1024 * 1024;

function inferContentType(file) {
    if (file.type) return file.type;
    if (file.name.toLowerCase().endsWith('.ico')) return 'image/x-icon';
    return 'application/octet-stream';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function AssetUploadButton({ id, label, uploading, onFile }) {
    return (
        <div>
            <input
                id={id}
                type="file"
                accept={ASSET_ACCEPT}
                className="sr-only"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) onFile(file);
                }}
            />
            <label
                htmlFor={id}
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
                <span className="material-symbols-outlined text-[16px]">{uploading ? 'progress_activity' : 'upload_file'}</span>
                {uploading ? 'Uploading...' : label}
            </label>
        </div>
    );
}

const currentYear = new Date().getFullYear();

const CLOSURE_TYPE_LABELS = {
    public_holiday: 'Tanggal Merah',
    manual_off: 'Libur Manual',
    temporary_closure: 'Tutup Sementara',
};

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatRange(item) {
    if (!item?.startDate) return '-';
    if (!item.endDate || item.endDate === item.startDate) return formatDate(item.startDate);
    return `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`;
}

function App() {
    const [activeSection, setActiveSection] = useState('branding');
    const { settings, save, refresh } = useClinicSettings();
    const [clinicName, setClinicName] = useState(settings.clinicName);
    const [centerSubtitle, setCenterSubtitle] = useState(settings.centerSubtitle);
    const [centerAddress, setCenterAddress] = useState(settings.centerAddress);
    const [centerPhone, setCenterPhone] = useState(settings.centerPhone);
    const [centerEmail, setCenterEmail] = useState(settings.centerEmail);
    const [centerWebsite, setCenterWebsite] = useState(settings.centerWebsite);
    const [operatingHoursWeekday, setOperatingHoursWeekday] = useState(settings.operatingHoursWeekday);
    const [operatingHoursWeekend, setOperatingHoursWeekend] = useState(settings.operatingHoursWeekend);
    const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
    const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
    const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
    const [faviconUrl, setFaviconUrl] = useState(settings.faviconUrl);
    const [centerPhotoUrl, setCenterPhotoUrl] = useState(settings.centerPhotoUrl);
    const [adminWhatsApp, setAdminWhatsApp] = useState('');
    const [uploadingAsset, setUploadingAsset] = useState('');
    const [toast, setToast] = useState(null);
    const [closures, setClosures] = useState([]);
    const [activeClosureToday, setActiveClosureToday] = useState(null);
    const [closureLoading, setClosureLoading] = useState(false);
    const [holidayLoading, setHolidayLoading] = useState(false);
    const [holidayYear, setHolidayYear] = useState(currentYear);
    const [holidayCandidates, setHolidayCandidates] = useState([]);
    const [selectedHolidayDates, setSelectedHolidayDates] = useState([]);
    const [manualOff, setManualOff] = useState({
        title: '',
        startDate: todayIso(),
        endDate: todayIso(),
        note: '',
    });
    const [temporaryClosure, setTemporaryClosure] = useState({
        title: 'Tutup sementara',
        startDate: todayIso(),
        endDate: todayIso(),
        reopensAt: '',
        note: '',
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await adminApi.getSettings();
                const settings = res.data?.data || {};
                if (settings.adminWhatsApp) {
                    setAdminWhatsApp(settings.adminWhatsApp);
                }
            } catch(e) {}
        };
        loadSettings();
    }, []);

    const loadClosures = async ({ silent = false } = {}) => {
        if (!silent) setClosureLoading(true);
        try {
            const res = await adminApi.getCenterClosures();
            if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat jadwal off center');
            const payload = res.data?.data || {};
            setClosures(payload.closures || []);
            setActiveClosureToday(payload.activeToday || null);
        } catch (e) {
            showToast(e.message || 'Gagal memuat jadwal off center', 'error');
        } finally {
            if (!silent) setClosureLoading(false);
        }
    };

    useEffect(() => {
        loadClosures({ silent: true });
        const onNotificationUpdate = () => loadClosures({ silent: true });
        window.addEventListener('notificationsUpdated', onNotificationUpdate);
        return () => window.removeEventListener('notificationsUpdated', onNotificationUpdate);
    }, []);

    useEffect(() => {
        setClinicName(settings.clinicName);
        setCenterSubtitle(settings.centerSubtitle);
        setCenterAddress(settings.centerAddress);
        setCenterPhone(settings.centerPhone);
        setCenterEmail(settings.centerEmail);
        setCenterWebsite(settings.centerWebsite);
        setOperatingHoursWeekday(settings.operatingHoursWeekday);
        setOperatingHoursWeekend(settings.operatingHoursWeekend);
        setPrimaryColor(settings.primaryColor);
        setSecondaryColor(settings.secondaryColor);
        setLogoUrl(settings.logoUrl);
        setFaviconUrl(settings.faviconUrl);
        setCenterPhotoUrl(settings.centerPhotoUrl);
    }, [
        settings.clinicName,
        settings.centerSubtitle,
        settings.centerAddress,
        settings.centerPhone,
        settings.centerEmail,
        settings.centerWebsite,
        settings.operatingHoursWeekday,
        settings.operatingHoursWeekend,
        settings.primaryColor,
        settings.secondaryColor,
        settings.logoUrl,
        settings.faviconUrl,
        settings.centerPhotoUrl
    ]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleAssetUpload = async (kind, file) => {
        if (file.size > MAX_ASSET_SIZE) {
            showToast('Ukuran file maksimal 5MB.', 'error');
            return;
        }

        const contentType = inferContentType(file);
        if (!ACCEPTED_ASSET_TYPES.includes(contentType) && !file.name.toLowerCase().endsWith('.ico')) {
            showToast('Format file tidak didukung. Gunakan PNG, JPG, WebP, SVG, GIF, atau ICO.', 'error');
            return;
        }

        try {
            setUploadingAsset(kind);
            const dataBase64 = await fileToBase64(file);
            const res = await adminApi.uploadBrandAsset({
                kind,
                fileName: file.name,
                contentType,
                dataBase64,
            });
            if (!res.ok) {
                throw new Error(res.data?.error || res.data?.message || 'Upload gagal');
            }
            const url = res.data?.data?.url;
            if (!url) throw new Error('Storage tidak mengembalikan URL file.');
            const settingKey = kind === 'logo' ? 'logoUrl' : kind === 'favicon' ? 'faviconUrl' : 'centerPhotoUrl';
            const nextSettings = await save({ [settingKey]: url });
            if (kind === 'logo') setLogoUrl(nextSettings.logoUrl || url);
            if (kind === 'favicon') setFaviconUrl(nextSettings.faviconUrl || url);
            if (kind === 'photo') setCenterPhotoUrl(nextSettings.centerPhotoUrl || url);
            showToast('File berhasil diupload dan langsung disimpan ke branding.');
        } catch (e) {
            showToast(e.message || 'Gagal upload file ke storage bucket.', 'error');
        } finally {
            setUploadingAsset('');
        }
    };

    const handleSave = async () => {
        if (adminWhatsApp && !/^\d+$/.test(adminWhatsApp)) {
            showToast('Nomor WhatsApp tidak valid. Hanya gunakan angka tanpa karakter khusus (misal: 6281234567890).', 'error');
            return;
        }
        try {
            await save({
                clinicName,
                centerSubtitle,
                centerAddress,
                centerPhone,
                centerEmail,
                centerWebsite,
                operatingHoursWeekday,
                operatingHoursWeekend,
                primaryColor,
                secondaryColor,
                logoUrl,
                faviconUrl,
                centerPhotoUrl
            });
            await adminApi.updateSettings({ adminWhatsApp });
            showToast(`Pengaturan berhasil disimpan!`);
        } catch (e) {
            showToast(e.message || 'Gagal menyimpan pengaturan', 'error');
        }
    };

    const handleCancel = async () => {
        const latest = await refresh();
        setClinicName(latest.clinicName);
        setCenterSubtitle(latest.centerSubtitle);
        setCenterAddress(latest.centerAddress);
        setCenterPhone(latest.centerPhone);
        setCenterEmail(latest.centerEmail);
        setCenterWebsite(latest.centerWebsite);
        setOperatingHoursWeekday(latest.operatingHoursWeekday);
        setOperatingHoursWeekend(latest.operatingHoursWeekend);
        setPrimaryColor(latest.primaryColor);
        setSecondaryColor(latest.secondaryColor);
        setLogoUrl(latest.logoUrl);
        setFaviconUrl(latest.faviconUrl);
        setCenterPhotoUrl(latest.centerPhotoUrl);
        try {
            const res = await adminApi.getSettings();
            const settings = res.data?.data || {};
            if (settings.adminWhatsApp) {
                setAdminWhatsApp(settings.adminWhatsApp);
            }
        } catch(e){}
        showToast('Pengaturan dikembalikan ke nilai terakhir yang disimpan.', 'info');
    };

    const handleResetDefault = async () => {
        const confirmed = await confirmAction({
            tone: 'warning',
            title: 'Atur semula branding?',
            message: 'Logo, favicon, foto, nama, warna, dan informasi publik akan dikembalikan ke bawaan Special Needs Center.',
            confirmText: 'Atur semula',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        try {
            const next = await save(DEFAULT_CLINIC_SETTINGS);
            setClinicName(next.clinicName);
            setCenterSubtitle(next.centerSubtitle);
            setCenterAddress(next.centerAddress);
            setCenterPhone(next.centerPhone);
            setCenterEmail(next.centerEmail);
            setCenterWebsite(next.centerWebsite);
            setOperatingHoursWeekday(next.operatingHoursWeekday);
            setOperatingHoursWeekend(next.operatingHoursWeekend);
            setPrimaryColor(next.primaryColor);
            setSecondaryColor(next.secondaryColor);
            setLogoUrl(next.logoUrl);
            setFaviconUrl(next.faviconUrl);
            setCenterPhotoUrl(next.centerPhotoUrl);
            showToast('Branding sudah diatur semula ke bawaan.');
        } catch (e) {
            showToast(e.message || 'Gagal mengatur semula branding', 'error');
        }
    };

    const handleFetchHolidays = async () => {
        try {
            setHolidayLoading(true);
            const res = await adminApi.getIndonesianHolidays(holidayYear);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menarik tanggal merah Indonesia');
            const holidays = res.data?.data || [];
            const existingDates = new Set(closures.filter((item) => item.type === 'public_holiday').map((item) => item.startDate));
            setHolidayCandidates(holidays);
            setSelectedHolidayDates(holidays.filter((item) => !existingDates.has(item.date)).map((item) => item.date));
            showToast(`${holidays.length} tanggal merah tahun ${holidayYear} berhasil ditarik. Pilih lalu klik Apply.`, 'info');
        } catch (e) {
            showToast(e.message || 'Gagal menarik tanggal merah Indonesia', 'error');
        } finally {
            setHolidayLoading(false);
        }
    };

    const toggleHolidaySelection = (date) => {
        setSelectedHolidayDates((prev) => (
            prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date]
        ));
    };

    const handleApplySelectedHolidays = async () => {
        const selected = holidayCandidates.filter((item) => selectedHolidayDates.includes(item.date));
        if (selected.length === 0) {
            showToast('Pilih minimal satu tanggal merah untuk diterapkan.', 'error');
            return;
        }
        const confirmed = await confirmAction({
            tone: 'warning',
            title: 'Terapkan tanggal merah?',
            message: `${selected.length} tanggal merah akan menjadi jadwal off center dan notifikasi dikirim ke semua role.`,
            confirmText: 'Terapkan',
            cancelText: 'Batal',
        });
        if (!confirmed) return;

        try {
            setClosureLoading(true);
            const res = await adminApi.applyCenterHolidays({
                year: Number(holidayYear),
                holidays: selected,
                notify: true,
            });
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menerapkan tanggal merah');
            const payload = res.data?.data || {};
            setClosures(payload.closures || []);
            await loadClosures({ silent: true });
            setHolidayCandidates([]);
            setSelectedHolidayDates([]);
            window.dispatchEvent(new Event('notificationsUpdated'));
            showToast(`${payload.added || 0} jadwal off center berhasil ditambahkan.`);
        } catch (e) {
            showToast(e.message || 'Gagal menerapkan tanggal merah', 'error');
        } finally {
            setClosureLoading(false);
        }
    };

    const handleCreateClosure = async (type) => {
        const source = type === 'temporary_closure' ? temporaryClosure : manualOff;
        if (!source.startDate) {
            showToast('Tanggal mulai wajib diisi.', 'error');
            return;
        }
        if (!source.title.trim()) {
            showToast('Judul jadwal off wajib diisi.', 'error');
            return;
        }
        const confirmed = await confirmAction({
            tone: 'warning',
            title: type === 'temporary_closure' ? 'Aktifkan tutup sementara?' : 'Tambah jadwal off center?',
            message: `${source.title} akan disimpan dan notifikasi dikirim ke semua role.`,
            confirmText: 'Simpan & kirim notif',
            cancelText: 'Batal',
        });
        if (!confirmed) return;

        try {
            setClosureLoading(true);
            const res = await adminApi.createCenterClosure({
                ...source,
                type,
                source: 'manual',
                isActive: true,
                notify: true,
            });
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menyimpan jadwal off');
            await loadClosures({ silent: true });
            window.dispatchEvent(new Event('notificationsUpdated'));
            if (type === 'temporary_closure') {
                setTemporaryClosure({ title: 'Tutup sementara', startDate: todayIso(), endDate: todayIso(), reopensAt: '', note: '' });
            } else {
                setManualOff({ title: '', startDate: todayIso(), endDate: todayIso(), note: '' });
            }
            showToast('Jadwal off center berhasil disimpan dan notifikasi dikirim.');
        } catch (e) {
            showToast(e.message || 'Gagal menyimpan jadwal off center', 'error');
        } finally {
            setClosureLoading(false);
        }
    };

    const handleToggleClosure = async (closure) => {
        const nextActive = !closure.isActive;
        const confirmed = await confirmAction({
            tone: nextActive ? 'warning' : 'info',
            title: nextActive ? 'Aktifkan jadwal off?' : 'Nonaktifkan jadwal off?',
            message: nextActive
                ? `Aktifkan kembali jadwal off "${closure.title}"?`
                : `Nonaktifkan jadwal off "${closure.title}" agar center kembali aktif pada tanggal tersebut?`,
            confirmText: nextActive ? 'Aktifkan' : 'Nonaktifkan',
            cancelText: 'Batal',
        });
        if (!confirmed) return;

        try {
            setClosureLoading(true);
            const res = await adminApi.updateCenterClosure(closure.id, {
                isActive: nextActive,
                notify: true,
            });
            if (!res.ok) throw new Error(res.data?.error || 'Gagal memperbarui jadwal off');
            await loadClosures({ silent: true });
            window.dispatchEvent(new Event('notificationsUpdated'));
            showToast(nextActive ? 'Jadwal off diaktifkan.' : 'Jadwal off dinonaktifkan, center kembali aktif.');
        } catch (e) {
            showToast(e.message || 'Gagal memperbarui jadwal off', 'error');
        } finally {
            setClosureLoading(false);
        }
    };

    const handleDeleteClosure = async (closure) => {
        const confirmed = await confirmAction({
            tone: 'danger',
            title: 'Hapus jadwal off?',
            message: `Jadwal off "${closure.title}" akan dihapus.`,
            confirmText: 'Hapus',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        try {
            setClosureLoading(true);
            const res = await adminApi.deleteCenterClosure(closure.id);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menghapus jadwal off');
            await loadClosures({ silent: true });
            showToast('Jadwal off center dihapus.');
        } catch (e) {
            showToast(e.message || 'Gagal menghapus jadwal off', 'error');
        } finally {
            setClosureLoading(false);
        }
    };

    return (
        <>
        {/* Toast */}
        {toast && (
            <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold border backdrop-blur-sm ${
                toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toast.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {toast.type === 'success' ? 'check_circle' : 'info'}
                </span>
                {toast.msg}
            </div>
        )}
        <div className="relative flex min-h-full flex-col bg-background-light pb-24 dark:bg-background-dark">
            <Header />

            <div className="flex flex-1 w-full max-w-[1200px] mx-auto pt-6 px-4 md:px-8 gap-8">
                <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

                <main className="flex-1 flex flex-col pb-10">
                    <div className="flex flex-col gap-2 mb-8">
                        <h2 className="text-[32px] font-bold leading-tight capitalize">{activeSection.replace('-', ' ')} Settings</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                            {activeSection === 'branding' && "Manage your center's visual identity, including naming, logos, colors, and global appearance."}
                            {activeSection === 'general' && "Manage general center settings such as operating hours, contact info, and system preferences."}
                            {activeSection === 'schedule' && "Kelola tanggal merah Indonesia, jadwal off center, dan tutup sementara yang terhubung ke notifikasi portal."}
                            {activeSection === 'notifications' && "Configure how and when automatic notifications are sent to staff and families."}
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-2 md:hidden">
                        {[
                            { id: 'general', label: 'General', icon: 'settings' },
                            { id: 'branding', label: 'Branding', icon: 'palette' },
                            { id: 'schedule', label: 'Jadwal Off', icon: 'event_busy' },
                            { id: 'notifications', label: 'Notifikasi', icon: 'notifications' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveSection(item.id)}
                                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${
                                    activeSection === item.id
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                <span className="truncate">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* BRANDING SECTION */}
                    {activeSection === 'branding' && (
                        <div className="flex flex-col gap-8">
                            {/* General Identity Section */}
                            <section className="flex flex-col gap-4">
                                <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">General Identity</h3>
                                <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                        <label htmlFor="clinic-name" className="block text-sm font-bold mb-2">Center Name</label>
                                        <input
                                            id="clinic-name"
                                            type="text"
                                            value={clinicName}
                                            onChange={(e) => setClinicName(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm shadow-sm focus:border-primary focus:ring-primary dark:focus:border-primary outline-none px-3 py-2.5 text-slate-900 dark:text-white"
                                            placeholder="Enter full center name"
                                        />
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">This name appears on portals, headers, and official communications.</p>
                                        </div>
                                        <div>
                                            <label htmlFor="center-subtitle" className="block text-sm font-bold mb-2">Center Description</label>
                                            <input
                                                id="center-subtitle"
                                                type="text"
                                                value={centerSubtitle}
                                                onChange={(e) => setCenterSubtitle(e.target.value)}
                                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm shadow-sm focus:border-primary focus:ring-primary dark:focus:border-primary outline-none px-3 py-2.5 text-slate-900 dark:text-white"
                                                placeholder="Pusat Terapi Anak dan Keluarga"
                                            />
                                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Shown under the logo in PDF reports.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Logos Section */}
                            <section className="flex flex-col gap-4">
                                <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">Logos & Iconography</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-base font-bold leading-tight mb-1">Center Logo</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">Used on main navigation, portals, and PDF reports.</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload akan langsung tersimpan ke branding. URL manual tetap bisa disimpan lewat Save Changes.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={logoUrl}
                                                onChange={(e) => setLogoUrl(e.target.value)}
                                                placeholder="https://cdn.example.com/logo.svg"
                                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 outline-none text-slate-900 dark:text-white"
                                            />
                                            <AssetUploadButton id="upload-center-logo" label="Upload Logo" uploading={uploadingAsset === 'logo'} onFile={(file) => handleAssetUpload('logo', file)} />
                                        </div>
                                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 aspect-[3/1] rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                            {logoUrl ? (
                                                <img src={logoUrl} alt={`${clinicName} logo`} className="max-h-20 max-w-[80%] object-contain" />
                                            ) : (
                                                <span className="text-xl font-bold text-slate-400 dark:text-slate-600">{clinicName || 'Your Logo Here'}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-base font-bold leading-tight mb-1">Favicon</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">Shown in browser tabs.</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload PNG/ICO langsung disimpan untuk semua portal.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={faviconUrl}
                                                onChange={(e) => setFaviconUrl(e.target.value)}
                                                placeholder="https://cdn.example.com/favicon.png"
                                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 outline-none text-slate-900 dark:text-white"
                                            />
                                            <AssetUploadButton id="upload-center-favicon" label="Upload Favicon" uploading={uploadingAsset === 'favicon'} onFile={(file) => handleAssetUpload('favicon', file)} />
                                        </div>
                                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 aspect-[3/1] rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                                            <div className="size-16 bg-white dark:bg-slate-900 shadow-sm rounded-lg flex items-center justify-center p-2 text-primary">
                                                {faviconUrl ? (
                                                    <img src={faviconUrl} alt={`${clinicName} favicon`} className="max-h-10 max-w-10 object-contain" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[32px]">health_and_safety</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-base font-bold leading-tight mb-1">Center Photo</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">Used as the welcome visual on portal login pages.</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload foto center langsung aktif di semua portal.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={centerPhotoUrl}
                                                onChange={(e) => setCenterPhotoUrl(e.target.value)}
                                                placeholder="https://cdn.example.com/center-photo.jpg"
                                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 outline-none text-slate-900 dark:text-white"
                                            />
                                            <AssetUploadButton id="upload-center-photo" label="Upload Photo" uploading={uploadingAsset === 'photo'} onFile={(file) => handleAssetUpload('photo', file)} />
                                        </div>
                                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 aspect-[3/1] rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                            {centerPhotoUrl ? (
                                                <img src={centerPhotoUrl} alt={`${clinicName} center`} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-[40px] text-slate-300 dark:text-slate-600">add_photo_alternate</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Colors Section */}
                            <section className="flex flex-col gap-4">
                                <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">Brand Colors</h3>
                                <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-8">
                                    <div className="flex-1 flex flex-col gap-6">
                                        <div>
                                            <label htmlFor="primary-color" className="block text-sm font-bold mb-2">Primary Brand Color</label>
                                            <div className="flex items-center gap-4">
                                                <input type="color" id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="size-10 rounded cursor-pointer border-0 p-0 bg-transparent" />
                                                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 max-w-[120px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 outline-none uppercase text-slate-900 dark:text-white" />
                                            </div>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Used for buttons, links, and active states.</p>
                                        </div>
                                        <div>
                                            <label htmlFor="secondary-color" className="block text-sm font-bold mb-2">Secondary Accent</label>
                                            <div className="flex items-center gap-4">
                                                <input type="color" id="secondary-color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="size-10 rounded cursor-pointer border-0 p-0 bg-transparent" />
                                                <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 max-w-[120px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 outline-none uppercase text-slate-900 dark:text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live Preview */}
                                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/30 rounded-lg p-6 border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Live Preview — {clinicName}</p>
                                        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden text-slate-900 dark:text-slate-100">
                                            <div className="px-4 py-3 text-white flex justify-between items-center transition-colors" style={{ backgroundColor: primaryColor }}>
                                                <span className="font-medium text-sm truncate pr-2">{clinicName}</span>
                                                <span className="material-symbols-outlined text-[18px]">menu</span>
                                            </div>
                                            <div className="p-5 flex flex-col gap-4">
                                                <p className="text-sm">Welcome back to the center. Your next appointment is ready.</p>
                                                <div className="flex gap-2">
                                                    <button className="text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors border-0" style={{ backgroundColor: primaryColor }}>Book Now</button>
                                                    <button className="text-xs font-medium px-4 py-2 rounded-lg border transition-colors bg-transparent" style={{ borderColor: primaryColor, color: primaryColor }}>Details</button>
                                                </div>
                                                <a href="#" className="text-xs underline mt-2 transition-colors" style={{ color: primaryColor }}>View full schedule</a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* GENERAL SECTION */}
                    {activeSection === 'general' && (
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-5">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Center Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Operating Hours (Weekday)</label>
                                        <input type="text" value={operatingHoursWeekday} onChange={(e) => setOperatingHoursWeekday(e.target.value)} placeholder="08:00 - 17:00" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Operating Hours (Weekend)</label>
                                        <input type="text" value={operatingHoursWeekend} onChange={(e) => setOperatingHoursWeekend(e.target.value)} placeholder="Tutup" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact Email</label>
                                        <input type="email" value={centerEmail} onChange={(e) => setCenterEmail(e.target.value)} placeholder="admin@specialneedscenter.id" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact Phone</label>
                                        <input type="tel" value={centerPhone} onChange={(e) => setCenterPhone(e.target.value)} placeholder="Contoh: 021123456 atau 6281234567890" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">WhatsApp Admin</label>
                                        <input type="tel" value={adminWhatsApp} onChange={(e) => setAdminWhatsApp(e.target.value)} placeholder="Contoh: 6281234567890" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                        <p className="text-xs text-slate-500">Gunakan kode negara tanpa +, contoh: 6281234567890</p>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Website</label>
                                        <input type="text" value={centerWebsite} onChange={(e) => setCenterWebsite(e.target.value)} placeholder="specialneedscenter.id" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5 md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Center Address</label>
                                        <input type="text" value={centerAddress} onChange={(e) => setCenterAddress(e.target.value)} placeholder="Jl. Sudirman No. 1, Jakarta Selatan, DKI Jakarta" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SCHEDULE OFF SECTION */}
                    {activeSection === 'schedule' && (
                        <div className="flex flex-col gap-6">
                            <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${activeClosureToday ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            <span className="material-symbols-outlined text-[26px]">{activeClosureToday ? 'event_busy' : 'event_available'}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-wider text-slate-500">Status Operasional Hari Ini</p>
                                            <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                                                {activeClosureToday ? 'Center Sedang Libur / Off' : 'Center Aktif'}
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                {activeClosureToday
                                                    ? `${activeClosureToday.title} (${formatRange(activeClosureToday)})`
                                                    : 'Tidak ada jadwal off aktif untuk hari ini.'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => loadClosures()}
                                        disabled={closureLoading}
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <span className={`material-symbols-outlined text-[20px] ${closureLoading ? 'animate-spin' : ''}`}>refresh</span>
                                        Refresh Status
                                    </button>
                                </div>
                            </section>

                            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Tarik Tanggal Merah Indonesia</h3>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Data otomatis ditarik dari API hari libur Indonesia. Admin tetap memilih dan meng-apply tanggal yang ingin dijadikan off center.
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <input
                                                type="number"
                                                min="2020"
                                                max="2035"
                                                value={holidayYear}
                                                onChange={(event) => setHolidayYear(event.target.value)}
                                                className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleFetchHolidays}
                                                disabled={holidayLoading}
                                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${holidayLoading ? 'animate-spin' : ''}`}>sync</span>
                                                Tarik
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-5 max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                        {holidayCandidates.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-slate-500">
                                                <span className="material-symbols-outlined text-[36px] text-slate-300">event_note</span>
                                                Klik Tarik untuk memuat tanggal merah tahun {holidayYear}.
                                            </div>
                                        ) : holidayCandidates.map((holiday) => {
                                            const alreadyApplied = closures.some((item) => item.type === 'public_holiday' && item.startDate === holiday.date);
                                            const selected = selectedHolidayDates.includes(holiday.date);
                                            return (
                                                <label
                                                    key={`${holiday.date}-${holiday.title}`}
                                                    className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800 ${alreadyApplied ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selected || alreadyApplied}
                                                        disabled={alreadyApplied}
                                                        onChange={() => toggleHolidaySelection(holiday.date)}
                                                        className="mt-1 rounded text-primary focus:ring-primary disabled:opacity-50"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-black text-slate-900 dark:text-white">{holiday.title}</p>
                                                        <p className="text-xs font-semibold text-slate-500">{formatDate(holiday.date)} {holiday.isCollectiveLeave ? '- Cuti Bersama' : ''}</p>
                                                    </div>
                                                    {alreadyApplied && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">Applied</span>}
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs font-semibold text-slate-500">
                                            {selectedHolidayDates.length} tanggal dipilih. Tanggal yang sudah applied tidak akan diduplikasi.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleApplySelectedHolidays}
                                            disabled={closureLoading || selectedHolidayDates.length === 0}
                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
                                        >
                                            <span className="material-symbols-outlined text-[19px]">done_all</span>
                                            Apply Off Center
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-6">
                                    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Libur Manual</h3>
                                        <p className="mt-1 text-sm text-slate-500">Untuk acara internal, maintenance, atau hari off khusus center.</p>
                                        <div className="mt-4 grid grid-cols-1 gap-3">
                                            <input value={manualOff.title} onChange={(e) => setManualOff((prev) => ({ ...prev, title: e.target.value }))} placeholder="Contoh: Training internal center" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <input type="date" value={manualOff.startDate} onChange={(e) => setManualOff((prev) => ({ ...prev, startDate: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                                <input type="date" value={manualOff.endDate} onChange={(e) => setManualOff((prev) => ({ ...prev, endDate: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                            </div>
                                            <textarea value={manualOff.note} onChange={(e) => setManualOff((prev) => ({ ...prev, note: e.target.value }))} rows={2} placeholder="Catatan untuk admin/keluarga/terapis" className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                            <button type="button" onClick={() => handleCreateClosure('manual_off')} disabled={closureLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white transition hover:bg-primary/90 disabled:opacity-60">
                                                <span className="material-symbols-outlined text-[19px]">add</span>
                                                Simpan Libur Manual
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Tutup Sementara</h3>
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Untuk kondisi khusus dan tanggal center akan beroperasi kembali.</p>
                                        <div className="mt-4 grid grid-cols-1 gap-3">
                                            <input value={temporaryClosure.title} onChange={(e) => setTemporaryClosure((prev) => ({ ...prev, title: e.target.value }))} placeholder="Tutup sementara" className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-amber-900 dark:bg-slate-900 dark:text-white" />
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <input type="date" value={temporaryClosure.startDate} onChange={(e) => setTemporaryClosure((prev) => ({ ...prev, startDate: e.target.value }))} className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-amber-900 dark:bg-slate-900 dark:text-white" />
                                                <input type="date" value={temporaryClosure.endDate} onChange={(e) => setTemporaryClosure((prev) => ({ ...prev, endDate: e.target.value }))} className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-amber-900 dark:bg-slate-900 dark:text-white" />
                                                <input type="date" value={temporaryClosure.reopensAt} onChange={(e) => setTemporaryClosure((prev) => ({ ...prev, reopensAt: e.target.value }))} className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-amber-900 dark:bg-slate-900 dark:text-white" title="Tanggal beroperasi kembali" />
                                            </div>
                                            <textarea value={temporaryClosure.note} onChange={(e) => setTemporaryClosure((prev) => ({ ...prev, note: e.target.value }))} rows={2} placeholder="Alasan tutup sementara dan arahan komunikasi" className="resize-y rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-amber-900 dark:bg-slate-900 dark:text-white" />
                                            <button type="button" onClick={() => handleCreateClosure('temporary_closure')} disabled={closureLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-black text-white transition hover:bg-amber-700 disabled:opacity-60">
                                                <span className="material-symbols-outlined text-[19px]">report</span>
                                                Terapkan Tutup Sementara
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Daftar Jadwal Off Center</h3>
                                        <p className="text-sm text-slate-500">Nonaktifkan jika libur batal, atau hapus untuk membersihkan riwayat yang salah input.</p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {closures.filter((item) => item.isActive).length} aktif
                                    </span>
                                </div>

                                {closures.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm font-semibold text-slate-500 dark:border-slate-800">
                                        Belum ada jadwal off center.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {closures.map((closure) => (
                                            <div key={closure.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${closure.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {closure.isActive ? 'Aktif' : 'Nonaktif'}
                                                        </span>
                                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{CLOSURE_TYPE_LABELS[closure.type] || closure.type}</span>
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-500">{closure.source}</span>
                                                    </div>
                                                    <p className="text-base font-black text-slate-900 dark:text-white">{closure.title}</p>
                                                    <p className="text-sm font-semibold text-slate-500">{formatRange(closure)} {closure.reopensAt ? `- Buka kembali ${formatDate(closure.reopensAt)}` : ''}</p>
                                                    {closure.note && <p className="mt-1 text-sm text-slate-500">{closure.note}</p>}
                                                </div>
                                                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                                    <button type="button" onClick={() => handleToggleClosure(closure)} disabled={closureLoading} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition disabled:opacity-60 ${closure.isActive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                                        <span className="material-symbols-outlined text-[17px]">{closure.isActive ? 'toggle_off' : 'toggle_on'}</span>
                                                        {closure.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteClosure(closure)} disabled={closureLoading} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60">
                                                        <span className="material-symbols-outlined text-[17px]">delete</span>
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {/* NOTIFICATIONS SECTION */}
                    {activeSection === 'notifications' && (
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-5">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Notification Channels</h3>
                                {[
                                    { label: 'New Registration Alert', desc: 'Notify admin when a new child registration is submitted.' },
                                    { label: 'Session Reminder (24h)', desc: 'Remind parent and therapist 24 hours before a session.' },
                                    { label: 'Reschedule Request', desc: 'Alert admin when a parent submits a reschedule request.' },
                                    { label: 'Report Uploaded', desc: 'Notify parent when a therapist uploads a progress report.' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                                            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" /> Email</label>
                                            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" /> In-App</label>
                                            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="rounded text-primary focus:ring-primary" /> SMS</label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Removed USER ROLES SECTION per request */}
                </main>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-[1200px] mx-auto flex flex-col justify-end gap-3 px-4 sm:flex-row md:px-8">
                    <button
                        onClick={handleResetDefault}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                        Atur Semula
                    </button>
                    <button
                        onClick={handleCancel}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
        </>
    );
}

export default App;
