import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../../shared/api/client';

const STATUS_COPY = {
  ok: {
    label: 'Normal',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'check_circle',
  },
  warning: {
    label: 'Warning',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'warning',
  },
  critical: {
    label: 'Critical',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: 'report',
  },
  over_limit: {
    label: 'Over Limit',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icon: 'error',
  },
  unknown: {
    label: 'Belum Terhubung',
    badge: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: 'help',
  },
  error: {
    label: 'Error',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icon: 'sync_problem',
  },
};

function formatBytes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function getErrorMessage(response, fallback) {
  return response?.data?.error || response?.data?.message || fallback;
}

export default function DatabaseGuardPage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [error, setError] = useState('');
  const [backupResult, setBackupResult] = useState(null);

  const loadUsage = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await adminApi.getDatabaseUsage();
      if (!res.ok) {
        setError(getErrorMessage(res, 'Gagal membaca usage database.'));
        return;
      }
      setUsage(res.data?.data || null);
    } catch (err) {
      setError(err?.message || 'Gagal membaca usage database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const status = usage?.status || 'unknown';
  const statusCopy = STATUS_COPY[status] || STATUS_COPY.unknown;
  const usagePercent = typeof usage?.usagePercent === 'number' ? Math.max(0, Math.min(100, usage.usagePercent)) : 0;
  const usedCopy = usage?.dataTransferGb === null || usage?.dataTransferGb === undefined
    ? '-'
    : `${usage.dataTransferGb} GB`;

  const backupDisabledReason = useMemo(() => {
    if (backupLoading) return 'Backup sedang dibuat.';
    if (!usage?.configured) return 'Neon API belum dikonfigurasi di backend.';
    if (usage?.actions?.backupAvailable === false) return usage.actions.backupReason || 'Backup belum tersedia.';
    return '';
  }, [backupLoading, usage]);

  const createBackup = async () => {
    setBackupLoading(true);
    setError('');
    setBackupResult(null);
    try {
      const res = await adminApi.createDatabaseBackup();
      if (!res.ok) {
        setError(getErrorMessage(res, 'Gagal membuat backup database.'));
        return;
      }
      setBackupResult(res.data?.data || null);
      await loadUsage({ silent: true });
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      setError(err?.message || 'Gagal membuat backup database.');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Database Guard</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Monitor Neon & Backup</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
            Pantau data transfer database production dan buat backup branch sebelum penggunaan mencapai batas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadUsage({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>sync</span>
          Refresh Usage
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-6 h-8 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusCopy.badge}`}>
                  <span className="material-symbols-outlined text-[17px]">{statusCopy.icon}</span>
                  {statusCopy.label}
                </div>
                <h2 className="mt-4 text-lg font-black text-slate-950">{usage?.projectName || 'Neon Project'}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Project ID: {usage?.projectId || '-'} {usage?.branchName ? `- Branch: ${usage.branchName}` : ''}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-black text-slate-800">Health DB</p>
                <p className="mt-1 font-semibold text-slate-500">
                  {usage?.databaseHealth?.status === 'ok' ? 'Koneksi database OK' : 'Database tidak tersedia'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Data Transfer</p>
                  <p className="mt-1 text-3xl font-black text-slate-950">
                    {usage?.usagePercent === null || usage?.usagePercent === undefined ? '-' : `${usage.usagePercent}%`}
                  </p>
                </div>
                <p className="text-right text-sm font-bold text-slate-500">
                  {usedCopy} / {usage?.dataTransferLimitGb || '-'} GB
                </p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    status === 'critical' || status === 'over_limit'
                      ? 'bg-red-500'
                      : status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Reset Quota</p>
                <p className="mt-2 text-sm font-bold text-slate-800">{formatDateTime(usage?.quotaResetAtUtc)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Storage</p>
                <p className="mt-2 text-sm font-bold text-slate-800">{formatBytes(usage?.storageBytes)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Terakhir Dicek</p>
                <p className="mt-2 text-sm font-bold text-slate-800">{formatDateTime(usage?.checkedAt)}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Tindakan Sistem</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Backup dibuat sebagai Neon branch tanpa compute. Ini lebih ringan daripada export dump besar dari dashboard.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={createBackup}
                  disabled={Boolean(backupDisabledReason)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <span className="material-symbols-outlined text-[18px]">{backupLoading ? 'hourglass_empty' : 'backup'}</span>
                  {backupLoading ? 'Membuat Backup...' : 'Backup Now'}
                </button>
                <button
                  type="button"
                  onClick={() => loadUsage({ silent: true })}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">monitoring</span>
                  Cek Ulang
                </button>
              </div>

              {backupDisabledReason && (
                <p className="mt-3 text-xs font-bold text-slate-500">{backupDisabledReason}</p>
              )}

              {backupResult && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <p className="font-black text-emerald-800">Backup branch berhasil dibuat</p>
                  <p className="mt-1 font-semibold text-emerald-700">
                    {backupResult.branchName} {backupResult.branchId ? `(${backupResult.branchId})` : ''}
                  </p>
                </div>
              )}
            </div>

            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Rekomendasi</h2>
              <div className="mt-4 flex flex-col gap-3">
                {(usage?.recommendations || []).map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">task_alt</span>
                    <p className="text-sm font-semibold leading-snug text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
