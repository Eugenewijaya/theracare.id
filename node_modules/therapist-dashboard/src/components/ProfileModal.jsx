import React, { useState } from 'react';

const ProfileModal = ({ isOpen, onClose }) => {
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [saved, setSaved] = useState(false);
    if (!isOpen) return null;

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => { setSaved(false); onClose(); }, 1800);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 transition-all">
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profile Settings</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 focus:outline-none"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-8">
                    
                    {/* Avatar & Basic Info */}
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div 
                                className="w-24 h-24 rounded-full bg-cover bg-center border-4 border-slate-100 dark:border-slate-800 transition-all group-hover:blur-[2px]"
                                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA0TyDqs2p45WCrtgHdllMwSc4Miwe1S7ifzokt3CzkOeKee8m6AnTahslRwDTHXJWiNnIzYisQ3sJQ1Pfo7D1ORYGZswyJbBoA9z0q9jhaozlehbZmgpuKmYO5EQjOlI9TSc5Bjm9kKecrZosUhKEENn7xNYQs1oTVVrrdInIswDno8fzHSYQL03bcBwdIw5DuYbYrkBmR6PolVq2c5ho50HTYU0UhyVhcSa-9yOCdBUQ51Vipia1UDNe5EkL2FBXpE9HVqSU0Jg')" }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="bg-slate-900/60 p-2 rounded-full text-white backdrop-blur-md">
                                    <span className="material-symbols-outlined">photo_camera</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                            <input type="text" defaultValue="Dr. Sarah Jenkins" className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900 dark:text-white font-medium" />
                        </div>
                    </div>

                    {/* Security */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Security</h3>
                        
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">New Password</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                                    <input type={showNewPassword ? "text" : "password"} placeholder="••••••••" className="w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900 dark:text-white" />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Confirm Password</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock_reset</span>
                                    <input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" className="w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900 dark:text-white" />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Preferences</h3>
                        
                        <div className="flex items-center justify-between py-2">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white">Email Notifications</span>
                                <span className="text-xs text-slate-500">Receive summaries of daily schedule</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-500"></div>
                            </label>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white">Push Notifications</span>
                                <span className="text-xs text-slate-500">Get alerts for schedule changes</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-500"></div>
                            </label>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-3xl">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        {saved ? (
                            <><span className="material-symbols-outlined text-[18px]">check_circle</span> Tersimpan!</>
                        ) : 'Simpan Perubahan'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProfileModal;
