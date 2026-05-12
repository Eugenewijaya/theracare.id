import React, { useEffect, useMemo, useState } from 'react';
import { leaveRequestsApi } from '../../../shared/api/client';

const TYPES = [
  { value: 'cuti', label: 'Cuti' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'unpaid_leave', label: 'Unpaid Leave' },
];

const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getTypeLabel(value) {
  return TYPES.find((item) => item.value === value)?.label || value;
}

export default function LeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    type: 'cuti',
    startDate: todayKey(),
    endDate: todayKey(),
    reason: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await leaveRequestsApi.getMine();
      setRequests(res.data?.data || []);
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Gagal memuat pengajuan.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => ({
    pending: requests.filter((item) => item.status === 'pending').length,
    approved: requests.filter((item) => item.status === 'approved').length,
    rejected: requests.filter((item) => item.status === 'rejected').length,
  }), [requests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.endDate < form.startDate) {
      setToast({ type: 'error', message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
      return;
    }

    setSaving(true);
    try {
      const res = await leaveRequestsApi.create(form);
      if (!res.ok) {
        setToast({ type: 'error', message: res.data?.error || 'Pengajuan gagal dikirim.' });
        return;
      }
      setForm({ type: 'cuti', startDate: todayKey(), endDate: todayKey(), reason: '' });
      setToast({ type: 'success', message: 'Pengajuan berhasil dikirim ke admin.' });
      await load();
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Pengajuan gagal dikirim.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
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

      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-800 sm:px-8 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
            <span className="material-symbols-outlined">event_busy</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-2xl">Pengajuan Cuti / Sakit</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ajukan cuti, sakit, atau unpaid leave untuk direview admin.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Buat Pengajuan</h2>
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Jenis</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Mulai</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value, endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Selesai</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Catatan</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={4}
                  placeholder="Contoh: izin keluarga / sakit dan perlu istirahat."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </form>
          </section>

          <section className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                <p className="text-xs font-bold uppercase">Pending</p>
                <p className="mt-1 text-2xl font-black">{stats.pending}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                <p className="text-xs font-bold uppercase">Approved</p>
                <p className="mt-1 text-2xl font-black">{stats.approved}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                <p className="text-xs font-bold uppercase">Rejected</p>
                <p className="mt-1 text-2xl font-black">{stats.rejected}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Riwayat Pengajuan</h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                  <div className="p-8 text-center text-sm font-semibold text-slate-500">Memuat pengajuan...</div>
                ) : requests.length === 0 ? (
                  <div className="p-8 text-center text-sm font-semibold text-slate-500">Belum ada pengajuan cuti.</div>
                ) : requests.map((request) => (
                  <article key={request.id} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">{getTypeLabel(request.type)}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${STATUS_STYLE[request.status] || STATUS_STYLE.pending}`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        </p>
                        {request.reason && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{request.reason}</p>}
                        {request.reviewNote && (
                          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                            Catatan admin: {request.reviewNote}
                          </p>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-400">{formatDate(request.createdAt?.slice(0, 10))}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
