import React, { useState, useEffect } from 'react';
import { parentsApi } from '../../../shared/api/client';
import { readParentUser } from '../../../shared/sessionIdentity';
import LanguageSettingsPanel from '../../../shared/ui/LanguageSettingsPanel';

const PARENT_SETTINGS_KEY = 'theracare_parent_portal_preferences';

function readPreferences() {
    try {
        return JSON.parse(localStorage.getItem(PARENT_SETTINGS_KEY) || '{}');
    } catch {
        return {};
    }
}

export default function Settings() {
    const [theme, setTheme] = useState('light');
    const [notifEmail, setNotifEmail] = useState(() => readPreferences().notifEmail ?? true);
    const [notifSms, setNotifSms] = useState(() => readPreferences().notifSms ?? false);
    const [parentData, setParentData] = useState({ name: '', email: '', phone: '' });
    const [profileNotice, setProfileNotice] = useState('');
    
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const prefs = readPreferences();
        if (prefs.theme === 'dark' || (!prefs.theme && document.documentElement.classList.contains('dark'))) {
            document.documentElement.classList.add('dark');
            setTheme('dark');
        } else if (prefs.theme === 'light') {
            document.documentElement.classList.remove('dark');
            setTheme('light');
        }
        
        const load = async () => {
            const user = readParentUser();
            if (user) {
                try {
                    const res = await parentsApi.getById(user.parentId);
                    if (!res.ok) {
                        setProfileNotice(res.data?.error || 'Profil orang tua belum bisa dimuat dari server.');
                        if (user.name) setParentData(prev => ({ ...prev, name: user.name }));
                        return;
                    }
                    const parent = res.data?.data;
                    if (parent) {
                        setParentData({
                            name: parent.name || user.name || '',
                            email: parent.email || '',
                            phone: parent.phone || '',
                        });
                    } else if (user.name) {
                        setParentData(prev => ({ ...prev, name: user.name }));
                    }
                } catch (e) {
                    setProfileNotice('Profil orang tua belum bisa dimuat dari server.');
                    if (user.name) setParentData(prev => ({ ...prev, name: user.name }));
                }
            }
        };
        load();
    }, []);


    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        setTheme(isDark ? 'dark' : 'light');
    };
    
    const handleSave = (e) => {
        e.preventDefault();
        try {
            localStorage.setItem(PARENT_SETTINGS_KEY, JSON.stringify({ notifEmail, notifSms, theme }));
        } catch {}
        setToast('Preferensi berhasil disimpan.');
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 lg:border-t-0">
            {/* Page Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white shadow-md shadow-slate-500/20">
                    <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Pengaturan</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Kelola akun, preferensi, dan keamanan.</p>
                </div>
            </header>

            <main className="relative flex-1 p-4 md:p-8">
                {/* Toast Notification */}
                {toast && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fadeIn">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-sm font-semibold">{toast}</span>
                    </div>
                )}

                <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    <form onSubmit={handleSave} className="flex flex-col gap-6">
                        <LanguageSettingsPanel />
                        
                        {/* Profile Info Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-slate-400">person</span> 
                                    Profil Akun
                                </h2>
                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Data login dikelola admin dan akan diperbarui otomatis ketika kontak orang tua berubah.
                                </p>
                                {profileNotice && (
                                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                        {profileNotice}
                                    </p>
                                )}
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                                    <input 
                                        type="text" 
                                        value={parentData.name} 
                                        readOnly
                                        className="w-full cursor-default px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl outline-none text-slate-900 dark:text-white text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
                                    <input 
                                        type="email" 
                                        value={parentData.email} 
                                        readOnly
                                        placeholder="Belum diatur admin"
                                        className="w-full cursor-default px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl outline-none text-slate-900 dark:text-white text-sm transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nomor Telepon</label>
                                    <input 
                                        type="tel" 
                                        value={parentData.phone} 
                                        readOnly
                                        className="w-full cursor-default px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl outline-none text-slate-900 dark:text-white text-sm transition-all md:w-1/2"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notifications Preferences */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-slate-400">notifications_active</span> 
                                    Preferensi Notifikasi
                                </h2>
                            </div>
                            <div className="p-6 flex flex-col gap-4">
                                <label className="flex items-center justify-between cursor-pointer p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Notifikasi Email</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Terima pengingat jadwal dan laporan ke email.</p>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full transition-colors relative ${notifEmail ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <input type="checkbox" className="sr-only" checked={notifEmail} onChange={() => setNotifEmail(!notifEmail)} />
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${notifEmail ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                                <label className="flex items-center justify-between cursor-pointer p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Notifikasi SMS / WhatsApp</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Pemberitahuan darurat atau penjadwalan batal.</p>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full transition-colors relative ${notifSms ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <input type="checkbox" className="sr-only" checked={notifSms} onChange={() => setNotifSms(!notifSms)} />
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${notifSms ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Display Preferences */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-slate-400">palette</span> 
                                    Tampilan
                                </h2>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Tema Aplikasi</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Beralih antara mode Terang (Light) dan Gelap (Dark).</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={toggleTheme}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                                        </span>
                                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end mb-10">
                            <button 
                                type="submit" 
                                className="px-8 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">save</span>
                                Simpan Preferensi
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
