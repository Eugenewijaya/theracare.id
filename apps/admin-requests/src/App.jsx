import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import RequestCard from './components/RequestCard';
import { meetingsApi, rescheduleApi } from '../../shared/api/client';

// ── Notification Popup Component ──────────────────────────────────
function NotificationPopup({ isOpen, message, type, onClose, onConfirm, showConfirmButtons }) {
    if (!isOpen) return null;
    const isSuccess = type === 'success';
    const isWarning = type === 'warning';
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-primary/20 rounded-xl shadow-xl w-full max-w-sm p-6">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`p-3 rounded-full ${
                        isSuccess ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                        isWarning ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                        <span className="material-symbols-outlined text-3xl">
                            {isSuccess ? 'check_circle' : isWarning ? 'warning' : 'info'}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isSuccess ? 'Success' : showConfirmButtons ? 'Confirmation' : 'Notification'}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {message}
                    </p>
                    {showConfirmButtons ? (
                        <div className="flex gap-3 w-full mt-2">
                            <button 
                                onClick={onClose}
                                className="flex-1 py-2.5 px-4 border border-slate-300 dark:border-primary/30 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-primary/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={onConfirm}
                                className="flex-1 py-2.5 px-4 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="mt-2 w-full py-2.5 px-4 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            OK
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Under Review card component ───────────────────────────────────
function ReviewCard({ name, parentName, session, date, reason, submittedAgo, reviewNote, reviewedBy, onReject, onApprove }) {
    return (
        <div className="bg-white dark:bg-primary/5 border border-blue-200 dark:border-blue-800/50 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">manage_search</span>
                            Under Review
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">{submittedAgo}</span>
                    </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    {name} <span className="text-slate-500 dark:text-slate-400 text-base font-normal">(Parent: {parentName})</span>
                </h3>

                <div className="bg-slate-50 dark:bg-background-dark/50 rounded-lg p-4 mb-4 border border-slate-100 dark:border-primary/10 mt-4">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">event</span>
                        Original Session
                    </h4>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">{session}</p>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">{date}</p>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-primary/20">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">info</span>
                            Reason for Change
                        </h4>
                        <p className="text-slate-700 dark:text-slate-300 text-sm italic">"{reason}"</p>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px] mt-0.5">pending_actions</span>
                        <div>
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Review Note</p>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">{reviewNote}</p>
                            <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">Reviewed by: {reviewedBy}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-background-dark/80 p-4 border-t border-slate-200 dark:border-primary/20 flex justify-end gap-3">
                <button
                    onClick={onReject}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                    Reject
                </button>
                <button
                    onClick={onApprove}
                    className="px-5 py-2 text-sm font-bold text-background-dark bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                    Approve
                </button>
            </div>
        </div>
    );
}

// ── Resolved History row component ────────────────────────────────
function ResolvedRow({ name, parentName, session, originalDate, newDate, resolvedBy, resolvedOn, outcome, onDelete }) {
    const outcomeConfig = {
        approved:       { label: 'Approved',       bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'check_circle' },
        rejected:       { label: 'Rejected',        bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',               icon: 'cancel'        },
         review:     { label: 'Under Review', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: 'swap_horiz'   },
         pending: { label: 'Pending', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: 'pending'   },
    };
    const cfg = outcomeConfig[outcome] || outcomeConfig.approved;

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/20 rounded-xl shadow-sm hover:border-slate-300 dark:hover:border-primary/40 transition-colors">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg}`}>
                        <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                        {cfg.label}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{resolvedOn}</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white truncate">{name} <span className="font-normal text-slate-500 text-sm">(Parent: {parentName})</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{session}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1 text-sm shrink-0">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 line-through text-xs">{originalDate}</div>
                {newDate !== '—' && <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs"><span className="material-symbols-outlined text-[14px]">arrow_forward</span>{newDate}</div>}
                <p className="text-xs text-slate-400 dark:text-slate-500">by {resolvedBy}</p>
                <button
                    type="button"
                    onClick={onDelete}
                    className="mt-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                >
                    Hapus riwayat
                </button>
            </div>
        </div>
    );
}

// ── Main App ──────────────────────────────────────────────────────
function App() {
    const [activeTab, setActiveTab] = useState('pending');
    const [allRequests, setAllRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [popup, setPopup] = useState({ isOpen: false, message: '', type: 'success', showConfirm: false });
    const [pendingAction, setPendingAction] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const refreshData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setRefreshing(true);
        try {
            const [rescheduleResult, meetingsResult] = await Promise.allSettled([
                rescheduleApi.getAll(),
                meetingsApi.getAll(),
            ]);
            const rescheduleRes = rescheduleResult.status === 'fulfilled' ? rescheduleResult.value : { data: { data: [] } };
            const meetingsRes = meetingsResult.status === 'fulfilled' ? meetingsResult.value : { data: { data: [] } };
            const raw = rescheduleRes.data?.data || [];
            const meetingRaw = meetingsRes.data?.data || [];

            const mapped = raw.map(r => {
                const child = r.child || {};
                const parent = r.parent || {};
                const session = r.session || {};
                
                return {
                    id: r.id,
                    kind: 'reschedule',
                    name: child.name || `${child.firstName || ''} ${child.lastName || ''}`.trim() || 'Unknown Child',
                    parentName: parent.name || parent.firstName || 'Unknown Parent',
                    session: session.focus || 'Therapy Session',
                    date: session.date ? `${session.date} • ${session.startTime}` : 'Date TBD',
                    reason: r.reason || r.details || 'No reason provided',
                    createdAt: r.createdAt || new Date().toISOString(),
                    submittedAgo: new Date(r.createdAt || Date.now()).toLocaleDateString(),
                    slots: (r.proposedSlots || []).map((s, idx) => ({
                        date: s.date,
                        time: s.time,
                        label: `${s.date || 'Tanggal TBD'} • ${s.time || 'Jam TBD'}`,
                        status: idx===0?'available':'conflict',
                    })),
                    status: r.status || 'pending',
                    reviewNote: r.reviewNote || '',
                    reviewedBy: 'Admin',
                    originalDate: session.date ? `${session.date} • ${session.startTime}` : 'TBD',
                    newDate: r.newDate ? `${r.newDate} • ${r.newStartTime || session.startTime}` : '—',
                    resolvedOn: r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : '',
                    outcome: r.status
                };
            });
            const mappedMeetings = meetingRaw.map(m => {
                const statusMap = {
                    pending_admin_review: 'pending',
                    approved_by_admin: 'approved',
                    parent_confirmed: 'approved',
                    parent_declined: 'rejected',
                    cancelled: 'rejected',
                };
                return {
                    id: m.id,
                    kind: 'meeting',
                    name: m.childName || m.child?.name || 'Unknown Child',
                    parentName: m.parentName || m.parent?.user?.name || 'Unknown Parent',
                    session: m.objective || 'Parent Meeting',
                    date: m.date ? `${m.date} • ${m.time || 'Jam TBD'}` : 'Date TBD',
                    reason: m.notes || m.reviewNote || 'Parent meeting request',
                    createdAt: m.createdAt || new Date().toISOString(),
                    submittedAgo: new Date(m.createdAt || Date.now()).toLocaleDateString(),
                    slots: [{
                        date: m.date,
                        time: m.time,
                        label: `${m.date || 'Tanggal TBD'} • ${m.time || 'Jam TBD'}`,
                        status: 'available',
                    }],
                    status: statusMap[m.status] || 'pending',
                    originalStatus: m.status,
                    reviewNote: m.reviewNote || 'Menunggu review admin.',
                    reviewedBy: m.reviewedBy || 'Admin',
                    originalDate: m.date ? `${m.date} • ${m.time || ''}` : 'TBD',
                    newDate: m.status === 'approved_by_admin' || m.status === 'parent_confirmed' ? `${m.date} • ${m.time || ''}` : '—',
                    resolvedOn: m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : '',
                    outcome: statusMap[m.status] || 'pending',
                };
            });
            setAllRequests([...mapped, ...mappedMeetings].sort((a, b) => new Date(b.createdAt || b.submittedAgo) - new Date(a.createdAt || a.submittedAgo)));
        } catch (e) {
            console.error('Failed to load incoming requests', e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        refreshData();
        const refreshSilently = () => refreshData({ silent: true });
        const interval = window.setInterval(refreshSilently, 30000);
        window.addEventListener('notificationsUpdated', refreshSilently);
        window.addEventListener('incomingRequestsUpdated', refreshSilently);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('notificationsUpdated', refreshSilently);
            window.removeEventListener('incomingRequestsUpdated', refreshSilently);
        };
    }, []);

    const filterByName = (arr) => arr.filter(req => !searchQuery || req.name.toLowerCase().includes(searchQuery.toLowerCase()) || req.parentName.toLowerCase().includes(searchQuery.toLowerCase()));

    const pending = filterByName(allRequests.filter(r => r.status === 'pending'));
    const review = filterByName(allRequests.filter(r => r.status === 'review'));
    const resolved = filterByName(allRequests.filter(r => r.status === 'approved' || r.status === 'rejected'));

    const showPopup = (message, type = 'success', showConfirm = false) => {
        setPopup({ isOpen: true, message, type, showConfirm });
    };

    const patchRequestStatus = (requestId, status) => {
        setAllRequests((prev) => prev.map((item) => (
            item.id === requestId
                ? {
                    ...item,
                    status,
                    outcome: status,
                    resolvedOn: new Date().toLocaleDateString(),
                }
                : item
        )));
    };

    const confirmAction = async () => {
        if (!pendingAction) return;
        const { type, req } = pendingAction;
        
        if (type === 'reject') {
            if (req.kind === 'meeting') {
                await meetingsApi.adminReview(req.id, {
                    status: 'cancelled',
                    reviewNote: 'Dibatalkan dari Permintaan Masuk.',
                });
            } else {
                await rescheduleApi.updateStatus(req.id, 'rejected');
            }
            patchRequestStatus(req.id, 'rejected');
            await refreshData({ silent: true });
            window.dispatchEvent(new Event('incomingRequestsUpdated'));
            setTimeout(() => showPopup(`Request from ${req.name} has been rejected.`, 'success'), 300);
        }
        else if (type === 'process') {
            if (req.kind === 'meeting') {
                showPopup('Parent meeting sudah berada dalam proses review admin. Gunakan Approve jika orang tua sudah dikonfirmasi.', 'info');
                setPendingAction(null);
                return;
            }
            await rescheduleApi.updateStatus(req.id, 'review', { reviewNote: 'Under internal review.' });
            patchRequestStatus(req.id, 'review');
            await refreshData({ silent: true });
            window.dispatchEvent(new Event('incomingRequestsUpdated'));
            setTimeout(() => {
                showPopup(`Request from ${req.name} moved to Under Review.`);
                setActiveTab('review');
            }, 300);
        }
        else if (type === 'approve') {
            const chosenSlot = req.slots ? req.slots.find(s => s.status === 'available') || req.slots[0] : null;
            if (req.kind === 'meeting') {
                await meetingsApi.adminReview(req.id, {
                    status: 'approved_by_admin',
                    parentContactConfirmed: true,
                    communicationMethod: 'Admin confirmation',
                    reviewNote: 'Admin sudah menghubungi orang tua dan mendapatkan persetujuan.',
                });
            } else {
                await rescheduleApi.updateStatus(req.id, 'approved', {
                    newDate: chosenSlot?.date,
                    newStartTime: chosenSlot?.time,
                });
            }
            patchRequestStatus(req.id, 'approved');
            await refreshData({ silent: true });
            window.dispatchEvent(new Event('incomingRequestsUpdated'));
            setActiveTab('resolved');
            setTimeout(() => showPopup(`Request from ${req.name} has been approved.`, 'success'), 300);
        }
        
        setPendingAction(null);
        setPopup(prev => ({ ...prev, showConfirm: false, isOpen: false }));
    };

    const handleReject = (req) => {
        setPendingAction({ type: 'reject', req });
        showPopup(`Are you sure you want to reject the request from ${req.name}?`, 'warning', true);
    };

    const handleProcess = (req) => {
        setPendingAction({ type: 'process', req });
        showPopup(`Do you want to move the request from ${req.name} to "Under Review"?`, 'info', true);
    };

    const handleApprove = (req) => {
        setPendingAction({ type: 'approve', req });
        const message = req.kind === 'meeting'
            ? `Approve parent meeting untuk ${req.name}? Pastikan orang tua sudah dihubungi dan menyetujui jadwal melalui tatap muka, WhatsApp, telepon, atau media komunikasi lain.`
            : `Confirm approval for ${req.name}'s request?`;
        showPopup(message, 'info', true);
    };

    const handleDelete = async (req) => {
        if (!window.confirm(`Hapus riwayat request ${req.name}?`)) return;
        if (req.kind === 'meeting') await meetingsApi.delete(req.id);
        else await rescheduleApi.delete(req.id);
        await refreshData({ silent: true });
        window.dispatchEvent(new Event('incomingRequestsUpdated'));
        showPopup('Riwayat request berhasil dihapus.', 'success');
    };

    return (
        <>
            <Header searchValue={searchQuery} onSearchChange={setSearchQuery} />
            <NotificationPopup 
                isOpen={popup.isOpen} 
                message={popup.message} 
                type={popup.type} 
                showConfirmButtons={popup.showConfirm}
                onClose={() => {
                    setPopup({ ...popup, isOpen: false });
                    setPendingAction(null);
                }} 
                onConfirm={confirmAction}
            />
            <main className="px-6 md:px-10 flex flex-1 justify-center py-8 bg-background-light dark:bg-background-dark">
                <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 w-full">

                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between gap-3 mb-6">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">Request Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Manage and respond to schedule change requests from parents</p>
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={() => refreshData({ silent: true })}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-primary/20 transition-colors text-sm font-medium disabled:cursor-wait disabled:opacity-60"
                            >
                                <span className={`material-symbols-outlined text-sm ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="pb-0 mb-6 border-b border-slate-200 dark:border-primary/20 overflow-x-auto hide-scrollbar">
                        <div className="flex gap-4 sm:gap-8 min-w-max px-1">
                            {[
                                { key: 'pending', label: 'Pending', count: pending.length },
                                { key: 'review', label: 'Under Review', count: review.length },
                                { key: 'resolved', label: 'Resolved History', count: resolved.length },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-[3px] transition-all ${
                                        activeTab === tab.key
                                            ? 'border-b-primary text-primary'
                                            : 'border-b-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {tab.label}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                        activeTab === tab.key
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">Loading...</div>
                    ) : (
                        <>
                            {/* ── Pending Tab ── */}
                            {activeTab === 'pending' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {pending.length === 0 ? (
                                        <div className="col-span-2 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                                            <span className="material-symbols-outlined text-5xl">inventory_2</span>
                                            <p className="text-lg font-semibold">{searchQuery ? 'No matching pending requests' : 'No pending requests'}</p>
                                        </div>
                                    ) : pending.map((req, i) => (
                                        <RequestCard 
                                            key={i} 
                                            {...req} 
                                            onReject={() => handleReject(req)}
                                            onProcess={() => handleProcess(req)}
                                            onApprove={() => handleApprove(req)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* ── Under Review Tab ── */}
                            {activeTab === 'review' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {review.length === 0 ? (
                                        <div className="col-span-2 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                                            <span className="material-symbols-outlined text-5xl">manage_search</span>
                                            <p className="text-lg font-semibold">{searchQuery ? 'No matching requests under review' : 'No requests under review'}</p>
                                        </div>
                                    ) : review.map((req, i) => (
                                        <ReviewCard 
                                            key={i} 
                                            {...req} 
                                            onReject={() => handleReject(req)}
                                            onApprove={() => handleApprove(req)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* ── Resolved History Tab ── */}
                            {activeTab === 'resolved' && (
                                <div className="flex flex-col gap-4">
                                    {/* Summary bar */}
                                    <div className="flex gap-4 flex-wrap mb-2">
                                        {[
                                            { label: 'Approved',       count: resolved.filter(r => r.outcome === 'approved').length,        color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                                            { label: 'Rejected',        count: resolved.filter(r => r.outcome === 'rejected').length,         color: 'text-red-600 bg-red-50 border-red-100' },
                                        ].map(s => (
                                            <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${s.color}`}>
                                                {s.label}: <span className="font-bold">{s.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {resolved.map((r, i) => (
                                        <ResolvedRow key={i} {...r} onDelete={() => handleDelete(r)} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                </div>
            </main>
        </>
    );
}

export default App;
