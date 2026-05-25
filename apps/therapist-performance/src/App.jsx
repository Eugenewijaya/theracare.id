import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TherapistProfile from './components/TherapistProfile';
import { sessionsApi, reportsApi, therapistsApi } from '../../shared/api/client';
import { uploadImageFile } from '../../shared/uploadImage';
import { readTherapistUser, storeTherapistUser } from '../../shared/sessionIdentity';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short' });

function readStoredTherapist() {
    return readTherapistUser();
}

function normalizeCertification(cert, index) {
    const title = cert?.title || cert?.name || '';
    if (!title.trim()) return null;
    const subtitle = cert?.subtitle || [cert?.institution, cert?.year].filter(Boolean).join(' - ') || 'Detail belum diisi';
    return {
        ...cert,
        id: cert?.id || `${index}-${title}`,
        icon: cert?.icon || 'workspace_premium',
        title,
        subtitle,
    };
}

function normalizeCertifications(certifications = []) {
    return certifications.map(normalizeCertification).filter(Boolean);
}

function storeTherapist(user) {
    storeTherapistUser(user, !!localStorage.getItem('therapist_user'));
}

function formatRelativeDate(dateStr) {
    if (!dateStr) return 'Recently';
    const today = new Date();
    const target = new Date(`${dateStr}T00:00:00`);
    const diffDays = Math.max(0, Math.round((today - target) / 86400000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.ceil(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`;
}

function buildMonthlySeries(sessions) {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return {
            key,
            label: MONTH_FORMATTER.format(date),
            scheduled: 0,
            completed: 0,
        };
    });

    sessions.forEach(session => {
        const bucket = buckets.find(item => item.key === session.date?.slice(0, 7));
        if (!bucket) return;
        bucket.scheduled += 1;
        if (session.status === 'done') {
            bucket.completed += 1;
        }
    });

    const maxScheduled = Math.max(1, ...buckets.map(item => item.scheduled));

    return buckets.map(item => ({
        ...item,
        scheduledHeight: `${Math.max(12, Math.round((item.scheduled / maxScheduled) * 100))}%`,
        completedHeight: `${Math.max(8, Math.round(((item.completed || 0) / maxScheduled) * 100))}%`,
    }));
}

function App({ onLogout }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [profileModal, setProfileModal] = useState(false);
    
    // User Management
    const [currentUser, setCurrentUser] = useState(readStoredTherapist);
    const [growth, setGrowth] = useState(() => normalizeCertifications(readStoredTherapist()?.certifications || []));
    const [profileDraft, setProfileDraft] = useState({});
    const [photoUploading, setPhotoUploading] = useState(false);

    // Derived Statistics
    const [stats, setStats] = useState([
        { label: 'Attendance Rate', value: '0%', change: '0%', positive: true },
        { label: 'Avg. Parent Rating', value: '0/5', change: '0', positive: true },
        { label: 'Daily Reports', value: '0', change: '0', positive: true },
        { label: 'Total Sessions', value: '0', change: '0', positive: true },
    ]);
    const [monthlySeries, setMonthlySeries] = useState([]);
    const [volumeSummary, setVolumeSummary] = useState({ scheduled: 0, completed: 0, delta: '0%', completionRate: '0%' });
    const [feedbackFeed, setFeedbackFeed] = useState([]);

    useEffect(() => {
        setGrowth(normalizeCertifications(currentUser?.certifications || []));
    }, [currentUser?.certifications]);

    useEffect(() => {
        if (!currentUser) return;
        
        const updateStats = async () => {
            try {
                const [sessionsRes, reportsRes] = await Promise.all([
                    sessionsApi.getForTherapist(currentUser.id),
                    reportsApi.getForTherapist(currentUser.id, 'harian')
                ]);
                
                const sessions = sessionsRes.data?.data || [];
                const dailyReports = reportsRes.data?.data || [];

                const total = sessions.length;
                const doneSessions = sessions.filter(s => s.status === 'done');
                const attendance = total > 0 ? Math.round((doneSessions.length / total) * 100) : 0;
                
                // Calculate rating
                let totalRating = 0;
                let ratingCount = 0;
                const comments = [];

                const ratingsPromises = doneSessions.map(s => sessionsApi.getRating(s.id).then(r => ({ session: s, res: r })));
                const ratingsResults = await Promise.all(ratingsPromises);

                ratingsResults.forEach(({ session, res }) => {
                    const r = res.data?.data;
                    if (r && r.rating) {
                        totalRating += r.rating;
                        ratingCount++;
                        if (r.comment?.trim()) {
                            comments.push({
                                id: r.id,
                                stars: r.rating,
                                date: session.date,
                                time: formatRelativeDate(session.date),
                                text: `"${r.comment.trim()}"`,
                            });
                        }
                    }
                });

                const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 'N/A';
                const series = buildMonthlySeries(sessions);
                const scheduledSixMonths = series.reduce((sum, item) => sum + item.scheduled, 0);
                const completedSixMonths = series.reduce((sum, item) => sum + item.completed, 0);
                const previousMonth = series[4]?.scheduled || 0;
                const currentMonth = series[5]?.scheduled || 0;
                const delta = previousMonth > 0 ? `${currentMonth >= previousMonth ? '+' : ''}${Math.round(((currentMonth - previousMonth) / previousMonth) * 100)}%` : currentMonth > 0 ? '+100%' : '0%';
                const completionRate = scheduledSixMonths > 0 ? `${Math.round((completedSixMonths / scheduledSixMonths) * 100)}%` : '0%';

                setStats([
                    { label: 'Attendance Rate', value: `${attendance}%`, change: `${doneSessions.length}/${total || 0} completed`, positive: attendance >= 70 },
                    { label: 'Avg. Parent Rating', value: `${avgRating}/5`, change: `${ratingCount} review${ratingCount === 1 ? '' : 's'}`, positive: ratingCount === 0 || Number(avgRating) >= 4 },
                    { label: 'Daily Reports', value: `${dailyReports.length}`, change: `${dailyReports.filter(report => report.status === 'approved').length} approved`, positive: true },
                    { label: 'Total Sessions', value: `${total}`, change: `${scheduledSixMonths} in last 6 months`, positive: true },
                ]);
                setMonthlySeries(series);
                setVolumeSummary({
                    scheduled: scheduledSixMonths,
                    completed: completedSixMonths,
                    delta,
                    completionRate,
                });
                setFeedbackFeed(comments.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
            } catch (e) {
                console.error('Failed to update performance stats', e);
            }
        };

        updateStats();
        window.addEventListener('sessionUpdated', updateStats);
        return () => window.removeEventListener('sessionUpdated', updateStats);
    }, [currentUser]);

    const [growthModal, setGrowthModal] = useState(false);
    const [growthEdit, setGrowthEdit] = useState(null); // null = new item
    const [growthDraft, setGrowthDraft] = useState({ icon: 'workspace_premium', title: '', subtitle: '' });
    const [deleteModal, setDeleteModal] = useState(null);
    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const openProfileModal = () => { 
        setProfileDraft({ 
            name: currentUser?.name || '',
            phone: currentUser?.phone || '',
            specialty: currentUser?.specialty || '',
            bio: currentUser?.bio || '',
            educationLevel: currentUser?.educationLevel || '',
            educationField: currentUser?.educationField || '',
            educationInstitution: currentUser?.educationInstitution || '',
            graduationYear: currentUser?.graduationYear || '',
            strNumber: currentUser?.strNumber || '',
            strExpiry: currentUser?.strExpiry || '',
            yearsExperience: currentUser?.yearsExperience || '',
            languages: currentUser?.languages || '',
            primaryRoom: currentUser?.primaryRoom || '',
            maxClients: currentUser?.maxClients ?? '',
        }); 
        setProfileModal(true); 
    };

    const saveProfile = async () => { 
        if (currentUser) {
            try {
                const res = await therapistsApi.updateProfile(currentUser.id, profileDraft);
                if (!res.ok) throw new Error(res.data?.error || 'Gagal menyimpan profil.');
                if (res.data?.data) {
                    const updated = { ...currentUser, ...res.data.data };
                    setCurrentUser(updated);
                    storeTherapist(updated);
                }
                setProfileModal(false);
                showToast('Profil berhasil diperbarui.');
            } catch (e) {
                console.error('Failed to update profile', e);
                showToast(e.message || 'Gagal menyimpan profil.');
            }
            return;
        }
        setProfileModal(false); 
        showToast('Profil berhasil diperbarui.');
    };

    const handlePhotoUpdate = async (file) => {
        if (currentUser) {
            setPhotoUploading(true);
            try {
                const avatarUrl = await uploadImageFile(file, 'therapist-profile');
                const res = await therapistsApi.updateProfile(currentUser.id, { avatar: avatarUrl });
                if (!res.ok) throw new Error(res.data?.error || 'Gagal menyimpan foto profil.');
                if (res.data?.data) {
                    const updated = { ...currentUser, ...res.data.data };
                    setCurrentUser(updated);
                    storeTherapist(updated);
                }
                showToast('Foto profil berhasil diperbarui.');
            } catch (e) {
                console.error('Failed to update photo', e);
                showToast(e.message || 'Gagal memperbarui foto profil.');
            } finally {
                setPhotoUploading(false);
            }
        }
    };

    const persistGrowth = async (nextGrowth, message) => {
        setGrowth(nextGrowth);
        if (!currentUser?.id) {
            showToast(message);
            return;
        }

        try {
            const res = await therapistsApi.updateProfile(currentUser.id, { certifications: nextGrowth });
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menyimpan sertifikasi.');
            if (res.data?.data) {
                const updated = { ...currentUser, ...res.data.data };
                setCurrentUser(updated);
                storeTherapist(updated);
            }
            showToast(message);
        } catch (e) {
            console.error('Failed to update certifications', e);
            showToast('Gagal menyimpan sertifikasi.');
        }
    };

    const openAddGrowth = () => { setGrowthEdit(null); setGrowthDraft({ icon: 'workspace_premium', title: '', subtitle: '' }); setGrowthModal(true); };
    const openEditGrowth = (item) => { setGrowthEdit(item.id); setGrowthDraft({ icon: item.icon, title: item.title, subtitle: item.subtitle }); setGrowthModal(true); };
    const saveGrowth = async () => {
        if (!growthDraft.title) return;
        if (growthEdit !== null) {
            const nextGrowth = growth.map(g => g.id === growthEdit ? { ...g, ...growthDraft } : g);
            await persistGrowth(nextGrowth, 'Sertifikasi diperbarui.');
        } else {
            const nextGrowth = [...growth, { id: Date.now(), ...growthDraft }];
            await persistGrowth(nextGrowth, 'Sertifikasi ditambahkan.');
        }
        setGrowthModal(false);
    };
    const confirmDelete = async () => {
        const nextGrowth = growth.filter(g => g.id !== deleteModal);
        setDeleteModal(null);
        await persistGrowth(nextGrowth, 'Sertifikasi dihapus.');
    };

    return (
        <div className="layout-container flex h-full grow flex-col">
            <div className="px-4 md:px-10 overflow-x-hidden flex flex-1 justify-center py-5">
                <div className="layout-content-container flex flex-col max-w-[1200px] w-full">
                    <Header searchValue={searchQuery} onSearchChange={setSearchQuery} user={currentUser} onSettingsClick={openProfileModal} onLogout={onLogout} />

                    {/* Profile Header with Edit button */}
                    <div className="relative">
                        <TherapistProfile user={currentUser} onPhotoUpdate={handlePhotoUpdate} uploading={photoUploading} />
                        <button
                            onClick={openProfileModal}
                            className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors text-sm font-bold shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit Profile
                        </button>
                    </div>

                    {/* KPI Stats */}
                    <div className="flex flex-wrap gap-4 p-4">
                        {stats.map((s) => (
                            <div key={s.label} className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark shadow-sm">
                                <p className="text-slate-600 dark:text-slate-300 text-base font-medium leading-normal">{s.label}</p>
                                <p className="text-slate-900 dark:text-slate-100 tracking-light text-2xl font-bold leading-tight">{s.value}</p>
                                <p className={`text-base font-medium leading-normal ${s.positive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{s.change}</p>
                            </div>
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div className="flex flex-wrap gap-4 px-4 py-6">
                        <div className="flex min-w-72 flex-1 flex-col gap-2 rounded-lg border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark shadow-sm p-6">
                            <p className="text-slate-600 dark:text-slate-300 text-base font-medium leading-normal">Monthly Session Volume</p>
                            <p className="text-slate-900 dark:text-slate-100 tracking-light text-[32px] font-bold leading-tight truncate">{volumeSummary.scheduled} Sessions</p>
                            <div className="flex gap-1"><p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">Last 6 Months</p><p className="text-green-600 dark:text-green-400 text-base font-medium leading-normal">{volumeSummary.delta}</p></div>
                            <div className="grid min-h-[180px] grid-flow-col gap-4 grid-rows-[1fr_auto] items-end justify-items-center px-3 py-4">
                                {monthlySeries.map((item) => (
                                    <React.Fragment key={item.key}>
                                        <div className="flex h-full w-full items-end gap-1">
                                            <div className="w-1/2 rounded-t-md bg-slate-200 dark:bg-slate-700" style={{ height: item.scheduledHeight }} />
                                            <div className="w-1/2 rounded-t-md bg-primary/80" style={{ height: item.completedHeight }} />
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-[13px] font-bold leading-normal tracking-[0.015em]">{item.label}</p>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        <div className="flex min-w-72 flex-1 flex-col gap-2 rounded-lg border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark shadow-sm p-6">
                            <p className="text-slate-600 dark:text-slate-300 text-base font-medium leading-normal">Completed vs. Scheduled Sessions</p>
                            <p className="text-slate-900 dark:text-slate-100 tracking-light text-[32px] font-bold leading-tight truncate">{volumeSummary.completed} / {volumeSummary.scheduled}</p>
                            <div className="flex gap-1"><p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">Last 6 Months</p><p className="text-green-600 dark:text-green-400 text-base font-medium leading-normal">{volumeSummary.completionRate} completion</p></div>
                            <div className="grid min-h-[180px] grid-flow-col gap-6 grid-rows-[1fr_auto] items-end justify-items-center px-3">
                                {monthlySeries.map((item) => (
                                    <React.Fragment key={item.key}>
                                        <div className="border-primary bg-primary/20 dark:bg-primary/30 border-t-2 w-full rounded-t-sm" style={{ height: item.scheduled === 0 ? '8%' : `${Math.max(12, Math.round((item.completed / item.scheduled) * 100))}%` }}></div>
                                        <p className="text-slate-500 dark:text-slate-400 text-[13px] font-bold leading-normal tracking-[0.015em]">{item.label}</p>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Parent Feedback */}
                    <h2 className="text-slate-900 dark:text-slate-100 text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Parent Feedback Feed</h2>
                    <div className="flex flex-col gap-4 px-4 pb-6">
                        {feedbackFeed.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                                Belum ada komentar rating dari orang tua.
                            </div>
                        )}
                        {feedbackFeed.filter(f => !searchQuery || f.text.toLowerCase().includes(searchQuery.toLowerCase())).map((f, i) => (
                            <div key={i} className="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark p-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="flex text-yellow-400">
                                        {Array.from({ length: Math.floor(f.stars) }).map((_, j) => <span key={j} className="material-symbols-outlined text-sm">star</span>)}
                                        {f.stars % 1 !== 0 && <span className="material-symbols-outlined text-sm">star_half</span>}
                                    </div>
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">{f.time}</span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-200 text-sm">{f.text}</p>
                            </div>
                        ))}
                    </div>

                    {/* Professional Growth */}
                    <div className="flex items-center justify-between px-4 pb-3 pt-5">
                        <h2 className="text-slate-900 dark:text-slate-100 text-[22px] font-bold leading-tight tracking-[-0.015em]">Professional Growth</h2>
                        <button onClick={openAddGrowth} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-bold">
                            <span className="material-symbols-outlined text-[16px]">add</span>Add Certification
                        </button>
                    </div>
                    <div className="flex flex-col gap-4 px-4 pb-10">
                        {growth.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                                Belum ada sertifikasi yang tersimpan dari admin atau profil terapis.
                            </div>
                        )}
                        {growth.filter(g => !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase()) || g.subtitle.toLowerCase().includes(searchQuery.toLowerCase())).map((g) => (
                            <div key={g.id} className="flex items-center gap-4 rounded-lg border border-slate-200 dark:border-primary/20 bg-white dark:bg-background-dark p-4 shadow-sm group">
                                <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-full text-primary">
                                    <span className="material-symbols-outlined">{g.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-slate-900 dark:text-slate-100 font-semibold">{g.title}</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">{g.subtitle}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditGrowth(g)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => setDeleteModal(g.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {profileModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setProfileModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Edit Profile</h2>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Full Name</label>
                                <input value={profileDraft.name} onChange={e => setProfileDraft(p => ({...p, name: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Phone</label>
                                <input value={profileDraft.phone || ''} onChange={e => setProfileDraft(p => ({...p, phone: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Specialty</label>
                                <input value={profileDraft.specialty} onChange={e => setProfileDraft(p => ({...p, specialty: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Bio</label>
                                <textarea value={profileDraft.bio} onChange={e => setProfileDraft(p => ({...p, bio: e.target.value}))} rows={3} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100 resize-none" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Education Level</label>
                                    <input value={profileDraft.educationLevel || ''} onChange={e => setProfileDraft(p => ({...p, educationLevel: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Education Field</label>
                                    <input value={profileDraft.educationField || ''} onChange={e => setProfileDraft(p => ({...p, educationField: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Education Institution</label>
                                <input value={profileDraft.educationInstitution || ''} onChange={e => setProfileDraft(p => ({...p, educationInstitution: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">STR Number</label>
                                    <input value={profileDraft.strNumber || ''} onChange={e => setProfileDraft(p => ({...p, strNumber: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">STR Expiry</label>
                                    <input type="date" value={profileDraft.strExpiry || ''} onChange={e => setProfileDraft(p => ({...p, strExpiry: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Experience</label>
                                    <input value={profileDraft.yearsExperience || ''} onChange={e => setProfileDraft(p => ({...p, yearsExperience: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Languages</label>
                                    <input value={profileDraft.languages || ''} onChange={e => setProfileDraft(p => ({...p, languages: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Primary Room</label>
                                    <input value={profileDraft.primaryRoom || ''} onChange={e => setProfileDraft(p => ({...p, primaryRoom: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Max Clients / Day</label>
                                    <input type="number" min="1" max="20" value={profileDraft.maxClients || ''} onChange={e => setProfileDraft(p => ({...p, maxClients: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button onClick={() => setProfileModal(false)} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">Cancel</button>
                            <button onClick={saveProfile} className="flex-1 px-5 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-md transition-colors">Save Profile</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Growth Modal */}
            {growthModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setGrowthModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{growthEdit ? 'Edit Certification' : 'Add Certification'}</h2>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Title</label>
                                <input value={growthDraft.title} onChange={e => setGrowthDraft(p => ({...p, title: e.target.value}))} placeholder="e.g. Advanced ASD Intervention Certification" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Date / Description</label>
                                <input value={growthDraft.subtitle} onChange={e => setGrowthDraft(p => ({...p, subtitle: e.target.value}))} placeholder="e.g. Completed: May 2023" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Icon</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['workspace_premium','event','school','star','emoji_events','science'].map(icon => (
                                        <button key={icon} type="button" onClick={() => setGrowthDraft(p => ({...p, icon}))} className={`p-3 rounded-xl border transition-all ${growthDraft.icon === icon ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/50'}`}>
                                            <span className="material-symbols-outlined text-[20px]">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button onClick={() => setGrowthModal(false)} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">Cancel</button>
                            <button onClick={saveGrowth} className="flex-1 px-5 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-md transition-colors">{growthEdit ? 'Update' : 'Add'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteModal !== null && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setDeleteModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mx-auto">
                            <span className="material-symbols-outlined text-3xl">delete</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">Remove Item?</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">This certification will be removed from your profile.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModal(null)} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">Cancel</button>
                            <button onClick={confirmDelete} className="flex-1 px-5 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-md transition-colors">Remove</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-400 text-[18px]">check_circle</span>
                    {toast}
                </div>
            )}
        </div>
    );
}

export default App;
