import React, { useEffect, useMemo, useState } from 'react';
import { leaveRequestsApi } from '../../../shared/api/client';
import { confirmAction } from '../../../shared/ui/confirmDialog';
import {
  ADMIN_GATE_PASSWORD,
  LEAVE_REQUESTS_UNLOCK_KEY,
  clearSessionUnlockState,
  getSessionUnlockState,
  markSessionUnlocked,
} from '../config/accessGate';

const TYPE_LABELS = {
  cuti: 'Cuti',
  sakit: 'Sakit',
  unpaid_leave: 'Unpaid Leave',
};

const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TherapistLeaveRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});
  const [statusEditOpen, setStatusEditOpen] = useState({});
  const [toast, setToast] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(() => getSessionUnlockState(LEAVE_REQUESTS_UNLOCK_KEY));
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState('');

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await leaveRequestsApi.getAll();
      setRequests(res.data?.data || []);
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Gagal memuat pengajuan cuti.' });
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isUnlocked) return;
    load();
    const refreshSilently = () => load({ silent: true });
    const interval = window.setInterval(refreshSilently, 30000);
    window.addEventListener('notificationsUpdated', refreshSilently);
    window.addEventListener('leaveRequestsUpdated', refreshSilently);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('notificationsUpdated', refreshSilently);
      window.removeEventListener('leaveRequestsUpdated', refreshSilently);
    };
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return undefined;
    const lockIfExpired = () => {
      if (getSessionUnlockState(LEAVE_REQUESTS_UNLOCK_KEY)) return;
      clearSessionUnlockState(LEAVE_REQUESTS_UNLOCK_KEY);
      setIsUnlocked(false);
      setGatePassword('');
      setGateError('Sesi super admin sudah habis. Masukkan password lagi.');
    };
    const interval = window.setInterval(lockIfExpired, 5000);
    window.addEventListener('focus', lockIfExpired);
    document.addEventListener('visibilitychange', lockIfExpired);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', lockIfExpired);
      document.removeEventListener('visibilitychange', lockIfExpired);
    };
  }, [isUnlocked]);

  const handleUnlock = (event) => {
    event.preventDefault();
    if (gatePassword !== ADMIN_GATE_PASSWORD) {
      setGateError('Password super admin salah.');
      return;
    }

    markSessionUnlocked(LEAVE_REQUESTS_UNLOCK_KEY);
    setIsUnlocked(true);
    setGatePassword('');
    setGateError('');
    setToast({ type: 'success', message: 'Akses Pengajuan Cuti dibuka.' });
  };

  const stats = useMemo(() => ({
    pending: requests.filter((item) => item.status === 'pending').length,
    approved: requests.filter((item) => item.status === 'approved').length,
    rejected: requests.filter((item) => item.status === 'rejected').length,
  }), [requests]);

  const updateStatus = async (request, status) => {
    if (status === 'approved') {
      const confirmed = await confirmAction({
        tone: 'warning',
        title: 'Setujui pengajuan cuti?',
        message: 'Jika ada anak yang tetap hadir, lanjutkan atur terapis pengganti melalui Penjadwalan Tunggal.',
        confirmText: 'Setujui',
        cancelText: 'Batal',
      });
      if (!confirmed) return;
    }
    if (request.status === 'approved' && status === 'pending') {
      const confirmed = await confirmAction({
        tone: 'info',
        title: 'Kembalikan ke pending?',
        message: 'Gunakan ini jika terapis batal cuti atau perlu direview ulang.',
        confirmText: 'Kembalikan',
        cancelText: 'Batal',
      });
      if (!confirmed) return;
    }
    if (request.status === 'approved' && status === 'rejected') {
      const confirmed = await confirmAction({
        tone: 'danger',
        title: 'Tolak pengajuan ini?',
        message: 'Pastikan terapis terkait sudah dihubungi sebelum status diubah.',
        confirmText: 'Tolak',
        cancelText: 'Batal',
      });
      if (!confirmed) return;
    }
    const res = await leaveRequestsApi.updateStatus(request.id, status, reviewNotes[request.id] || '');
    if (!res.ok) {
      setToast({ type: 'error', message: res.data?.error || 'Gagal memperbarui pengajuan.' });
      return;
    }
    setRequests((prev) => prev.map((item) => (item.id === request.id ? { ...item, status, reviewNote: reviewNotes[request.id] || item.reviewNote } : item)));
    setStatusEditOpen((prev) => ({ ...prev, [request.id]: false }));
    setToast({ type: 'success', message: `Pengajuan ${request.therapistName} diperbarui.` });
    await load({ silent: true });
    window.dispatchEvent(new Event('notificationsUpdated'));
    window.dispatchEvent(new Event('leaveRequestsUpdated'));
  };

  return (
    <div className="flex flex-1 flex-col bg-background-light dark:bg-background-dark">
      {toast && (
        <div className="fixed bottom-5 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-[360px]">
          <div className={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      {!isUnlocked && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUnlock}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-primary/20 dark:bg-slate-900"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[26px]">lock</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Pengajuan Cuti Terkunci</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Masukkan password super admin untuk membuka halaman ini.
                  Akses otomatis terkunci lagi setelah 5 menit.
                </p>
              </div>
            </div>

            <label htmlFor="leave-requests-gate-password" className="mb-2 mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Password Super Admin
            </label>
            <div className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-primary/40 dark:border-primary/20 dark:bg-slate-950">
              <span className="material-symbols-outlined text-[20px] text-slate-400">key</span>
              <input
                id="leave-requests-gate-password"
                type="password"
                autoFocus
                value={gatePassword}
                onChange={(event) => {
                  setGatePassword(event.target.value);
                  if (gateError) setGateError('');
                }}
                autoComplete="off"
                className="flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                placeholder="Masukkan password"
              />
            </div>
            {gateError && (
              <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{gateError}</p>
            )}

            <button
              type="submit"
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark"
            >
              <span className="material-symbols-outlined text-[20px]">lock_open</span>
              Buka Halaman
            </button>
          </form>
        </div>
      )}

      <main className="flex flex-1 justify-center px-4 py-6 md:px-10 md:py-8">
        <div className="flex w-full max-w-[1200px] flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-black leading-tight text-slate-900 dark:text-white sm:text-3xl">Pengajuan Cuti Terapis</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review pengajuan cuti, sakit, dan unpaid leave dari terapis.</p>
            </div>
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-primary/20 dark:bg-primary/10 dark:text-slate-200"
            >
              <span className={`material-symbols-outlined text-[20px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <p className="text-xs font-bold uppercase">Pending</p>
              <p className="mt-1 text-2xl font-black">{stats.pending}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <p className="text-xs font-bold uppercase">Approved</p>
              <p className="mt-1 text-2xl font-black">{stats.approved}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="text-xs font-bold uppercase">Rejected</p>
              <p className="mt-1 text-2xl font-black">{stats.rejected}</p>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-primary/20 dark:bg-primary/5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500 dark:border-primary/20 dark:bg-background-dark/50">
                    <th className="px-5 py-4">Terapis</th>
                    <th className="px-5 py-4">Jenis</th>
                    <th className="px-5 py-4">Tanggal</th>
                    <th className="px-5 py-4">Alasan</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-primary/10">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-sm font-semibold text-slate-500">Memuat pengajuan...</td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-sm font-semibold text-slate-500">Belum ada pengajuan cuti.</td>
                    </tr>
                  ) : requests.map((request) => (
                    <tr key={request.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-primary/5">
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{request.therapistName}</p>
                        <p className="text-xs font-semibold text-slate-400">{request.therapistNit || request.therapistId}</p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{TYPE_LABELS[request.type] || request.type}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{formatDate(request.startDate)} - {formatDate(request.endDate)}</td>
                      <td className="max-w-[260px] px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{request.reason || '-'}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${STATUS_STYLE[request.status] || STATUS_STYLE.pending}`}>
                          {request.status}
                        </span>
                        {request.reviewNote && <p className="mt-2 text-xs text-slate-500">Catatan: {request.reviewNote}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="ml-auto flex w-[260px] flex-col gap-2">
                          <textarea
                            value={reviewNotes[request.id] || ''}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                            rows={2}
                            placeholder="Catatan admin"
                            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-primary/20 dark:bg-background-dark"
                          />
                          {request.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => updateStatus(request, 'rejected')}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                              >
                                Tolak
                              </button>
                              <button
                                onClick={() => updateStatus(request, 'approved')}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                              >
                                Setujui
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-2">
                              {!statusEditOpen[request.id] ? (
                                <button
                                  type="button"
                                  onClick={() => setStatusEditOpen((prev) => ({ ...prev, [request.id]: true }))}
                                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200 dark:bg-primary/10 dark:text-slate-200"
                                >
                                  Ubah
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(request, 'pending')}
                                    className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100"
                                  >
                                    Jadikan Pending
                                  </button>
                                  {request.status === 'approved' ? (
                                    <button
                                      type="button"
                                      onClick={() => updateStatus(request, 'rejected')}
                                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                                    >
                                      Batal Cuti
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => updateStatus(request, 'approved')}
                                      className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                    >
                                      Setujui
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
