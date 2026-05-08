import React from 'react';

const ProfileModal = ({ isOpen, onClose, onEditProfile, onOpenNotifications, user }) => {
    if (!isOpen) return null;

    const initials = (user?.name || 'Therapist')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'T';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 transition-all" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profil Terapis</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 focus:outline-none"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    <div className="flex items-center gap-5">
                        {user?.avatar ? (
                            <div
                                className="w-20 h-20 rounded-full bg-cover bg-center border-4 border-slate-100 dark:border-slate-800"
                                style={{ backgroundImage: `url("${user.avatar}")` }}
                                title={user?.name || 'Therapist'}
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 flex items-center justify-center text-2xl font-black">
                                {initials}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-lg font-black text-slate-900 dark:text-white truncate">{user?.name || 'Therapist'}</p>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">{user?.specialty || 'Clinical Team'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email || user?.nit || ''}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={onOpenNotifications}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">notifications</span>
                            Lihat Notifikasi
                        </button>
                        <button
                            onClick={onEditProfile}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            Kelola Profil
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
