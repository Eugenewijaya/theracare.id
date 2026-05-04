import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { getClinicSettings, updateClinicSettings } from '../../shared/clinicDataStore';

function App() {
    const [activeSection, setActiveSection] = useState('branding');
    const [clinicName, setClinicName] = useState('TheraCare');
    const [primaryColor, setPrimaryColor] = useState('#30abe8');
    const [secondaryColor, setSecondaryColor] = useState('#4e7f97');
    const [adminWhatsApp, setAdminWhatsApp] = useState('');
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const settings = getClinicSettings();
        if (settings && settings.adminWhatsApp) {
            setAdminWhatsApp(settings.adminWhatsApp);
        }
    }, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSave = () => {
        if (adminWhatsApp && !/^\d+$/.test(adminWhatsApp)) {
            showToast('Nomor WhatsApp tidak valid. Hanya gunakan angka tanpa karakter khusus (misal: 6281234567890).', 'error');
            return;
        }
        try {
            const existing = JSON.parse(localStorage.getItem('adminSettings') || '{}');
            localStorage.setItem('adminSettings', JSON.stringify({ ...existing, clinicName, primaryColor, secondaryColor }));
            updateClinicSettings({ adminWhatsApp });
            window.dispatchEvent(new CustomEvent('adminSettingsUpdated'));
        } catch {}
        showToast(`Pengaturan berhasil disimpan!`);
    };

    const handleCancel = () => {
        setClinicName('TheraCare');
        setPrimaryColor('#30abe8');
        setSecondaryColor('#4e7f97');
        const settings = getClinicSettings();
        if (settings && settings.adminWhatsApp) {
            setAdminWhatsApp(settings.adminWhatsApp);
        }
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
                            {activeSection === 'branding' && "Manage your clinic's visual identity, including naming, logos, colors, and global appearance."}
                            {activeSection === 'general' && "Manage general clinic settings such as operating hours, contact info, and system preferences."}
                            {activeSection === 'notifications' && "Configure how and when automatic notifications are sent to staff and patients."}
                        </p>
                    </div>

                    {/* BRANDING SECTION */}
                    {activeSection === 'branding' && (
                        <div className="flex flex-col gap-8">
                            {/* General Identity Section */}
                            <section className="flex flex-col gap-4">
                                <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">General Identity</h3>
                                <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                    <div className="max-w-md">
                                        <label htmlFor="clinic-name" className="block text-sm font-bold mb-2">Clinic Name</label>
                                        <input
                                            id="clinic-name"
                                            type="text"
                                            value={clinicName}
                                            onChange={(e) => setClinicName(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm shadow-sm focus:border-primary focus:ring-primary dark:focus:border-primary outline-none px-3 py-2.5 text-slate-900 dark:text-white"
                                            placeholder="Enter full clinic name"
                                        />
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">This name appears on the parent portal, headers, and official communications.</p>
                                    </div>
                                </div>
                            </section>

                            {/* Logos Section */}
                            <section className="flex flex-col gap-4">
                                <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">Logos & Iconography</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-base font-bold leading-tight mb-1">Clinic Logo</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">Used on main navigation and patient portal.</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Recommended: PNG or SVG, min 400x100px.</p>
                                            </div>
                                            <button onClick={() => showToast('Fitur upload logo akan segera tersedia.', 'info')} className="flex items-center justify-center rounded-lg px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                                                Upload
                                            </button>
                                        </div>
                                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 aspect-[3/1] rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                            <span className="text-xl font-bold text-slate-400 dark:text-slate-600">{clinicName || 'Your Logo Here'}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-base font-bold leading-tight mb-1">Favicon</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">Shown in browser tabs.</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Recommended: PNG or ICO, 32x32px or 64x64px.</p>
                                            </div>
                                            <button onClick={() => showToast('Fitur upload favicon akan segera tersedia.', 'info')} className="flex items-center justify-center rounded-lg px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                                                Upload
                                            </button>
                                        </div>
                                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 aspect-[3/1] rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                                            <div className="size-16 bg-white dark:bg-slate-900 shadow-sm rounded-lg flex items-center justify-center p-2 text-primary">
                                                <span className="material-symbols-outlined text-[32px]">local_hospital</span>
                                            </div>
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
                                                <p className="text-sm">Welcome back to the clinic. Your next appointment is ready.</p>
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
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Clinic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Operating Hours (Weekday)</label>
                                        <input type="text" defaultValue="08:00 – 17:00" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Operating Hours (Weekend)</label>
                                        <input type="text" defaultValue="Closed" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact Email</label>
                                        <input type="email" defaultValue="admin@therapyclinic.com" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">WhatsApp Admin</label>
                                        <input type="tel" value={adminWhatsApp} onChange={(e) => setAdminWhatsApp(e.target.value)} placeholder="Contoh: 6281234567890" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
                                        <p className="text-xs text-slate-500">Gunakan kode negara tanpa +, contoh: 6281234567890</p>
                                    </div>
                                    <div className="flex flex-col gap-1.5 md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Clinic Address</label>
                                        <input type="text" defaultValue="Jl. Sudirman No. 1, Jakarta Selatan, DKI Jakarta" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2.5 outline-none text-slate-900 dark:text-white" />
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
                                    { label: 'New Registration Alert', desc: 'Notify admin when a new patient registers.' },
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
