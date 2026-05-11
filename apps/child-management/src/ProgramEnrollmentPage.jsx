import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { childrenApi, therapyPeriodsApi } from '../../shared/api/client';
import ProgramForm from '../../child-registration/src/components/ProgramForm';

const todayString = () => new Date().toISOString().split('T')[0];

const initialForm = (child = null) => ({
  program: '',
  programId: '',
  programCode: '',
  programGoal: '',
  therapistId: child?.therapistId || '',
  periodStartDate: todayString(),
  periodEndDate: '',
  totalSessions: 12,
  billingMode: 'per_session',
  programPricePerSession: 0,
  programPricePerMonth: 0,
  totalPrice: 0,
  therapyDays: [],
  sessionStartTime: '09:00',
  sessionDuration: '60',
  notes: '',
});

const sortPeriods = (periods = []) => [...periods].sort((a, b) => (
  Number(b.periodNumber || 0) - Number(a.periodNumber || 0)
  || String(b.startDate || '').localeCompare(String(a.startDate || ''))
));

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!amount) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};

export default function ProgramEnrollmentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(searchParams.get('childId') || '');
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState(initialForm());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await childrenApi.getAll();
        const rows = res.data?.data || [];
        setChildren(rows);
        const requested = searchParams.get('childId');
        const requestedExists = rows.some(child => child.id === requested || child.nita === requested);
        const fallbackId = requested && requestedExists ? requested : rows[0]?.id || '';
        setSelectedChildId(fallbackId);
      } catch (e) {
        setMessage({ type: 'error', text: e.message || 'Gagal memuat data anak.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedChild = useMemo(
    () => children.find(child => child.id === selectedChildId || child.nita === selectedChildId) || null,
    [children, selectedChildId],
  );

  const sortedPeriods = useMemo(() => sortPeriods(selectedChild?.periods || []), [selectedChild]);
  const latestMatchingPeriod = useMemo(() => {
    if (!sortedPeriods.length) return null;
    if (form.programId) {
      const byProgramId = sortedPeriods.find(period => period.programId === form.programId);
      if (byProgramId) return byProgramId;
    }
    if (form.program) {
      const byName = sortedPeriods.find(period => (period.programName || period.type || '').toLowerCase() === form.program.toLowerCase());
      if (byName) return byName;
      return null;
    }
    return sortedPeriods[0];
  }, [sortedPeriods, form.programId, form.program]);

  useEffect(() => {
    if (!selectedChild) return;
    setForm(initialForm(selectedChild));
    setMessage(null);
    const next = new URLSearchParams(searchParams);
    next.set('childId', selectedChild.id);
    setSearchParams(next, { replace: true });
  }, [selectedChildId]);

  const validate = () => {
    const next = {};
    if (!selectedChild) next.childId = 'Pilih anak terlebih dahulu.';
    if (!form.program) next.program = 'Pilih program layanan.';
    if (!form.therapistId) next.therapistId = 'Pilih terapis utama.';
    if (!form.periodStartDate) next.periodStartDate = 'Tanggal mulai periode wajib diisi.';
    if (!Number(form.totalSessions || 0)) next.totalSessions = 'Jumlah sesi wajib diisi.';
    if (mode === 'renew' && !latestMatchingPeriod) next.mode = 'Belum ada periode sebelumnya untuk dilanjutkan.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => {
    const scheduleRules = Array.isArray(form.therapyDays)
      ? form.therapyDays.map(day => ({
        day,
        startTime: form.sessionStartTime || '09:00',
        duration: `${form.sessionDuration || 60} mins`,
        therapistId: form.therapistId,
      }))
      : [];

    return {
      childId: selectedChild.id,
      programId: form.programId || latestMatchingPeriod?.programId,
      type: form.program || latestMatchingPeriod?.programName || 'Program Terapi',
      goal: form.programGoal || '',
      notes: form.notes || '',
      startDate: form.periodStartDate,
      endDate: form.periodEndDate || null,
      totalSessions: Number(form.totalSessions || 12),
      pricePerSession: Number(form.programPricePerSession || 0),
      pricePerMonth: Number(form.programPricePerMonth || 0),
      totalPrice: Number(form.totalPrice || 0),
      billingMode: form.billingMode || 'per_session',
      scheduleRules,
      generateSessions: scheduleRules.length > 0,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const res = mode === 'renew' && latestMatchingPeriod?.id
        ? await therapyPeriodsApi.renew(latestMatchingPeriod.id, payload)
        : await therapyPeriodsApi.create(payload);
      if (!res.ok) throw new Error(res.data?.error || 'Gagal mendaftarkan program anak.');

      const period = res.data?.data || {};
      const generation = period.sessionGeneration;
      const createdCount = generation?.created ?? period.sessions?.length ?? 0;
      const skippedCount = generation?.skipped?.length || 0;
      setMessage({
        type: skippedCount > 0 ? 'warning' : 'success',
        text: `Program berhasil didaftarkan. ${createdCount} sesi dibuat${skippedCount ? `, ${skippedCount} slot dilewati karena bentrok/off center.` : '.'}`,
      });
      window.dispatchEvent(new Event('childUpdated'));
      window.dispatchEvent(new Event('sessionUpdated'));
      window.dispatchEvent(new Event('notificationsUpdated'));

      const refreshed = await childrenApi.getAll();
      setChildren(refreshed.data?.data || []);
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Gagal mendaftarkan program anak.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-background-light dark:bg-background-dark">
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Program Anak</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Pendaftaran Program / Periode</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Alur ini dipakai setelah biodata anak tersimpan. Pilih anak, pilih program layanan, atur periode, lalu sistem membuat jadwal sesi jika pola hari diisi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/children')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Data Anak
          </button>
        </div>

        {message && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : message.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Pilih Anak</label>
              <select
                value={selectedChildId}
                onChange={e => setSelectedChildId(e.target.value)}
                disabled={loading}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">{loading ? 'Memuat anak...' : 'Pilih anak...'}</option>
                {children.map(child => (
                  <option key={child.id} value={child.id}>{child.name} - {child.id}</option>
                ))}
              </select>
              {errors.childId && <p className="mt-2 text-xs font-bold text-red-600">{errors.childId}</p>}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Riwayat Periode</h2>
              <div className="mt-3 flex flex-col gap-2">
                {sortedPeriods.length ? sortedPeriods.map(period => (
                  <div key={period.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-slate-800 dark:text-slate-100">{period.name}</p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-black text-emerald-700">{period.status}</span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-600 dark:text-slate-300">{period.programName || period.type}</p>
                    <p className="mt-1 text-slate-500">{period.startDate} - {period.endDate || 'selesai sesi'}</p>
                    <p className="mt-1 text-slate-500">{period.sessionLabel} - {formatCurrency(period.totalPrice)}</p>
                  </div>
                )) : (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">Anak ini belum punya periode terapi.</p>
                )}
              </div>
            </section>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`rounded-xl border p-4 transition-colors ${mode === 'new' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                <input type="radio" className="sr-only" checked={mode === 'new'} onChange={() => setMode('new')} />
                <span className="text-sm font-black text-slate-900 dark:text-white">Program / periode baru</span>
                <span className="mt-1 block text-xs text-slate-500">Untuk program berbeda atau periode pertama anak.</span>
              </label>
              <label className={`rounded-xl border p-4 transition-colors ${mode === 'renew' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'} ${!latestMatchingPeriod ? 'opacity-60' : ''}`}>
                <input type="radio" className="sr-only" checked={mode === 'renew'} disabled={!latestMatchingPeriod} onChange={() => setMode('renew')} />
                <span className="text-sm font-black text-slate-900 dark:text-white">Lanjutkan periode</span>
                <span className="mt-1 block text-xs text-slate-500">Membuat season/periode berikutnya dari periode terakhir.</span>
              </label>
              {errors.mode && <p className="text-xs font-bold text-red-600 sm:col-span-2">{errors.mode}</p>}
            </div>

            <ProgramForm data={form} onChange={setForm} errors={errors} />

            <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
              {form.billingMode === 'package' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Harga Paket / Periode</label>
                  <input
                    type="number"
                    min="0"
                    value={form.totalPrice || ''}
                    onChange={e => setForm(prev => ({ ...prev, totalPrice: Number(e.target.value || 0) }))}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
              <div className={form.billingMode === 'package' ? '' : 'sm:col-span-2'}>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Target / Tujuan Periode</label>
                <input
                  value={form.programGoal || ''}
                  onChange={e => setForm(prev => ({ ...prev, programGoal: e.target.value }))}
                  placeholder="Contoh: Regulasi sensorik, komunikasi dua arah, fokus belajar"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Internal</label>
                <textarea
                  rows={3}
                  value={form.notes || ''}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Catatan admin untuk periode ini."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => navigate('/children')}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">playlist_add_check</span>
                {saving ? 'Mendaftarkan...' : 'Daftarkan Program'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
