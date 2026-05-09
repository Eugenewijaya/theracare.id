import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { adminApi } from '../../shared/api/client';
import { useClinicSettings } from '../../shared/clinicSettings';

const ASSET_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,image/vnd.microsoft.icon,.ico';
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
        if (!ASSET_ACCEPT.includes(contentType) && contentType !== 'image/x-icon') {
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
            if (kind === 'logo') setLogoUrl(url);
            if (kind === 'favicon') setFaviconUrl(url);
            if (kind === 'photo') setCenterPhotoUrl(url);
            showToast('File berhasil diupload. Klik Save Changes untuk menyimpan branding.');
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
        <div className="flex flex-col min-h-screen relative pb-24 bg-background-light dark:bg-background-dark">
            <Header />

            <div className="flex flex-1 w-full max-w-[1200px] mx-auto pt-6 px-4 md:px-8 gap-8">
                <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

                <main className="flex-1 flex flex-col pb-10">
                    <div className="flex flex-col gap-2 mb-8">
                        <h2 className="text-[32px] font-bold leading-tight capitalize">{activeSection.replace('-', ' ')} Settings</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                            {activeSection === 'branding' && "Manage your center's visual identity, including naming, logos, colors, and global appearance."}
                            {activeSection === 'general' && "Manage general center settings such as operating hours, contact info, and system preferences."}
                            {activeSection === 'notifications' && "Configure how and when automatic notifications are sent to staff and families."}
                        </p>
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
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload to CDN storage bucket or paste a hosted PNG/SVG URL.</p>
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
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload PNG/ICO, 32x32px or 64x64px.</p>
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
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload a landscape JPG/PNG/WebP from your storage bucket.</p>
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
                <div className="max-w-[1200px] mx-auto flex justify-end gap-4 px-4 md:px-8">
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
