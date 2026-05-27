import React, { useCallback, useState, useEffect, useRef } from 'react';
import { childrenApi, sessionsApi } from '../../../shared/api/client';
import { uploadImageFile } from '../../../shared/uploadImage';
import { readParentUser } from '../../../shared/sessionIdentity';

export default function ChildProfile() {
    const [child, setChild] = useState(null);
    const [completedSessions, setCompletedSessions] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const photoInputRef = useRef(null);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        setPhotoError('');
        try {
            const user = readParentUser();
            if (!user) throw new Error('Sesi orang tua tidak ditemukan. Silakan login ulang.');
            const childId = user.childId;
            const parentId = user.parentId;
            if (!childId && !parentId) throw new Error('Akun orang tua belum terhubung dengan profil anak.');

            let targetChildId = childId;
            if (!targetChildId && parentId) {
                const cres = await childrenApi.getByParent(parentId);
                if (!cres.ok) throw new Error(cres.data?.error || 'Profil anak belum bisa dimuat.');
                const children = cres.data?.data || [];
                if (children.length > 0) {
                    targetChildId = children[0].id || children[0].nita;
                }
            }

            if (!targetChildId) throw new Error('Profil anak belum tersedia untuk akun ini.');

            const res = await childrenApi.getById(targetChildId);
            if (!res.ok) throw new Error(res.data?.error || 'Profil anak belum bisa dimuat.');
            const nextChild = res.data?.data || null;
            if (!nextChild) throw new Error('Profil anak belum ditemukan.');
            setChild(nextChild);

            const sessRes = await sessionsApi.getCompletedForChild(targetChildId);
            if (!sessRes.ok) {
                setCompletedSessions([]);
                setLoadError(sessRes.data?.error || 'Riwayat sesi belum bisa dimuat.');
                return;
            }
            setCompletedSessions(sessRes.data?.data || []);
        } catch(e) {
            console.error(e);
            setChild(null);
            setCompletedSessions([]);
            setLoadError(e.message || 'Profil anak belum bisa dimuat.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-slate-900">
                <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4 animate-pulse">child_care</span>
                <h2 className="text-xl font-bold text-slate-600 dark:text-slate-300">Memuat Profil Anak...</h2>
            </div>
        );
    }

    if (!child) {
        return (
            <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-900">
                <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/50 dark:bg-slate-800">
                    <span className="material-symbols-outlined text-4xl text-amber-500">error</span>
                    <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Profil anak belum bisa dimuat</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{loadError || 'Data anak belum tersedia.'}</p>
                    <button
                        type="button"
                        onClick={loadProfile}
                        className="mt-5 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-600"
                    >
                        Coba lagi
                    </button>
                </div>
            </div>
        );
    }

    // Calculate age
    const calculateAge = (dob) => {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return `${age} years old`;
    };

    const handleChildPhotoChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !child) return;

        setUploadingPhoto(true);
        setPhotoError('');
        try {
            const photoUrl = await uploadImageFile(file, 'child-profile');
            const res = await childrenApi.updatePhoto(child.id || child.nita, photoUrl);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menyimpan foto anak');
            setChild(res.data?.data || { ...child, photoUrl });
        } catch (error) {
            setPhotoError(error.message || 'Gagal upload foto anak');
        } finally {
            setUploadingPhoto(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
            {/* Minimal Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5">
                <span className="material-symbols-outlined text-3xl text-sky-500">account_circle</span>
                <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Child Profile</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">View biodata and clinical statistics</p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-5xl mx-auto flex flex-col gap-6">
                    {loadError && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            {loadError}
                        </div>
                    )}

                    {/* Top Identity Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/60 dark:border-slate-700/60 flex flex-col md:flex-row gap-8 items-center md:items-start relative overflow-hidden">
                        
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 dark:bg-sky-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        {/* Avatar */}
                        <div className="relative z-10 flex flex-col items-center gap-2">
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="group relative w-32 h-32 md:w-40 md:h-40 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 border-4 border-white dark:border-slate-800 shadow-xl flex items-center justify-center text-white text-5xl font-bold"
                                aria-label="Upload foto anak"
                            >
                                {child.photoUrl ? (
                                    <img src={child.photoUrl} alt={child.name || 'Foto anak'} className="h-full w-full object-cover" />
                                ) : (
                                    (child.name || 'A').charAt(0)
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    <span className="material-symbols-outlined text-3xl">{uploadingPhoto ? 'hourglass_top' : 'photo_camera'}</span>
                                </span>
                            </button>
                            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChildPhotoChange} />
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 shadow-sm hover:bg-sky-50 disabled:cursor-wait disabled:opacity-70 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300"
                            >
                                {uploadingPhoto ? 'Mengunggah...' : 'Upload Foto'}
                            </button>
                            {photoError && <p className="max-w-[10rem] text-center text-xs font-semibold text-red-500">{photoError}</p>}
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 flex flex-col text-center md:text-left z-10 w-full mt-2">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">{child.name}</h2>
                                    <p className="text-sky-600 dark:text-sky-400 font-bold mt-1 tracking-wide uppercase text-sm">
                                        NITA: {child.nita}
                                    </p>
                                </div>
                                <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800/50 w-fit mx-auto md:mx-0 font-bold text-sm">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                    Status: {child.status === 'active' ? 'Active Therapy' : child.status}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Diagnosis</p>
                                    <p className="text-slate-900 dark:text-slate-200 font-semibold">{child.diagnosis || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Age & DOB</p>
                                    <p className="text-slate-900 dark:text-slate-200 font-semibold">{calculateAge(child.dob)} ({child.dob})</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Gender</p>
                                    <p className="text-slate-900 dark:text-slate-200 font-semibold capitalize">{child.gender}</p>
                                </div>
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">School Base</p>
                                    <p className="text-slate-900 dark:text-slate-200 font-semibold">{child.school || '—'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Therapy Programs */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 dark:border-slate-700/60 flex flex-col h-full">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sky-500 text-[22px]">assignment</span>
                                Active Programs
                            </h3>
                            
                            {(child.periods?.length || child.therapyPrograms?.length) ? (
                                <div className="space-y-6 flex-1">
                                    {(child.periods?.length ? child.periods : child.therapyPrograms).map((prog, i) => {
                                        const completed = prog.completedSessions ?? prog.sessionsCompleted ?? 0;
                                        const totalSessions = Number(prog.totalSessions || 0);
                                        const pct = prog.progress ?? (totalSessions > 0 ? Math.min(100, Math.round((completed / totalSessions) * 100)) : 0);
                                        return (
                                            <div key={i} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`size-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center`}>
                                                            <span className="material-symbols-outlined text-[20px]">{prog.icon || 'star'}</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">{prog.programName || prog.type || prog.name}</h4>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{prog.name || 'Periode aktif'} - Target: {prog.goal || '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-ends mb-1.5 px-1">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Progress</span>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{completed} / {totalSessions} Sessions</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                                    <div className="bg-sky-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">menu_book</span>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada program terapi terdaftar.</p>
                                </div>
                            )}
                        </div>

                        {/* Summary / Stats Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-500 text-[22px]">bar_chart</span>
                                Therapy Statistics
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Total Sessions */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center text-center gap-2">
                                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-1">
                                        <span className="material-symbols-outlined text-[24px]">task_alt</span>
                                    </div>
                                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{completedSessions.length}</span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Completed</span>
                                </div>

                                {/* Programs Enrolled */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center text-center gap-2">
                                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-1">
                                        <span className="material-symbols-outlined text-[24px]">workspace_premium</span>
                                    </div>
                                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{child.periods?.length || child.therapyPrograms?.length || 0}</span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Programs</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-3">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Milestone Summary:</p>
                                <ul className="space-y-2">
                                    {(child.periods?.length ? child.periods : child.therapyPrograms || []).slice(0,2).map((p, idx) => (
                                        <li key={idx} className="flex gap-2 items-start text-sm text-slate-600 dark:text-slate-400">
                                            <span className="material-symbols-outlined text-[18px] text-sky-500 shrink-0">check_circle</span>
                                            <span>Focus on {p.goal || p.programName || p.type} ({p.completedSessions ?? p.sessionsCompleted ?? 0} sessions tracked)</span>
                                        </li>
                                    ))}
                                    {(!child.periods?.length && (!child.therapyPrograms || child.therapyPrograms.length === 0)) && (
                                        <p className="text-xs italic text-slate-400">Detail milestones akan dihitung berdasarkan program yang sedang dijalani.</p>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
