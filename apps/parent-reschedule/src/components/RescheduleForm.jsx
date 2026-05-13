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

const STATUS_LABELS = {
  pending: {
    label: 'Menunggu review admin',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'pending_actions',
  },
  review: {
    label: 'Sedang direview',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: 'manage_search',
  },
  under_review: {
    label: 'Sedang direview',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: 'manage_search',
  },
  approved: {
    label: 'Disetujui',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'check_circle',
  },
  rejected: {
    label: 'Ditolak',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: 'cancel',
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

const RequestHistory = ({ requests }) => (
  <section className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-surface-dark">
    <div className="border-b border-border-light px-4 py-3 dark:border-border-dark">
      <h2 className="text-base font-bold text-slate-950 dark:text-white">Tracking Pengajuan Jadwal</h2>
      <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
        Pantau status pengajuan tanpa menunggu refresh manual.
      </p>
    </div>

    {requests.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">pending_actions</span>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Belum ada pengajuan reschedule.</p>
        <p className="max-w-md text-xs">
          Jika ada perubahan jadwal, statusnya akan tampil di sini dari proses review admin.
        </p>
      </div>
    ) : (
      <div className="divide-y divide-border-light dark:divide-border-dark">
        {requests.map((request) => {
          const cfg = STATUS_LABELS[request.status] || STATUS_LABELS.pending;
          const proposedSlots = getProposedSlots(request);
          return (
            <div key={request.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatLongDate(request.session?.date)} {request.session?.startTime || ''}
                  </p>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    {request.reason || request.details || 'Permintaan perubahan jadwal'}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cfg.className}`}>
                  <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                  {cfg.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {proposedSlots.map((slot, index) => (
                  <span
                    key={`${request.id}_${index}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      slot.status === 'available'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    }`}
                    title={slot.reason || ''}
                  >
                    {formatDate(slot.date)} {slot.time} - {slot.status === 'available' ? 'Available' : 'Conflict'}
                  </span>
                ))}
              </div>

              {request.status === 'approved' && request.newDate && (
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Jadwal baru: {formatLongDate(request.newDate)} {request.newStartTime || request.session?.startTime || ''}
                </p>
              )}
              {request.reviewNote && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Catatan admin: {request.reviewNote}</p>
              )}
            </div>
          );
        })}
      </div>
    )}
  </section>
);

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

const RescheduleForm = () => {
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [activeView, setActiveView] = useState('calendar');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
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
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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

    setLoading(true);
    try {
      const [sessionsRes, settingsRes, requestsRes] = await Promise.all([
        sessionsApi.getUpcomingForChild(childId),
        adminApi.getPublicSettings(),
        user.parentId ? rescheduleApi.getByParent(user.parentId) : Promise.resolve({ data: { data: [] } }),
      ]);

      const sessions = sessionsRes.data?.data || [];
      const nextRequests = requestsRes.data?.data || [];
      setUpcomingSessions(sessions);
      setClinicSettings(settingsRes.data?.data || {});
      setRequests(nextRequests);
      setPendingRequest(nextRequests.find(item => ['pending', 'review', 'under_review'].includes(item.status)) || null);

      if (sessions.length > 0) {
        setSelectedSessionId(prev => sessions.some(session => session.id === prev) ? prev : sessions[0].id);
        const firstDate = sessions[0]?.date ? new Date(`${sessions[0].date}T00:00:00`) : null;
        if (firstDate && !Number.isNaN(firstDate.getTime())) {
          setCalendarMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
        }
      } else {
        setSelectedSessionId('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('parentChildSelectionChanged', loadData);
    window.addEventListener('incomingRequestsUpdated', loadData);
    return () => {
      window.removeEventListener('parentChildSelectionChanged', loadData);
      window.removeEventListener('incomingRequestsUpdated', loadData);
    };
  }, [loadData]);

  const selectedSession = useMemo(() => (
    upcomingSessions.find(session => session.id === selectedSessionId)
  ), [selectedSessionId, upcomingSessions]);

  const updateSlot = (index, field, value) => {
    setSlots(prev => prev.map((slot, i) => (
      i === index ? { ...slot, [field]: value } : slot
    )));
  };

  const handleSubmit = async () => {
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
    if (pendingRequest) {
      setError('Masih ada pengajuan yang sedang diproses. Tunggu keputusan admin terlebih dahulu.');
      return;
    }

    const proposedSlots = slots.filter(slot => slot.date && slot.time);
    const blockedSlot = proposedSlots.find(slot => getSlotOperationalIssue(slot, clinicSettings));
    if (blockedSlot) {
      setError(`${blockedSlot.date} ${blockedSlot.time}: ${getSlotOperationalIssue(blockedSlot, clinicSettings)}`);
      return;
    }

    const user = readParentUser() || {};
    const childId = getPrimaryChildId(user);
    if (!childId) {
      setError('Data anak tidak ditemukan untuk akun orang tua ini.');
      return;
    }

    setError('');
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
      return;
    }

    await loadData();
    window.dispatchEvent(new Event('incomingRequestsUpdated'));
    setSlots([{ date: '', time: '' }, { date: '', time: '' }, { date: '', time: '' }]);
    setReason('');
    setDetails('');
    setActiveView('tracking');
    setSubmitted(true);
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
            Permintaan reschedule sudah diterima. Admin center akan mereview opsi jadwal yang kamu ajukan.
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
            onClick={loadData}
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

      {pendingRequest && (
        <div className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-100 p-4 dark:border-yellow-700/50 dark:bg-yellow-900/30">
          <span className="material-symbols-outlined shrink-0 text-yellow-600 dark:text-yellow-500">pending_actions</span>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
            Anda sudah memiliki permintaan reschedule yang sedang diproses. Silakan tunggu konfirmasi dari admin center.
          </p>
        </div>
      )}

      {activeView === 'calendar' && (
        <ScheduleCalendar
          sessions={upcomingSessions}
          requests={requests}
          monthDate={calendarMonth}
          onChangeMonth={setCalendarMonth}
          selectedSessionId={selectedSessionId}
          onSelectSession={(session) => {
            setSelectedSessionId(session.id);
            setActiveView('request');
          }}
        />
      )}

      {activeView === 'tracking' && (
        <RequestHistory requests={requests} />
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
                    <label className="text-xs font-bold text-text-muted-light dark:text-text-muted-dark">{slot.label}</label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={slots[index].date}
                        onChange={event => updateSlot(index, 'date', event.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="min-w-0 rounded-lg border border-border-light bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-slate-100 dark:[color-scheme:dark]"
                      />
                      <input
                        type="time"
                        value={slots[index].time}
                        onChange={event => updateSlot(index, 'time', event.target.value)}
                        className="min-w-0 rounded-lg border border-border-light bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-slate-100 dark:[color-scheme:dark]"
                      />
                    </div>
                    {getSlotOperationalIssue(slots[index], clinicSettings) && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        {getSlotOperationalIssue(slots[index], clinicSettings)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
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
              disabled={(requestType === 'reschedule' && upcomingSessions.length === 0) || !!pendingRequest}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kirim Pengajuan
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default RescheduleForm;
