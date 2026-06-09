import React, { useEffect, useMemo, useState } from 'react';
import { childLeaveApi, childrenApi } from '../../../shared/api/client';
import { confirmAction } from '../../../shared/ui/confirmDialog';

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Telepon' },
  { value: 'in_person', label: 'Tatap muka' },
  { value: 'other', label: 'Media lainnya' },
];

const STATUS_LABELS = {
  draft: 'Draft - menunggu konfirmasi',
  confirmed: 'Cuti aktif',
  revised: 'Cuti diperbarui',
  cancelled: 'Cuti dibatalkan',
};

const STATUS_STYLES = {
  draft: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  revised: 'bg-violet-100 text-violet-800',
  cancelled: 'bg-slate-200 text-slate-700',
};

const IMPACT_LABELS = {
  planned: 'Menunggu konfirmasi',
  moved: 'Sudah dipindahkan',
  move_failed: 'Pemindahan gagal',
  restored: 'Jadwal asal dipulihkan',
  restore_failed: 'Tetap di sesi pengganti',
  kept_replacement: 'Sesi pengganti dipertahankan',
  not_applicable: 'Tidak perlu dipindahkan',
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function actionDefaults(request) {
  return {
    communicationChannel: request.communicationChannel || 'whatsapp',
    communicationNote: '',
    startDate: request.startDate,
    endDate: request.endDate,
    strategy: 'restore_original',
  };
}

function resultData(response) {
  return response?.data?.data;
}

export default function ChildLeavePage() {
  const [requests, setRequests] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [toast, setToast] = useState(null);
  const [actions, setActions] = useState({});
  const [form, setForm] = useState({
    childId: '',
    therapyPeriodId: '',
    startDate: todayKey(),
    endDate: todayKey(),
    reason: '',
  });

  const selectedChild = useMemo(
    () => children.find((child) => child.id === form.childId) || null,
    [children, form.childId],
  );
  const selectablePeriods = useMemo(
    () => (selectedChild?.periods || []).filter((period) => ['active', 'planned'].includes(String(period.status || '').toLowerCase())),
    [selectedChild],
  );

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [requestRes, childRes] = await Promise.all([childLeaveApi.getAll(), childrenApi.getAll()]);
      const nextRequests = resultData(requestRes) || [];
      const nextChildren = resultData(childRes) || [];
      setRequests(nextRequests);
      setChildren(nextChildren);
      setActions((current) => Object.fromEntries(nextRequests.map((request) => [
        request.id,
        {
          ...actionDefaults(request),
          ...(current[request.id] || {}),
          startDate: request.startDate,
          endDate: request.endDate,
        },
      ])));
      setForm((current) => {
        const childId = current.childId || nextChildren[0]?.id || '';
        const child = nextChildren.find((item) => item.id === childId);
        const periods = (child?.periods || []).filter((period) => ['active', 'planned'].includes(String(period.status || '').toLowerCase()));
        return {
          ...current,
          childId,
          therapyPeriodId: periods.some((period) => period.id === current.therapyPeriodId)
            ? current.therapyPeriodId
            : periods[0]?.id || '',
        };
      });
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', message: 'Gagal memuat data cuti anak.' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const refresh = () => load({ silent: true });
    window.addEventListener('childLeaveUpdated', refresh);
    return () => window.removeEventListener('childLeaveUpdated', refresh);
  }, []);

  const setAction = (id, field, value) => {
    setActions((current) => ({
      ...current,
      [id]: { ...actionDefaults(requests.find((request) => request.id === id) || {}), ...(current[id] || {}), [field]: value },
    }));
  };

  const execute = async (key, action, successMessage) => {
    setSubmitting(key);
    try {
      const response = await action();
      if (!response?.ok) throw new Error(response?.data?.error || 'Aksi gagal diproses.');
      setToast({ type: 'success', message: successMessage });
      await load({ silent: true });
      return true;
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Aksi gagal diproses.' });
      return false;
    } finally {
      setSubmitting('');
    }
  };

  const createDraft = async (event) => {
    event.preventDefault();
    const succeeded = await execute('create', () => childLeaveApi.create(form), 'Draft cuti dibuat. Hubungi orang tua lalu konfirmasi pada kartu cuti.');
    if (succeeded) setForm((current) => ({ ...current, reason: '' }));
  };

  const confirmLeave = async (request) => {
    const action = actions[request.id] || actionDefaults(request);
    await execute(`confirm:${request.id}`, () => childLeaveApi.confirm(request.id, action), 'Cuti dikonfirmasi dan sesi terdampak diproses.');
  };

  const reviseLeave = async (request) => {
    const action = actions[request.id] || actionDefaults(request);
    const confirmed = await confirmAction({
      tone: 'warning',
      title: 'Terapkan perubahan cuti?',
      message: action.strategy === 'restore_original'
        ? 'Sesi yang keluar dari rentang cuti akan dicoba dikembalikan ke tanggal asal.'
        : 'Sesi yang sudah dipindahkan akan tetap berada pada jadwal pengganti.',
      confirmText: 'Terapkan',
      cancelText: 'Batal',
    });
    if (!confirmed) return;
    await execute(`revise:${request.id}`, () => childLeaveApi.revise(request.id, action), 'Perubahan cuti dan jadwal sudah diproses.');
  };

  const cancelLeave = async (request) => {
    const action = actions[request.id] || actionDefaults(request);
    const confirmed = await confirmAction({
      tone: 'danger',
      title: request.status === 'draft' ? 'Batalkan draft cuti?' : 'Batalkan cuti dan pulihkan jadwal?',
      message: request.status === 'draft'
        ? 'Draft akan ditutup tanpa mengubah jadwal.'
        : 'Sistem akan mencoba mengembalikan sesi ke tanggal asal. Tanggal yang sudah lewat atau bentrok tetap memakai sesi pengganti.',
      confirmText: 'Batalkan cuti',
      cancelText: 'Kembali',
    });
    if (!confirmed) return;
    await execute(`cancel:${request.id}`, () => childLeaveApi.cancel(request.id, action), 'Cuti dibatalkan dan jadwal asal yang tersedia dipulihkan.');
  };

  const stats = useMemo(() => ({
    draft: requests.filter((request) => request.status === 'draft').length,
    active: requests.filter((request) => ['confirmed', 'revised'].includes(request.status)).length,
    failed: requests.reduce((sum, request) => sum + request.impacts.filter((impact) => ['move_failed', 'restore_failed'].includes(impact.status)).length, 0),
  }), [requests]);

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      {toast && (
        <button
          type="button"
          onClick={() => setToast(null)}
          className={`fixed bottom-5 right-5 z-50 max-w-md rounded-2xl border px-4 py-3 text-left text-sm font-bold shadow-xl ${
            toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </button>
      )}

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-800 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Penjadwalan Terintegrasi</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Cuti Anak / Orang Tua</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100">
            Simpan draft, catat bukti komunikasi orang tua, lalu konfirmasi. Sesi dalam masa cuti otomatis dipindahkan
            ke hari dan jam yang sama setelah periode terapi. Perubahan atau pembatalan cuti tetap memiliki jalur pemulihan.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Draft menunggu konfirmasi', stats.draft],
              ['Cuti aktif', stats.active],
              ['Perlu perhatian admin', stats.failed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="text-2xl font-black">{value}</div>
                <div className="mt-1 text-xs font-bold text-blue-100">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={createDraft} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Buat draft cuti</h2>
            <p className="mt-1 text-sm text-slate-500">Pembuatan draft belum mengubah jadwal sampai admin mencatat konfirmasi orang tua.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Anak
              <select
                value={form.childId}
                onChange={(event) => {
                  const childId = event.target.value;
                  const child = children.find((item) => item.id === childId);
                  const periods = (child?.periods || []).filter((period) => ['active', 'planned'].includes(String(period.status || '').toLowerCase()));
                  setForm((current) => ({ ...current, childId, therapyPeriodId: periods[0]?.id || '' }));
                }}
                required
                className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Pilih anak</option>
                {children.map((child) => <option key={child.id} value={child.id}>{child.name} ({child.nita || child.id})</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Periode terapi aktif
              <select
                value={form.therapyPeriodId}
                onChange={(event) => setForm((current) => ({ ...current, therapyPeriodId: event.target.value }))}
                required
                className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Pilih periode</option>
                {selectablePeriods.map((period) => (
                  <option key={period.id} value={period.id}>{period.name} ({formatDate(period.startDate)} - {formatDate(period.endDate)})</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Mulai cuti
              <input type="date" min={todayKey()} value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Selesai cuti
              <input type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
          </div>
          <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">
            Alasan / konteks cuti
            <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required rows={3} className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Contoh: keluarga bepergian selama dua minggu." />
          </label>
          <button disabled={submitting === 'create' || !form.therapyPeriodId} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">add_task</span>
            Simpan draft cuti
          </button>
        </form>

        <div className="space-y-5">
          {loading && <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">Memuat pengajuan cuti...</div>}
          {!loading && requests.length === 0 && <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">Belum ada pengajuan cuti anak.</div>}
          {requests.map((request) => {
            const action = actions[request.id] || actionDefaults(request);
            const active = ['confirmed', 'revised'].includes(request.status);
            const failedMoves = request.impacts.filter((impact) => impact.status === 'move_failed').length;
            return (
              <article key={request.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{request.childName}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_STYLES[request.status] || STATUS_STYLES.draft}`}>{STATUS_LABELS[request.status] || request.status}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{request.periodName} · {formatDate(request.startDate)} sampai {formatDate(request.endDate)}</p>
                      <p className="mt-1 text-sm text-slate-500">{request.reason}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right dark:bg-slate-800">
                      <div className="text-2xl font-black text-slate-900 dark:text-white">{request.impacts.length}</div>
                      <div className="text-xs font-bold text-slate-500">sesi tercatat</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950 sm:grid-cols-3">
                    <div><span className="block text-xs font-bold text-slate-400">Orang tua</span><span className="font-bold text-slate-700 dark:text-slate-200">{request.parentName || '-'} {request.parentPhone ? `· ${request.parentPhone}` : ''}</span></div>
                    <div><span className="block text-xs font-bold text-slate-400">Media terakhir</span><span className="font-bold text-slate-700 dark:text-slate-200">{CHANNELS.find((item) => item.value === request.communicationChannel)?.label || 'Belum dikonfirmasi'}</span></div>
                    <div><span className="block text-xs font-bold text-slate-400">Akhir periode</span><span className="font-bold text-slate-700 dark:text-slate-200">{formatDate(request.periodEndDate)}</span></div>
                  </div>
                  {request.revisionHistory?.length > 0 && (
                    <details className="mt-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        Riwayat konfirmasi dan perubahan ({request.revisionHistory.length})
                      </summary>
                      <div className="mt-3 space-y-2">
                        {[...request.revisionHistory].reverse().map((revision, index) => (
                          <div key={`${revision.createdAt}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                            <span className="font-black">{revision.action}</span> · {CHANNELS.find((item) => item.value === revision.communicationChannel)?.label || revision.communicationChannel} · {new Date(revision.createdAt).toLocaleString('id-ID')}
                            <p className="mt-1 font-semibold">{revision.communicationNote}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_1.2fr]">
                  {request.status !== 'cancelled' && (
                    <div className="space-y-4">
                      {active && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-black uppercase tracking-wide text-slate-500">Mulai cuti<input type="date" value={action.startDate} onChange={(event) => setAction(request.id, 'startDate', event.target.value)} className="mt-2 w-full rounded-xl border-slate-200 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" /></label>
                          <label className="text-xs font-black uppercase tracking-wide text-slate-500">Selesai cuti<input type="date" min={action.startDate} value={action.endDate} onChange={(event) => setAction(request.id, 'endDate', event.target.value)} className="mt-2 w-full rounded-xl border-slate-200 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" /></label>
                          <label className="sm:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            Perlakuan sesi yang keluar dari rentang cuti
                            <select value={action.strategy} onChange={(event) => setAction(request.id, 'strategy', event.target.value)} className="mt-2 w-full rounded-xl border-slate-200 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                              <option value="restore_original">Coba pulihkan ke tanggal asal</option>
                              <option value="keep_replacement">Pertahankan jadwal pengganti</option>
                            </select>
                          </label>
                        </div>
                      )}
                      <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                        Media konfirmasi orang tua
                        <select value={action.communicationChannel} onChange={(event) => setAction(request.id, 'communicationChannel', event.target.value)} className="mt-2 w-full rounded-xl border-slate-200 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                          {CHANNELS.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                        Catatan / bukti komunikasi
                        <textarea value={action.communicationNote} onChange={(event) => setAction(request.id, 'communicationNote', event.target.value)} rows={3} className="mt-2 w-full rounded-xl border-slate-200 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" placeholder="Contoh: Disetujui Ibu melalui WhatsApp tanggal..." />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {request.status === 'draft' && <button type="button" disabled={submitting === `confirm:${request.id}`} onClick={() => confirmLeave(request)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Konfirmasi & pindahkan sesi</button>}
                        {active && <button type="button" disabled={submitting === `revise:${request.id}`} onClick={() => reviseLeave(request)} className="rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Terapkan perubahan cuti</button>}
                        {failedMoves > 0 && <button type="button" disabled={submitting === `retry:${request.id}`} onClick={() => execute(`retry:${request.id}`, () => childLeaveApi.retry(request.id), 'Pemindahan sesi yang gagal dicoba ulang.')} className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Coba ulang {failedMoves} sesi</button>}
                        <button type="button" disabled={submitting === `cancel:${request.id}`} onClick={() => cancelLeave(request)} className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 disabled:opacity-50">Batalkan cuti</button>
                      </div>
                    </div>
                  )}

                  <div className={request.status === 'cancelled' ? 'xl:col-span-2' : ''}>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Riwayat sesi terdampak</h3>
                    <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                      {request.impacts.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">Tidak ada sesi terjadwal dalam rentang cuti ini.</div>}
                      {request.impacts.map((impact) => (
                        <div key={impact.originalSessionId} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatDate(impact.originalDate)} · {impact.originalStartTime}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${['move_failed', 'restore_failed'].includes(impact.status) ? 'bg-red-100 text-red-700' : impact.status === 'moved' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{IMPACT_LABELS[impact.status] || impact.status}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">Terapis: {impact.therapistName}</p>
                          {impact.replacementDate && <p className="mt-2 text-xs font-bold text-blue-700">Pengganti: {formatDate(impact.replacementDate)} · {impact.replacementStartTime}</p>}
                          {impact.lastError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{impact.lastError}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
