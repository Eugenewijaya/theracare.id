import React, { useRef, useState } from 'react';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const TherapistProfile = ({ user, onPhotoUpdate }) => {
    const fileInputRef = useRef(null);
    const [error, setError] = useState('');
    const initials = (user?.name || 'Therapist')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'T';
    
    const handlePhotoClick = () => {
        setError('');
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_PHOTO_SIZE) {
            setError('Ukuran foto maksimal 5 MB.');
            e.target.value = '';
            return;
        }
        if (onPhotoUpdate) onPhotoUpdate(file);
        e.target.value = '';
    };

    return (
        <div className="flex p-4">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button type="button" className="relative group cursor-pointer text-left w-32 shrink-0" onClick={handlePhotoClick}>
                        {user?.avatar ? (
                            <div
                                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 shadow-sm border-4 border-white dark:border-slate-800"
                                title={user?.name || 'Therapist'}
                                style={{ backgroundImage: `url('${user.avatar}')` }}
                            />
                        ) : (
                            <div className="aspect-square rounded-full min-h-32 w-32 shadow-sm border-4 border-white dark:border-slate-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 flex items-center justify-center text-4xl font-black">
                                {initials}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-white">photo_camera</span>
                        </div>
                        <input 
                            type="file" 
                            accept="image/jpeg,image/png,image/webp"
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileChange} 
                        />
                    </button>
                    <div className="flex flex-col justify-center">
                        <p className="text-slate-900 dark:text-slate-100 text-[22px] font-bold leading-tight tracking-[-0.015em]">{user?.name || 'Therapist'}</p>
                        <p className="text-slate-600 dark:text-slate-300 text-base font-normal leading-normal">{user?.bio || 'Bio belum diisi.'}</p>
                        <p className="text-slate-600 dark:text-slate-300 text-base font-normal leading-normal">Spesialisasi: {user?.specialty || 'Belum diisi'}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {user?.yearsExperience && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1">{user.yearsExperience}</span>}
                            {user?.educationField && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1">{user.educationField}</span>}
                            {user?.primaryRoom && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1">{user.primaryRoom}</span>}
                        </div>
                        {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TherapistProfile;
