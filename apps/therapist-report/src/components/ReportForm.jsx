import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { childrenApi, getRoleHistoryFilters, reportsApi, sessionsApi } from '../../../shared/api/client';
import { readTherapistUser } from '../../../shared/sessionIdentity';
import { uploadImageFile } from '../../../shared/uploadImage';

const ASPECT_OPTIONS = [
    { key: 'fineMotor', label: 'Fine Motor Skills' },
    { key: 'grossMotor', label: 'Gross Motor Skills' },
    { key: 'speech', label: 'Speech' },
    { key: 'cognitive', label: 'Cognitive' },
    { key: 'social', label: 'Social Emotional' },
    { key: 'selfCare', label: 'Self-Care' },
];

const FIELD_FORMATS = {
    bold: '**teks penting**',
    italic: '_catatan miring_',
    underline: '<u>catatan digarisbawahi</u>',
    bullet: '- poin observasi',
    numbered: '1. poin observasi',
};

const formatSessionLabel = (session) => {
    if (!session) return 'Pilih sesi terapi...';
    const date = session.date ? new Date(`${session.date}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }) : 'Tanggal belum ada';
    return `${date} - ${session.startTime || 'Jam TBD'} - ${session.focus || 'Therapy Session'}`;
};

const getApiError = (res, fallback) => res?.data?.error || res?.data?.message || fallback;

const ReportForm = () => {
    const navigate = useNavigate();
    const currentUser = readTherapistUser();
    const [submitted, setSubmitted] = useState(false);
    const [savedReportId, setSavedReportId] = useState('');
    const [selectedChild, setSelectedChild] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [children, setChildren] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [activeField, setActiveField] = useState('description');
    const [description, setDescription] = useState('');
    const [childResponse, setChildResponse] = useState('');
    const [obstacles, setObstacles] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [mediaAttachments, setMediaAttachments] = useState([]);
    const [aspects, setAspects] = useState({
        fineMotor: true,
        grossMotor: false,
        speech: false,
        cognitive: false,
        social: true,
        selfCare: false,
    });
    const [rating, setRating] = useState(4);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                let therapistSessions = [];
                if (currentUser?.id) {
                    const sessionRes = await sessionsApi.getForTherapist(currentUser.id, getRoleHistoryFilters({ futureMonths: 0 }));
                    if (!sessionRes.ok) throw new Error(getApiError(sessionRes, 'Jadwal terapis belum bisa dimuat.'));
                    therapistSessions = sessionRes.data?.data || [];
                    setSessions(therapistSessions);
                }

                const childMap = new Map();
                therapistSessions.forEach((session) => {
                    if (session.child?.id) childMap.set(session.child.id, session.child);
                });

                if (childMap.size > 0) {
                    setChildren(Array.from(childMap.values()));
                    return;
                }

                const childRes = await childrenApi.getAll();
                if (!childRes.ok) throw new Error(getApiError(childRes, 'Daftar anak belum bisa dimuat.'));
                setChildren(childRes.data?.data || []);
            } catch (e) {
                console.error(e);
                setError(e?.message || 'Data laporan belum bisa dimuat.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [currentUser?.id]);

    const childSessions = useMemo(() => (
        sessions
            .filter((session) => session.childId === selectedChild)
            .sort((a, b) => `${b.date || ''} ${b.startTime || ''}`.localeCompare(`${a.date || ''} ${a.startTime || ''}`))
    ), [sessions, selectedChild]);

    const selectedSession = childSessions.find((session) => session.id === selectedSessionId);
    const selectedChildRecord = children.find((child) => child.id === selectedChild);

    const toggleAspect = (key) => setAspects((prev) => ({ ...prev, [key]: !prev[key] }));

    const updateTextField = (field, updater) => {
        const update = (value) => (typeof updater === 'function' ? updater(value) : updater);
        const setters = {
            description: setDescription,
            childResponse: setChildResponse,
            obstacles: setObstacles,
            recommendations: setRecommendations,
            internalNotes: setInternalNotes,
        };
        setters[field]?.((current) => update(current));
    };

    const applyFormat = (format) => {
        const snippet = FIELD_FORMATS[format];
        if (!snippet) return;
        updateTextField(activeField, (value) => `${value}${value.trim() ? '\n' : ''}${snippet}`);
    };

    const handleMediaUpload = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        setUploading(true);
        setError('');
        try {
            const uploaded = [];
            for (const file of files) {
                const url = await uploadImageFile(file, 'report-media');
                uploaded.push({ name: file.name, url });
            }
            setMediaAttachments((prev) => [...prev, ...uploaded]);
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Media laporan belum bisa diunggah.');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedChild) {
            setError('Pilih anak sebelum mengirim laporan.');
            return;
        }
        if (!selectedSessionId) {
            setError('Pilih sesi terapi yang akan dilaporkan. Laporan harian membutuhkan sessionId backend.');
            return;
        }
        if (!description.trim() || !childResponse.trim()) {
            setError('Isi aktivitas dan respons anak sebelum mengirim laporan.');
            return;
        }

        const therapistId = currentUser?.id || selectedSession?.therapistId || '';
        if (!therapistId) {
            setError('Identitas terapis belum tersedia. Login ulang sebelum membuat laporan.');
            return;
        }

        setSaving(true);
        setError('');
        const selectedAspects = ASPECT_OPTIONS.filter((option) => aspects[option.key]).map((option) => option.label);
        const report = {
            type: 'harian',
            status: 'ready_for_parent',
            childId: selectedChild,
            childName: selectedChildRecord?.name || '',
            therapistId,
            therapistName: currentUser?.name || '',
            sessionId: selectedSessionId,
            sessionFocus: selectedSession?.focus || selectedChildRecord?.program || 'Therapy Session',
            sessionType: 'Sesi harian',
            date: selectedSession?.date || new Date().toISOString().split('T')[0],
            aspects: selectedAspects,
            evaluations: { mediaAttachments },
            sessionScore: rating,
            description: description.trim(),
            childResponse: childResponse.trim(),
            obstacles: obstacles.trim(),
            recommendations: recommendations.trim(),
            internalNotes: internalNotes.trim(),
        };

        try {
            const res = await reportsApi.save(report);
            if (!res.ok) {
                setError(getApiError(res, 'Laporan belum bisa disimpan.'));
                return;
            }
            const reportId = res.data?.data?.id || '';
            setSavedReportId(reportId);
            window.dispatchEvent(new CustomEvent('reportUpdated', { detail: { id: reportId, type: 'harian' } }));
            window.dispatchEvent(new Event('notificationsUpdated'));
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Laporan belum bisa disimpan. Coba ulang beberapa saat lagi.');
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 ring-8 ring-green-50 dark:ring-green-900/10">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Report Submitted</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Laporan sesi tersimpan di backend{savedReportId ? ` dengan ID ${savedReportId}` : ''}.
                </p>
                <button type="button" onClick={() => navigate('/')} className="mt-4 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
            {error && (
                <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-sm font-bold animate-in fade-in">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                </div>
            )}

            {loading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                    Memuat anak dan sesi terapis...
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Patient Context</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">person_search</span>
                        <select
                            value={selectedChild}
                            onChange={(e) => {
                                setSelectedChild(e.target.value);
                                setSelectedSessionId('');
                            }}
                            className={`w-full appearance-none pl-12 pr-10 py-3.5 rounded-xl border bg-white dark:bg-slate-900 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 ${!selectedChild ? 'text-slate-400 border-slate-200 dark:border-slate-800' : 'text-slate-900 dark:text-white border-teal-200 dark:border-teal-800'}`}
                        >
                            <option value="" disabled>Select child assigned to your session...</option>
                            {children.map((child) => (
                                <option key={child.id} value={child.id}>{child.name} ({child.program || 'Therapy Session'})</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Linked Session</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">event_note</span>
                        <select
                            value={selectedSessionId}
                            onChange={(e) => setSelectedSessionId(e.target.value)}
                            disabled={!selectedChild || childSessions.length === 0}
                            className={`w-full appearance-none pl-12 pr-10 py-3.5 rounded-xl border bg-white dark:bg-slate-900 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 disabled:cursor-not-allowed disabled:opacity-60 ${!selectedSessionId ? 'text-slate-400 border-slate-200 dark:border-slate-800' : 'text-slate-900 dark:text-white border-teal-200 dark:border-teal-800'}`}
                        >
                            <option value="" disabled>{selectedChild ? 'Pilih sesi terapi...' : 'Pilih anak dulu...'}</option>
                            {childSessions.map((session) => (
                                <option key={session.id} value={session.id}>{formatSessionLabel(session)}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
                    </div>
                    {selectedChild && childSessions.length === 0 && (
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Belum ada sesi backend untuk anak ini, jadi laporan harian belum bisa dibuat dari form ini.</p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Therapy Aspects</label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Select multiple</span>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {ASPECT_OPTIONS.map((option) => (
                        <label key={option.key} className="cursor-pointer group">
                            <input type="checkbox" className="peer sr-only" checked={aspects[option.key]} onChange={() => toggleAspect(option.key)} />
                            <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                                <span className="text-sm font-medium">{option.label}</span>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Activity Description</label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/50 focus-within:border-teal-500 transition-all">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center gap-1">
                        {[
                            ['bold', 'format_bold'],
                            ['italic', 'format_italic'],
                            ['underline', 'format_underlined'],
                            ['bullet', 'format_list_bulleted'],
                            ['numbered', 'format_list_numbered'],
                        ].map(([format, icon], index) => (
                            <React.Fragment key={format}>
                                {index === 3 && <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />}
                                <button
                                    type="button"
                                    onClick={() => applyFormat(format)}
                                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                                    title={`Insert ${format} template`}
                                >
                                    <span className="material-symbols-outlined text-lg">{icon}</span>
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={() => setActiveField('description')}
                        className="w-full bg-transparent border-none p-4 min-h-[120px] resize-y text-slate-900 dark:text-slate-100 focus:ring-0 placeholder:text-slate-400"
                        placeholder="Describe the activities performed during the session..."
                    />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex flex-col gap-3">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Child's Response</label>
                    <textarea value={childResponse} onChange={(e) => setChildResponse(e.target.value)} onFocus={() => setActiveField('childResponse')} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-400" placeholder="How did the child react to the activities?" />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Obstacles</label>
                    <textarea value={obstacles} onChange={(e) => setObstacles(e.target.value)} onFocus={() => setActiveField('obstacles')} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-400" placeholder="Note any challenges or difficulties encountered..." />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Achievement Rating</label>
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((starIndex) => (
                        <button key={starIndex} type="button" onClick={() => setRating(starIndex)} className={starIndex <= rating ? 'text-teal-500 hover:scale-110 transition-transform' : 'text-slate-300 dark:text-slate-600 hover:scale-110 transition-transform hover:text-teal-500/50'}>
                            <span className="material-symbols-outlined text-3xl" style={starIndex <= rating ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                        </button>
                    ))}
                    <span className="ml-3 text-sm font-medium text-slate-600 dark:text-slate-400">{rating} / 5</span>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Recommendations for Parents</label>
                <textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} onFocus={() => setActiveField('recommendations')} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-400" placeholder="Suggested activities or practices for home..." />
            </div>

            <div className="flex flex-col gap-3 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-500">lock</span>
                    <label className="text-lg font-bold leading-tight tracking-tight text-amber-900 dark:text-amber-500">Internal Notes <span className="text-sm font-normal ml-2 opacity-75">(Clinic use only)</span></label>
                </div>
                <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} onFocus={() => setActiveField('internalNotes')} className="w-full bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 min-h-[80px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-400" placeholder="Confidential observations or notes for the clinical team..." />
            </div>

            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Media Upload</label>
                <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" multiple className="sr-only" onChange={handleMediaUpload} disabled={uploading} />
                    <div className="bg-teal-500/10 text-teal-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-3xl">{uploading ? 'sync' : 'cloud_upload'}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{uploading ? 'Uploading media...' : 'Click to upload report images'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG, WebP, SVG, or GIF up to 10MB source size.</p>
                </label>
                {mediaAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {mediaAttachments.map((item) => (
                            <a key={`${item.name}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100">
                                {item.name}
                            </a>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                    type="submit"
                    disabled={saving || uploading}
                    className="px-8 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all hover:-translate-y-0.5 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                    <span className="material-symbols-outlined text-[18px]">{saving ? 'sync' : 'send'}</span>
                    {saving ? 'Saving...' : 'Submit Report'}
                </button>
            </div>
        </form>
    );
};

export default ReportForm;
