import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionsApi, rescheduleApi, adminApi } from '../../../shared/api/client';
import { readParentUser } from '../../../shared/sessionIdentity';

const REASONS = [
  { value: '', label: 'Pilih alasan...' },
  { value: 'sick', label: 'Anak sedang sakit' },
  { value: 'emergency', label: 'Keperluan keluarga mendadak' },
  { value: 'conflict', label: 'Bentrok sekolah atau aktivitas' },
  { value: 'transportation', label: 'Kendala transportasi' },
  { value: 'other', label: 'Lainnya' },
];

const VIEW_TABS = [
  { value: 'calendar', label: 'Kalender Jadwal', icon: 'calendar_month' },
  { value: 'tracking', label: 'Tracking Pengajuan', icon: 'route' },
  { value: 'request', label: 'Ajukan Reschedule', icon: 'edit_calendar' },
];

const OPEN_REQUEST_STATUSES = new Set(['pending', 'review', 'under_review']);

const STATUS_LABELS = {
  pending: {
    label: 'Menunggu review',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'pending_actions',
    description: 'Pengajuan sudah masuk dan sedang menunggu review admin atau terapis utama.',
  },
  review: {
    label: 'Sedang direview',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: 'manage_search',
    description: 'Admin atau terapis utama sedang mengecek ketersediaan slot.',
  },
  under_review: {
    label: 'Sedang direview',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: 'manage_search',
    description: 'Admin atau terapis utama sedang mengecek ketersediaan slot.',
  },
  approved: {
    label: 'Disetujui',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'check_circle',
    description: 'Jadwal baru sudah diterapkan ke sistem.',
  },
  rejected: {
    label: 'Ditolak',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: 'cancel',
    description: 'Pengajuan belum bisa diproses. Lihat catatan untuk alasannya.',
  },
  cancelled: {
    label: 'Dibatalkan',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: 'block',
    description: 'Pengajuan sudah dibatalkan.',
  },
};

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const getPrimaryChildId = (user = {}) => {
  if (user.childId) return user.childId;
  const firstChild = Array.isArray(user.children) ? user.children[0] : null;
  return firstChild?.id || firstChild?.nita || (typeof firstChild === 'string' ? firstChild : '');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Hari ini';
  if (dateStr === tomorrow) return 'Besok';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatLongDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReasonLabel = (value) => (
  REASONS.find(item => item.value === value)?.label || value || 'Permintaan perubahan jadwal'
);

const normalizeRequestStatus = (status) => {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'declined') return 'rejected';
  if (value === 'canceled') return 'cancelled';
  return value;
};

const isOpenRequest = (request) => OPEN_REQUEST_STATUSES.has(normalizeRequestStatus(request?.status));

const getChildName = (request) => {
  const child = request?.child || {};
  return child.name || [child.firstName, child.lastName].filter(Boolean).join(' ') || request?.childId || 'Anak';
};

const getTherapistName = (request) => (
  request?.session?.therapist?.user?.name
  || request?.session?.therapist?.name
  || request?.therapistName
  || 'Terapis'
);

const getReviewerLabel = (request) => {
  if (request?.reviewedByName) return request.reviewedByName;
  if (request?.reviewedByRole === 'therapist') return 'Terapis utama';
  if (request?.reviewedByRole === 'admin') return 'Admin';
  return 'Admin/terapis';
};

const getSessionProgram = (session = {}) => (
  session.focus
  || session.programName
  || session.therapyPeriod?.program?.name
  || 'Sesi terapi'
);

const getRequestStatusConfig = (request) => (
  STATUS_LABELS[normalizeRequestStatus(request?.status)] || STATUS_LABELS.pending
);

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const getMonthGrid = (monthDate) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
};

