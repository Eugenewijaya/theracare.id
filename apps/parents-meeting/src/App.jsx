import React, { useEffect, useMemo, useState } from 'react';
import { childrenApi, meetingsApi, sessionsApi, therapistsApi } from '../../shared/api/client';
import { readTherapistUser } from '../../shared/sessionIdentity';

const MEETING_TYPES = ['In-person', 'Video Call', 'Phone Call'];
const OBJECTIVES = ['Monthly Review', 'Quarterly Evaluation', 'Incident Follow-up', 'Goal Setting'];
const STATUS_LABELS = {
    pending_admin_review: 'Menunggu review admin',
    approved_by_admin: 'Menunggu persetujuan orang tua',
    parent_confirmed: 'Disetujui orang tua',
    parent_declined: 'Ditolak orang tua',
    cancelled: 'Dibatalkan',
};

function statusClass(status) {
    if (status === 'parent_confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'approved_by_admin') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (status === 'cancelled' || status === 'parent_declined') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
}

function formatDate(date) {
    if (!date) return '-';
    return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function readStoredTherapist() {
    return readTherapistUser();
}

export default function App({ mode = 'therapist' }) {
    const isAdmin = mode === 'admin';
    const [meetings, setMeetings] = useState([]);
    const [children, setChildren] = useState([]);
    const [therapists, setTherapists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviewDraft, setReviewDraft] = useState({ parentContactConfirmed: false, communicationMethod: 'WhatsApp', reviewNote: '' });
    const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
    const [createDraft, setCreateDraft] = useState({ parentContactConfirmed: false, communicationMethod: 'WhatsApp', reviewNote: '' });
    const [form, setForm] = useState({
        childId: '',
        therapistId: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        type: 'In-person',
        objective: 'Monthly Review',
        notes: '',
    });

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const load = async () => {
        try {
            setLoading(true);
            if (isAdmin) {
                const [meetRes, childRes, therRes] = await Promise.all([
                    meetingsApi.getAll(),
                    childrenApi.getAll(),
                    therapistsApi.getAll(),
                ]);
                setMeetings(meetRes.data?.data || []);
                setChildren(childRes.data?.data || []);
                setTherapists(therRes.data?.data || []);
            } else {
                const therapist = readStoredTherapist();
                const [meetRes, sessionRes] = await Promise.all([
                    meetingsApi.getForTherapist(),
                    therapist?.id ? sessionsApi.getForTherapist(therapist.id) : Promise.resolve({ data: { data: [] } }),
                ]);
                const sessionChildren = [];
                (sessionRes.data?.data || []).forEach((session) => {
                    if (session.child && !sessionChildren.some((child) => child.id === session.child.id)) {
                        sessionChildren.push(session.child);
                    }
                });
                setMeetings(meetRes.data?.data || []);
                setChildren(sessionChildren);
                setForm((prev) => ({ ...prev, therapistId: therapist?.id || prev.therapistId }));
            }
        } catch (e) {
            console.error(e);
            showToast('Gagal memuat data parent meeting.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [isAdmin]);

    const visibleMeetings = useMemo(() => meetings, [meetings]);

    const createMeeting = async (extra = {}) => {
        const res = await meetingsApi.create({
            ...form,
            ...extra,
            parentContactConfirmed: isAdmin ? !!extra.parentContactConfirmed : false,
        });
        if (!res.ok) {
            showToast(res.data?.error || 'Gagal membuat parent meeting.');
            return false;
        }
        setForm((prev) => ({ ...prev, childId: '', notes: '' }));
        await load();
        showToast(isAdmin ? 'Meeting dibuat dan dikirim ke parent portal.' : 'Request meeting dikirim untuk review admin.');
        return true;
    };

    const handleSchedule = async () => {
        if (!form.childId || !form.date || !form.time) {
            showToast('Pilih anak, tanggal, dan jam meeting.');
            return;
        }
        if (isAdmin && !form.therapistId) {
            showToast('Admin perlu memilih terapis untuk parent meeting.');
            return;
        }
        if (isAdmin) {
            setCreateDraft({ parentContactConfirmed: false, communicationMethod: 'WhatsApp', reviewNote: '' });
            setCreateConfirmOpen(true);
            return;
        }
        await createMeeting();
    };

    const confirmAdminCreate = async () => {
        if (!createDraft.parentContactConfirmed) {
            showToast('Centang konfirmasi bahwa orang tua sudah dihubungi dan setuju.');
            return;
        }
        const ok = await createMeeting(createDraft);
        if (ok) setCreateConfirmOpen(false);
    };

    const approveMeeting = async () => {
        if (!reviewDraft.parentContactConfirmed) {
            showToast('Centang konfirmasi bahwa orang tua sudah dihubungi dan setuju.');
            return;
        }
        const res = await meetingsApi.adminReview(reviewTarget.id, {
            status: 'approved_by_admin',
            ...reviewDraft,
        });
        if (!res.ok) {
            showToast(res.data?.error || 'Gagal approve meeting.');
            return;
        }
        setReviewTarget(null);
        await load();
        showToast('Meeting disetujui admin dan dikirim ke parent portal.');
    };

    const rejectMeeting = async (meeting) => {
        const res = await meetingsApi.adminReview(meeting.id, {
            status: 'cancelled',
            reviewNote: 'Tidak disetujui admin.',
            parentContactConfirmed: true,
            communicationMethod: 'Internal',
        });
        if (!res.ok) {
            showToast(res.data?.error || 'Gagal membatalkan meeting.');
            return;
        }
        await load();
        showToast('Meeting dibatalkan.');
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm w-full overflow-hidden flex flex-col h-full border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Parent Meeting</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isAdmin ? 'Review request meeting dari terapis dan konfirmasi ke orang tua.' : 'Ajukan jadwal meeting orang tua untuk direview admin.'}
                    </p>
                </div>
                {isAdmin && <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black">{meetings.filter(m => m.status === 'pending_admin_review').length} pending</span>}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-0 flex-1 min-h-0">
                <section className="p-6 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Anak</label>
                            <select value={form.childId} onChange={e => setForm(p => ({ ...p, childId: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11">
                                <option value="">Pilih anak</option>
                                {children.map(child => (
                                    <option key={child.id} value={child.id}>{child.name} {child.parent?.user?.name ? `- ${child.parent.user.name}` : ''}</option>
                                ))}
                            </select>
                        </div>

                        {isAdmin && (
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Terapis</label>
                                <select value={form.therapistId} onChange={e => setForm(p => ({ ...p, therapistId: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11">
                                    <option value="">Pilih terapis</option>
                                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name || t.user?.name || t.id}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Tanggal</label>
                                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Jam</label>
                                <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Tipe</label>
                                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11">
                                    {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Tujuan</label>
                                <select value={form.objective} onChange={e => setForm(p => ({ ...p, objective: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11">
                                    {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Catatan</label>
                            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={4} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none" placeholder="Konteks meeting untuk admin/orang tua." />
                        </div>

                        <button onClick={handleSchedule} className="h-11 rounded-lg bg-primary text-slate-900 font-black hover:bg-primary/90 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">send</span>
                            {isAdmin ? 'Buat & Kirim ke Parent' : 'Submit ke Admin'}
                        </button>
                    </div>
                </section>

                <section className="p-6 overflow-y-auto">
                    {loading ? (
                        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
                    ) : visibleMeetings.length === 0 ? (
                        <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-slate-500 gap-3">
                            <span className="material-symbols-outlined text-4xl text-slate-300">groups</span>
                            <p className="font-bold">Belum ada parent meeting.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {visibleMeetings.map(meeting => (
                                <div key={meeting.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-900 dark:text-white">{meeting.childName}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{meeting.parentName} - {meeting.therapistName}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDate(meeting.date)} · {meeting.time} · {meeting.type}</p>
                                        </div>
                                        <span className={`shrink-0 border rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(meeting.status)}`}>{STATUS_LABELS[meeting.status] || meeting.status}</span>
                                    </div>
                                    <div className="mt-3 rounded-lg bg-white dark:bg-slate-900/60 p-3 text-sm text-slate-600 dark:text-slate-300">
                                        <p className="font-bold text-slate-800 dark:text-slate-100">{meeting.objective}</p>
                                        {meeting.notes && <p className="mt-1">{meeting.notes}</p>}
                                        {meeting.reviewNote && <p className="mt-1 text-xs text-slate-500">Catatan admin: {meeting.reviewNote}</p>}
                                    </div>
                                    {isAdmin && meeting.status === 'pending_admin_review' && (
                                        <div className="mt-3 flex flex-wrap gap-2 justify-end">
                                            <button onClick={() => rejectMeeting(meeting)} className="px-3 py-2 rounded-lg text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100">Tolak</button>
                                            <button onClick={() => { setReviewTarget(meeting); setReviewDraft({ parentContactConfirmed: false, communicationMethod: 'WhatsApp', reviewNote: '' }); }} className="px-3 py-2 rounded-lg text-sm font-bold text-slate-900 bg-primary hover:bg-primary/90">Approve</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {createConfirmOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setCreateConfirmOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <div className="size-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                                <span className="material-symbols-outlined">contact_phone</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Konfirmasi Sebelum Kirim ke Parent</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Admin hanya boleh membuat meeting langsung jika orang tua sudah diinformasikan dan menyetujui jadwal melalui tatap muka, WhatsApp, telepon, atau media komunikasi lain.</p>
                            </div>
                        </div>
                        <div className="mt-5 flex flex-col gap-4">
                            <label className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
                                <input type="checkbox" checked={createDraft.parentContactConfirmed} onChange={e => setCreateDraft(p => ({ ...p, parentContactConfirmed: e.target.checked }))} className="mt-1 rounded border-sky-400 text-sky-600 focus:ring-sky-500" />
                                Saya sudah memastikan orang tua menerima informasi jadwal ini dan menyetujuinya secara langsung atau melalui media komunikasi.
                            </label>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Media konfirmasi</label>
                                <select value={createDraft.communicationMethod} onChange={e => setCreateDraft(p => ({ ...p, communicationMethod: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11">
                                    <option>WhatsApp</option>
                                    <option>Telepon</option>
                                    <option>Tatap muka</option>
                                    <option>Email</option>
                                    <option>Lainnya</option>
                                </select>
                            </div>
                            <textarea value={createDraft.reviewNote} onChange={e => setCreateDraft(p => ({ ...p, reviewNote: e.target.value }))} rows={3} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none" placeholder="Catatan admin (opsional)" />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setCreateConfirmOpen(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                            <button onClick={confirmAdminCreate} className="px-5 py-2 rounded-lg font-black bg-primary text-slate-900 hover:bg-primary/90">Kirim ke Parent</button>
                        </div>
                    </div>
                </div>
            )}

            {reviewTarget && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setReviewTarget(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <span className="material-symbols-outlined">verified_user</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Konfirmasi Persetujuan Orang Tua</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Admin hanya boleh approve jika orang tua sudah diinformasikan dan menyetujui jadwal melalui tatap muka, WhatsApp, telepon, atau media komunikasi lain.</p>
                            </div>
                        </div>
                        <div className="mt-5 flex flex-col gap-4">
                            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                                <input type="checkbox" checked={reviewDraft.parentContactConfirmed} onChange={e => setReviewDraft(p => ({ ...p, parentContactConfirmed: e.target.checked }))} className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                                Saya sudah memastikan orang tua menerima informasi jadwal ini dan menyetujuinya secara langsung atau melalui media komunikasi.
                            </label>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">Media konfirmasi</label>
                                <select value={reviewDraft.communicationMethod} onChange={e => setReviewDraft(p => ({ ...p, communicationMethod: e.target.value }))} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11">
                                    <option>WhatsApp</option>
                                    <option>Telepon</option>
                                    <option>Tatap muka</option>
                                    <option>Email</option>
                                    <option>Lainnya</option>
                                </select>
                            </div>
                            <textarea value={reviewDraft.reviewNote} onChange={e => setReviewDraft(p => ({ ...p, reviewNote: e.target.value }))} rows={3} className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none" placeholder="Catatan admin (opsional)" />
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setReviewTarget(null)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                            <button onClick={approveMeeting} className="px-5 py-2 rounded-lg font-black bg-primary text-slate-900 hover:bg-primary/90">Approve & Kirim</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-6 right-6 z-[300] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl font-bold text-sm">{toast}</div>}
        </div>
    );
}