const getMonthTitle = (date) => (
  date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
);

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseMinutes = (time) => {
  if (!/^\d{1,2}:\d{2}$/.test(time || '')) return null;
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const parseOperatingWindow = (value) => {
  const raw = (value || '').trim();
  if (!raw) return { start: 8 * 60, end: 17 * 60 };
  if (/tutup|closed|libur/i.test(raw)) return null;
  const match = raw.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (!match) return { start: 8 * 60, end: 17 * 60 };
  const start = parseMinutes(match[1]);
  const end = parseMinutes(match[2]);
  if (start === null || end === null || end <= start) return { start: 8 * 60, end: 17 * 60 };
  return { start, end };
};

const getProposedSlots = (request) => parseJsonArray(request?.proposedSlots);

const getSlotOperationalIssue = (slot, settings = {}) => {
  if (!slot?.date || !slot?.time) return '';
  const closures = parseJsonArray(settings.centerClosures);
  const closure = closures.find(item => (
    item?.isActive !== false
    && item.startDate
    && slot.date >= item.startDate
    && slot.date <= (item.endDate || item.startDate)
  ));
  if (closure) return `Center off: ${closure.title || 'jadwal operasional ditutup'}`;

  const day = new Date(`${slot.date}T00:00:00`).getDay();
  const windowValue = day === 0 || day === 6
    ? settings.operatingHoursWeekend
    : settings.operatingHoursWeekday;
  const window = parseOperatingWindow(windowValue);
  if (!window) return 'Center tutup pada hari tersebut';
  const minutes = parseMinutes(slot.time);
  if (minutes === null || minutes < window.start || minutes >= window.end) {
    return 'Di luar jam operasional center';
  }
  return '';
};

const getSlotKey = (slot = {}) => `${slot.date || ''}_${slot.time || ''}`;

const RequestTimeline = ({ request }) => {
  const status = normalizeRequestStatus(request?.status);
  const steps = [
    {
      key: 'submitted',
      label: 'Dikirim',
      description: 'Orang tua mengirim pengajuan.',
      done: true,
      time: formatDateTime(request?.createdAt),
    },
    {
      key: 'review',
      label: 'Review',
      description: 'Admin/terapis utama mengecek slot dan dampaknya ke jadwal.',
      done: status !== 'pending',
      active: OPEN_REQUEST_STATUSES.has(status),
      time: OPEN_REQUEST_STATUSES.has(status) ? 'Sedang diproses' : '',
    },
    {
      key: 'result',
      label: status === 'rejected' ? 'Ditolak' : status === 'cancelled' ? 'Dibatalkan' : 'Keputusan',
      description: status === 'approved'
        ? 'Jadwal baru sudah diterapkan.'
        : status === 'rejected'
          ? 'Pengajuan belum bisa diproses.'
          : status === 'cancelled'
            ? 'Pengajuan tidak aktif lagi.'
            : 'Menunggu keputusan.',
      done: ['approved', 'rejected', 'cancelled'].includes(status),
      active: !['approved', 'rejected', 'cancelled'].includes(status),
      time: request?.resolvedAt ? formatDateTime(request.resolvedAt) : '',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.key} className="relative flex gap-3 rounded-2xl bg-surface-light p-3 dark:bg-background-dark">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
            step.done
              ? 'bg-emerald-500 text-white'
              : step.active
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {step.done ? <span className="material-symbols-outlined text-[16px]">check</span> : index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">{step.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted-light dark:text-text-muted-dark">{step.description}</p>
            {step.time && <p className="mt-1 text-[11px] font-bold text-slate-400">{step.time}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

const RequestHistory = ({ requests, loading, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('');
  const counts = useMemo(() => ({
    all: requests.length,
    open: requests.filter(isOpenRequest).length,
    approved: requests.filter(item => normalizeRequestStatus(item.status) === 'approved').length,
    rejected: requests.filter(item => normalizeRequestStatus(item.status) === 'rejected').length,
    cancelled: requests.filter(item => normalizeRequestStatus(item.status) === 'cancelled').length,
  }), [requests]);
  const visibleRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    if (statusFilter === 'open') return requests.filter(isOpenRequest);
    return requests.filter(item => normalizeRequestStatus(item.status) === statusFilter);
  }, [requests, statusFilter]);

  return (
  <section className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-surface-dark">
    <div className="border-b border-border-light px-4 py-3 dark:border-border-dark">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Tracking Pengajuan Jadwal</h2>
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
            Pantau alur pengajuan dari terkirim, review admin/terapis, sampai keputusan akhir.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-light bg-surface-light px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:border-border-dark dark:bg-background-dark dark:text-slate-300"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
          {[
            ['all', 'Semua'],
            ['open', 'Diproses'],
            ['approved', 'Disetujui'],
            ['rejected', 'Ditolak'],
            ['cancelled', 'Dibatalkan'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                statusFilter === value
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-slate-500 hover:bg-slate-100 dark:bg-background-dark dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {label} <span className="opacity-80">({counts[value] || 0})</span>
            </button>
          ))}
      </div>
    </div>

    {requests.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">pending_actions</span>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Belum ada pengajuan reschedule.</p>
        <p className="max-w-md text-xs">
          Jika ada perubahan jadwal, statusnya akan tampil di sini dari proses review admin atau terapis.
        </p>
      </div>
    ) : visibleRequests.length === 0 ? (
      <div className="px-4 py-10 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
        Tidak ada pengajuan pada filter ini.
      </div>
    ) : (
      <div className="divide-y divide-border-light dark:divide-border-dark">
        {visibleRequests.map((request) => {
          const cfg = getRequestStatusConfig(request);
          const proposedSlots = getProposedSlots(request);
          const status = normalizeRequestStatus(request.status);
          const expanded = expandedId === request.id;
          return (
            <div key={request.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-primary">
                    {getChildName(request)} - {getSessionProgram(request.session)}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Jadwal lama: {formatLongDate(request.session?.date)} {request.session?.startTime || ''}
                  </p>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    {getReasonLabel(request.reason)}
                    {request.details ? ` - ${request.details}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cfg.className}`}>
                    <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                    {cfg.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? '' : request.id)}
                    className="rounded-full border border-border-light px-3 py-1 text-[11px] font-black text-slate-600 transition hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-background-dark"
                  >
                    {expanded ? 'Tutup detail' : 'Lihat detail'}
                  </button>
                </div>
              </div>

              <RequestTimeline request={request} />

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-2xl bg-surface-light p-3 dark:bg-background-dark">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Dikirim</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(request.createdAt)}</p>
                </div>
                <div className="rounded-2xl bg-surface-light p-3 dark:bg-background-dark">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Terapis utama</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{getTherapistName(request)}</p>
                </div>
              </div>

              {status === 'approved' && request.newDate && (
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Jadwal baru: {formatLongDate(request.newDate)} {request.newStartTime || request.session?.startTime || ''}
                </p>
              )}
              {request.reviewNote && (
                <p className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Catatan {getReviewerLabel(request)}: {request.reviewNote}
                </p>
              )}

              {expanded && (
                <div className="rounded-2xl border border-border-light p-3 dark:border-border-dark">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Opsi jadwal yang diajukan</p>
                  {proposedSlots.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {proposedSlots.map((slot, index) => {
                        const chosen = status === 'approved'
                          && request.newDate === slot.date
                          && (request.newStartTime || request.session?.startTime || '') === slot.time;
                        const available = slot.status === 'available';
                        return (
                          <div
                            key={`${request.id}_${index}`}
                            className={`rounded-xl border p-3 text-xs ${
                              chosen
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                                : available
                                  ? 'border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-300'
                                  : 'border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-black">Opsi {index + 1}</p>
                                <p className="mt-1 font-semibold">{formatLongDate(slot.date)} {slot.time}</p>
                              </div>
                              <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-black dark:bg-slate-950/40">
                                {chosen ? 'Dipilih' : available ? 'Tersedia' : 'Bentrok'}
                              </span>
                            </div>
                            {slot.reason && <p className="mt-2 leading-relaxed opacity-80">{slot.reason}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada opsi slot tersimpan.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </section>
  );
};

const ScheduleCalendar = ({
  sessions,
  requests,
  monthDate,
  onChangeMonth,
  selectedSessionId,
  onSelectSession,
}) => {
  const sessionsByDate = useMemo(() => (
    (sessions || []).reduce((acc, session) => {
      if (!session?.date) return acc;
      acc[session.date] = [...(acc[session.date] || []), session];
      return acc;
    }, {})
  ), [sessions]);

  const requestsByDate = useMemo(() => (
    (requests || []).reduce((acc, request) => {
      getProposedSlots(request).forEach((slot) => {
        if (!slot?.date) return;
        acc[slot.date] = [...(acc[slot.date] || []), { ...slot, requestStatus: request.status || 'pending' }];
      });
      return acc;
    }, {})
  ), [requests]);

  const days = useMemo(() => getMonthGrid(monthDate), [monthDate]);
  const todayKey = toDateKey(new Date());

  return (
    <section className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark">
      <div className="flex flex-col gap-3 border-b border-border-light pb-4 dark:border-border-dark sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Preview Kalender Jadwal Anak</h2>
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
            Jadwal aktif diambil dari data sesi anak. Preferensi reschedule tampil sebagai penanda pengajuan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-light bg-surface-light text-slate-600 transition hover:bg-slate-100 dark:border-border-dark dark:bg-background-dark dark:text-slate-300"
            aria-label="Bulan sebelumnya"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <div className="min-w-[150px] rounded-lg bg-surface-light px-3 py-2 text-center text-sm font-bold capitalize text-slate-900 dark:bg-background-dark dark:text-white">
            {getMonthTitle(monthDate)}
          </div>
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-light bg-surface-light text-slate-600 transition hover:bg-slate-100 dark:border-border-dark dark:bg-background-dark dark:text-slate-300"
            aria-label="Bulan berikutnya"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-xl border border-border-light text-center text-xs dark:border-border-dark">
        {DAY_LABELS.map((label) => (
          <div key={label} className="bg-slate-50 px-1 py-2 font-black uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            {label}
          </div>
        ))}
        {days.map((date) => {
          const dateKey = toDateKey(date);
          const daySessions = sessionsByDate[dateKey] || [];
          const dayRequests = requestsByDate[dateKey] || [];
          const isCurrentMonth = date.getMonth() === monthDate.getMonth();
          const isToday = dateKey === todayKey;

          return (
            <div
              key={dateKey}
              className={`min-h-[96px] border-t border-border-light p-1.5 text-left dark:border-border-dark sm:min-h-[118px] ${
                isCurrentMonth ? 'bg-white dark:bg-surface-dark' : 'bg-slate-50/70 text-slate-400 dark:bg-slate-900/50'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isToday ? 'bg-primary text-white' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  {date.getDate()}
                </span>
                {dayRequests.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {dayRequests.length} req
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {daySessions.slice(0, 2).map((session) => (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => onSelectSession?.(session)}
                    className={`rounded-lg border px-2 py-1 text-left text-[11px] font-bold leading-tight transition ${
                      selectedSessionId === session.id
                        ? 'border-primary bg-primary text-white'
                        : 'border-sky-100 bg-sky-50 text-sky-800 hover:border-primary dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200'
                    }`}
                    title={`${session.startTime || ''} ${session.focus || ''}`}
                  >
                    <span className="block truncate">{session.startTime || 'Sesi'}</span>
                    <span className="block truncate opacity-80">{session.focus || session.programName || 'Terapi'}</span>
                  </button>
                ))}
                {daySessions.length > 2 && (
                  <span className="text-[10px] font-bold text-slate-400">+{daySessions.length - 2} sesi</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
          <span className="h-2 w-2 rounded-full bg-sky-500"></span>
          Sesi aktif
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          Preferensi reschedule
        </span>
      </div>
    </section>
  );
};

const ScheduleDetailPanel = ({ session, onClose, onRequestReschedule, onViewTracking }) => {
  if (!session) return null;
  const statusText = session.status === 'done'
    ? 'Selesai'
    : session.status === 'active'
      ? 'Sedang berjalan'
      : session.status === 'cancelled'
        ? 'Dibatalkan'
        : 'Terjadwal';

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-auto z-[90] flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-surface-dark sm:right-4 sm:top-24 sm:h-auto sm:max-h-[calc(100vh-7rem)] sm:w-[420px] sm:rounded-3xl lg:top-24">
        <div className="flex items-start justify-between gap-4 border-b border-border-light bg-surface-light px-5 py-4 dark:border-border-dark dark:bg-background-dark">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Detail Jadwal</p>
            <h3 className="mt-1 truncate text-lg font-black text-slate-950 dark:text-white">
              {session.child?.name || 'Jadwal terapi anak'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
            aria-label="Tutup detail jadwal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <dl className="grid gap-3 text-sm">
            {[
              ['Tanggal', formatLongDate(session.date)],
              ['Jam', `${session.startTime || '-'}${session.duration ? ` (${session.duration})` : ''}`],
              ['Program', session.focus || session.programName || session.therapyPeriod?.program?.name || 'Terapi'],
              ['Terapis', session.therapist?.name || 'Terapis belum tersedia'],
              ['Ruangan', session.room?.name || session.roomId || 'Belum ditentukan'],
              ['Status', statusText],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-background-dark">
                <dt className="text-[11px] font-black uppercase tracking-wide text-text-muted-light dark:text-text-muted-dark">{label}</dt>
                <dd className="mt-1 break-words font-bold text-slate-950 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>

          {session.notes && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              <p className="font-black">Catatan sesi</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed">{session.notes}</p>
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-border-light p-4 dark:border-border-dark sm:grid-cols-2">
          <button
            type="button"
            onClick={onViewTracking}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-light bg-surface-light px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-border-dark dark:bg-background-dark dark:text-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">route</span>
            Tracking
          </button>
          <button
            type="button"
            onClick={onRequestReschedule}
            disabled={session.status === 'cancelled' || session.status === 'done'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
            Ajukan Reschedule
          </button>
        </div>
      </aside>
    </>
  );
};

const RescheduleForm = () => {
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [activeView, setActiveView] = useState('calendar');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [detailSession, setDetailSession] = useState(null);
  const [requestType, setRequestType] = useState('reschedule');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [slots, setSlots] = useState([
    { date: '', time: '' },
    { date: '', time: '' },
    { date: '', time: '' },
  ]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [clinicSettings, setClinicSettings] = useState({});
  const [slotPreview, setSlotPreview] = useState([]);
  const [previewingSlots, setPreviewingSlots] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    const user = readParentUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const childId = getPrimaryChildId(user);
    if (!childId) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const [sessionsRes, settingsRes, requestsRes] = await Promise.all([
        sessionsApi.getUpcomingForChild(childId),
        adminApi.getPublicSettings(),
        user.parentId ? rescheduleApi.getByParent(user.parentId) : Promise.resolve({ data: { data: [] } }),
      ]);

      if (!sessionsRes.ok) throw new Error(sessionsRes.data?.error || 'Jadwal anak belum bisa dimuat.');
      if (!requestsRes.ok) throw new Error(requestsRes.data?.error || 'Tracking pengajuan belum bisa dimuat.');

      const sessions = sessionsRes.data?.data || [];
      const nextRequests = [...(requestsRes.data?.data || [])].sort((a, b) => (
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ));
      setUpcomingSessions(sessions);
      setClinicSettings(settingsRes.ok ? settingsRes.data?.data || {} : {});
      setRequests(nextRequests);
      setPendingRequest(nextRequests.find(isOpenRequest) || null);

      if (sessions.length > 0) {
        setSelectedSessionId(prev => sessions.some(session => session.id === prev) ? prev : sessions[0].id);
        const firstDate = sessions[0]?.date ? new Date(`${sessions[0].date}T00:00:00`) : null;
        if (firstDate && !Number.isNaN(firstDate.getTime())) {
          setCalendarMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
        }
      } else {
        setSelectedSessionId('');
      }
    } catch (err) {
      console.error(err);
      setLoadError('Data reschedule belum bisa dimuat. Coba refresh beberapa saat lagi.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const events = [
      'parentChildSelectionChanged',
      'incomingRequestsUpdated',
      'rescheduleUpdated',
      'sessionUpdated',
      'scheduleUpdated',
      'notificationsUpdated',
      'theracareDataUpdated',
    ];
    const refreshSilently = () => loadData({ silent: true });
    events.forEach((eventName) => window.addEventListener(eventName, refreshSilently));
    const interval = window.setInterval(refreshSilently, 30000);
    return () => {
      window.clearInterval(interval);
      events.forEach((eventName) => window.removeEventListener(eventName, refreshSilently));
    };
  }, [loadData]);

  const selectedSession = useMemo(() => (
    upcomingSessions.find(session => session.id === selectedSessionId)
  ), [selectedSessionId, upcomingSessions]);
  const openRequests = useMemo(() => requests.filter(isOpenRequest), [requests]);
  const selectedSessionPendingRequest = useMemo(() => (
    openRequests.find(item => item.sessionId === selectedSessionId) || null
  ), [openRequests, selectedSessionId]);
  const filledSlots = useMemo(() => slots.filter(slot => slot.date && slot.time), [slots]);
  const slotPreviewByKey = useMemo(() => new Map(slotPreview.map(slot => [getSlotKey(slot), slot])), [slotPreview]);
  const availablePreviewCount = slotPreview.filter(slot => slot.status === 'available').length;

  useEffect(() => {
    const user = readParentUser() || {};
    const childId = getPrimaryChildId(user);
    const proposedSlots = slots.filter(slot => slot.date && slot.time);
    setSlotPreview([]);
    if (!childId || !selectedSessionId || proposedSlots.length === 0) {
      setPreviewingSlots(false);
      return undefined;
    }
    if (proposedSlots.some(slot => getSlotOperationalIssue(slot, clinicSettings))) {
      setPreviewingSlots(false);
      return undefined;
    }
    let active = true;
    setPreviewingSlots(true);
    const timeout = window.setTimeout(async () => {
      const res = await rescheduleApi.previewSlots({ childId, sessionId: selectedSessionId, proposedSlots });
      if (!active) return;
      setPreviewingSlots(false);
      if (res.ok) {
        setSlotPreview(res.data?.data || []);
      } else {
        setSlotPreview(proposedSlots.map(slot => ({
          ...slot,
          status: 'conflict',
          reason: res.data?.error || 'Slot belum bisa dicek.',
        })));
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [selectedSessionId, slots, clinicSettings]);

  const updateSlot = (index, field, value) => {
    setSlots(prev => prev.map((slot, i) => (
      i === index ? { ...slot, [field]: value } : slot
    )));
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (requestType === 'reschedule' && !selectedSessionId) {
      setError('Pilih sesi yang ingin direschedule.');
      return;
    }
    if (!reason) {
      setError('Pilih alasan perubahan jadwal.');
      return;
    }
    if (!slots[0].date || !slots[0].time) {
      setError('Masukkan minimal 1 preferensi waktu baru.');
      return;
    }
    if (selectedSessionPendingRequest) {
      setError('Sesi ini sudah memiliki pengajuan yang sedang diproses. Cek statusnya di tab tracking.');
      return;
    }

    const proposedSlots = slots.filter(slot => slot.date && slot.time);
    const blockedSlot = proposedSlots.find(slot => getSlotOperationalIssue(slot, clinicSettings));
    if (blockedSlot) {
      setError(`${blockedSlot.date} ${blockedSlot.time}: ${getSlotOperationalIssue(blockedSlot, clinicSettings)}`);
      return;
    }
    if (previewingSlots) {
      setError('Tunggu pengecekan opsi jadwal selesai dulu.');
      return;
    }

    const user = readParentUser() || {};
    const childId = getPrimaryChildId(user);
    if (!childId) {
      setError('Data anak tidak ditemukan untuk akun orang tua ini.');
      return;
    }
    const previewResult = await rescheduleApi.previewSlots({
      childId,
      sessionId: selectedSessionId,
      proposedSlots,
    });
    if (!previewResult.ok) {
      setError(previewResult.data?.error || 'Opsi jadwal belum bisa dicek.');
      return;
    }
    const previewSlots = previewResult.data?.data || [];
    setSlotPreview(previewSlots);
    if (!previewSlots.some(slot => slot.status === 'available')) {
      setError('Semua opsi jadwal bentrok. Pilih minimal satu opsi yang tersedia.');
      return;
    }

    setError('');
    setSaving(true);
    const result = await rescheduleApi.create({
      parentId: user.parentId,
      childId,
      sessionId: selectedSessionId,
      reason,
      details,
      proposedSlots,
    });

    if (!result.ok) {
      setError(result.data?.error || 'Gagal mengirim pengajuan');
      setSaving(false);
      return;
    }

    await loadData();
    window.dispatchEvent(new Event('incomingRequestsUpdated'));
    window.dispatchEvent(new Event('rescheduleUpdated'));
    window.dispatchEvent(new Event('notificationsUpdated'));
    window.dispatchEvent(new Event('theracareDataUpdated'));
    setSlots([{ date: '', time: '' }, { date: '', time: '' }, { date: '', time: '' }]);
    setReason('');
    setDetails('');
    setActiveView('tracking');
    setSubmitted(true);
    setSaving(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <span className="material-symbols-outlined text-5xl text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pengajuan terkirim</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Permintaan reschedule sudah diterima. Admin center dan terapis utama dapat meninjau opsi jadwal yang kamu ajukan.
          </p>
        </div>
        <div className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-800/50 dark:bg-amber-900/20">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-400">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Status: Menunggu Konfirmasi
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-500">Biasanya diproses dalam 1-2 hari kerja.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setActiveView('tracking');
          }}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
        >
          Lihat tracking pengajuan
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-1 pb-8 sm:px-4">
      <section className="rounded-3xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Penjadwalan Ulang</p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-slate-950 dark:text-white sm:text-3xl">
              Kelola jadwal terapi anak
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted-light dark:text-text-muted-dark">
              Lihat preview jadwal, pantau proses pengajuan, lalu isi form reschedule dari satu menu yang terpisah.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-light bg-surface-light px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-border-dark dark:bg-background-dark dark:text-slate-200"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 rounded-2xl bg-surface-light p-1 dark:bg-background-dark sm:grid-cols-3">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setActiveView(tab.value);
                setSubmitted(false);
                setError('');
              }}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
                activeView === tab.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {loadError}
        </div>
      )}

      {pendingRequest && (
        <div className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-100 p-4 dark:border-yellow-700/50 dark:bg-yellow-900/30">
          <span className="material-symbols-outlined shrink-0 text-yellow-600 dark:text-yellow-500">pending_actions</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400">
              {openRequests.length} pengajuan masih diproses.
            </p>
            <p className="mt-1 text-xs font-semibold text-yellow-800/80 dark:text-yellow-400/80">
              Kamu tetap bisa mengajukan sesi lain, tetapi sesi yang sama akan dikunci sampai ada keputusan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('tracking')}
            className="shrink-0 rounded-xl bg-white/70 px-3 py-2 text-xs font-black text-yellow-800 transition hover:bg-white dark:bg-slate-950/30 dark:text-yellow-300"
          >
            Lihat
          </button>
        </div>
      )}

      {activeView === 'calendar' && (
        <>
          <ScheduleCalendar
            sessions={upcomingSessions}
            requests={requests}
            monthDate={calendarMonth}
            onChangeMonth={setCalendarMonth}
            selectedSessionId={selectedSessionId}
            onSelectSession={(session) => {
              setSelectedSessionId(session.id);
              setDetailSession(session);
            }}
          />
          <ScheduleDetailPanel
            session={detailSession}
            onClose={() => setDetailSession(null)}
            onViewTracking={() => {
              setDetailSession(null);
              setActiveView('tracking');
            }}
            onRequestReschedule={() => {
              setSelectedSessionId(detailSession?.id || selectedSessionId);
              setDetailSession(null);
              setActiveView('request');
            }}
          />
        </>
      )}

      {activeView === 'tracking' && (
        <RequestHistory requests={requests} loading={loading} onRefresh={() => loadData()} />
      )}

      {activeView === 'request' && (
        <section className="rounded-2xl border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark sm:p-5">
          <div className="flex flex-col gap-3 border-b border-border-light pb-4 dark:border-border-dark sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Form Pengajuan Reschedule</h2>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                Pilih sesi aktif, isi alasan, lalu berikan maksimal 3 opsi jadwal baru.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-border-light bg-surface-light p-1 dark:border-border-dark dark:bg-background-dark">
              <button
                type="button"
                onClick={() => setRequestType('reschedule')}
                className={`rounded-lg px-3 py-2 text-xs font-black transition ${requestType === 'reschedule' ? 'bg-primary text-white' : 'text-slate-500'}`}
              >
                Reschedule Sesi
              </button>
              <button
                type="button"
                disabled
                title="Belum didukung oleh schema backend karena request wajib terhubung ke sesi yang sudah ada."
                className="rounded-lg px-3 py-2 text-xs font-black text-slate-400 opacity-50"
              >
                Sesi Tambahan
              </button>
            </div>
          </div>

          {selectedSession && (
            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-900/20">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">Sesi yang dipilih</p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">
                {formatLongDate(selectedSession.date)} - {selectedSession.startTime || 'Sesi'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedSession.focus || selectedSession.programName || 'Terapi'} - {selectedSession.therapist?.name || 'Terapis'}
              </p>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-base font-black text-slate-950 dark:text-white">Pilih sesi yang ingin diubah</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map(session => (
                  <label key={session.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    selectedSessionId === session.id
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border-light hover:bg-surface-light dark:border-border-dark dark:hover:bg-background-dark'
                  }`}>
                    <input
                      type="radio"
                      name="session-select"
                      value={session.id}
                      checked={selectedSessionId === session.id}
                      onChange={() => setSelectedSessionId(session.id)}
                      className="mt-1 h-5 w-5 accent-primary"
                    />
                    <div className="min-w-0 grow">
                      <p className="text-sm font-bold leading-normal text-slate-900 dark:text-white">
                        {formatDate(session.date)} - {session.startTime} - {session.focus || session.programName || 'Terapi'}
                      </p>
                      <p className="text-sm font-normal leading-normal text-text-muted-light dark:text-text-muted-dark">
                        {session.therapist?.name || 'Terapis'} - {session.duration || 'Durasi mengikuti jadwal'}
                      </p>
                    </div>
                  </label>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-light py-8 text-center text-slate-400 dark:border-border-dark dark:text-slate-600">
                  <span className="material-symbols-outlined text-3xl">event_busy</span>
                  <p className="text-sm font-semibold">Belum ada sesi mendatang yang bisa diajukan reschedule.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white">Alasan perubahan</h3>
              <div className="mt-3 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="reason-select">Pilih alasan</label>
                  <div className="relative">
                    <select
                      id="reason-select"
                      value={reason}
                      onChange={event => setReason(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-border-light bg-surface-light px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-slate-100"
                    >
                      {REASONS.map(item => (
                        <option key={item.value} value={item.value} disabled={!item.value}>{item.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-muted-light dark:text-text-muted-dark">
                      <span className="material-symbols-outlined">expand_more</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="reason-details">Detail tambahan opsional</label>
                  <textarea
                    id="reason-details"
                    rows="4"
                    value={details}
                    onChange={event => setDetails(event.target.value)}
                    className="w-full resize-none rounded-xl border border-border-light bg-surface-light px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-slate-100"
                    placeholder="Contoh: anak ada kegiatan sekolah, perlu pindah ke jam sore."
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white">Opsi jadwal baru</h3>
              <p className="mt-1 text-sm text-text-muted-light dark:text-text-muted-dark">
                Masukkan minimal 1 opsi. Sistem menolak tanggal off center atau di luar jam operasional.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {[{ label: 'Preferensi 1 - wajib' }, { label: 'Preferensi 2 - opsional' }, { label: 'Preferensi 3 - opsional' }].map((slot, index) => (
                  <div key={slot.label} className="rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-background-dark">
                    {(() => {
                      const currentSlot = slots[index];
                      const operationalIssue = getSlotOperationalIssue(currentSlot, clinicSettings);
                      const preview = slotPreviewByKey.get(getSlotKey(currentSlot));
                      const isAvailable = preview?.status === 'available';
                      const isConflict = preview?.status === 'conflict' || !!operationalIssue;
                      return (
                        <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-text-muted-light dark:text-text-muted-dark">{slot.label}</label>
                      {currentSlot.date && currentSlot.time && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                          previewingSlots && !operationalIssue
                            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                            : isAvailable
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : isConflict
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {previewingSlots && !operationalIssue ? 'Mengecek...' : isAvailable ? 'Available' : isConflict ? 'Conflict' : 'Belum dicek'}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={currentSlot.date}
                        onChange={event => updateSlot(index, 'date', event.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className={`min-w-0 rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-surface-dark dark:text-slate-100 dark:[color-scheme:dark] ${
                          isConflict
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-800'
                            : 'border-border-light focus:border-primary focus:ring-primary dark:border-border-dark'
                        }`}
                      />
                      <input
                        type="time"
                        value={currentSlot.time}
                        onChange={event => updateSlot(index, 'time', event.target.value)}
                        className={`min-w-0 rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-surface-dark dark:text-slate-100 dark:[color-scheme:dark] ${
                          isConflict
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-800'
                            : 'border-border-light focus:border-primary focus:ring-primary dark:border-border-dark'
                        }`}
                      />
                    </div>
                    {(operationalIssue || preview?.reason) && (
                      <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
                        isAvailable ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        {operationalIssue || preview?.reason}
                      </p>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
              {filledSlots.length > 0 && slotPreview.length > 0 && (
                <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${
                  availablePreviewCount > 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                  {availablePreviewCount > 0
                    ? `${availablePreviewCount} opsi tersedia. Opsi conflict tetap tercatat agar admin/terapis tahu alternatif yang tidak dapat dipakai.`
                    : 'Belum ada opsi yang tersedia. Pilih tanggal atau jam lain.'}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <span className="material-symbols-outlined text-[16px]">error</span> {error}
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse justify-end gap-3 border-t border-border-light pt-4 dark:border-border-dark sm:flex-row">
            <button
              type="button"
              onClick={() => setActiveView('calendar')}
              className="rounded-xl border border-border-light px-5 py-2.5 text-sm font-bold transition hover:bg-surface-light dark:border-border-dark dark:hover:bg-background-dark"
            >
              Kembali ke kalender
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || previewingSlots || (requestType === 'reschedule' && upcomingSessions.length === 0) || !!selectedSessionPendingRequest}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Mengirim...' : previewingSlots ? 'Mengecek opsi...' : 'Kirim Pengajuan'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default RescheduleForm;
