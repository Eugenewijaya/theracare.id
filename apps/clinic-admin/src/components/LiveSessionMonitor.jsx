import React, { useEffect, useMemo, useState } from 'react';
import { sessionsApi } from '../../../shared/api/client';

function parseDurationMinutes(value) {
    const raw = String(value || '').toLowerCase();
    const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(h|hour|hours|jam)/);
    if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);
    const minuteMatch = raw.match(/(\d+)\s*(m|min|mins|menit)/);
    if (minuteMatch) return Number(minuteMatch[1]);
    const numeric = Number.parseInt(raw, 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 60;
}

function getSessionStart(session) {
    if (session.startedAt) {
        const started = new Date(session.startedAt);
        if (!Number.isNaN(started.getTime())) return started;
    }
    const fallback = new Date(`${session.date}T${session.startTime || '00:00'}`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getSessionEnd(session) {
    const start = getSessionStart(session);
    if (!start) return null;
    return new Date(start.getTime() + parseDurationMinutes(session.duration) * 60_000);
}

function formatClock(date) {
    if (!date) return '-';
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function getProgress(session, now) {
    const start = getSessionStart(session);
    const end = getSessionEnd(session);
    if (!start || !end) return 0;
    const total = end.getTime() - start.getTime();
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, ((now.getTime() - start.getTime()) / total) * 100));
}

function getParticipantLabel(session) {
    return session.child?.name || session.childId || 'Anak';
}

function getTherapistLabel(session) {
    return session.therapist?.name || session.therapist?.user?.name || session.therapistId || 'Terapis';
}

export default function LiveSessionMonitor() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const res = await sessionsApi.getAll();
                if (mounted) setSessions(res.data?.data || []);
            } catch (error) {
                console.error('Failed to load live sessions', error);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        const refresh = setInterval(load, 30000);
        const ticker = setInterval(() => setNow(new Date()), 1000);
        const onUpdate = () => load();
        window.addEventListener('sessionUpdated', onUpdate);
        return () => {
            mounted = false;
            clearInterval(refresh);
            clearInterval(ticker);
            window.removeEventListener('sessionUpdated', onUpdate);
        };
    }, []);

    const activeSessions = useMemo(() => {
        return sessions
            .filter((session) => session.status === 'active')
            .map((session) => ({ ...session, endAt: getSessionEnd(session), startAt: getSessionStart(session) }))
            .sort((a, b) => (a.endAt?.getTime() || 0) - (b.endAt?.getTime() || 0));
    }, [sessions]);

    return (
        <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Live monitoring</p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">Sesi Sedang Berjalan</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Read-only. Sesi otomatis selesai saat durasi berakhir dan backend tersinkron.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-700 shadow-sm">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                    </span>
                    {activeSessions.length} berjalan
                </div>
            </div>
            <div className="p-3">
                {loading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {[1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}
                    </div>
                ) : activeSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-9 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl">timer_off</span>
                        <p className="text-sm font-bold">Belum ada sesi yang sedang berjalan.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {activeSessions.map((session) => {
                            const endAt = session.endAt;
                            const remaining = endAt ? endAt.getTime() - now.getTime() : 0;
                            const progress = getProgress(session, now);
                            const expired = remaining <= 0;
                            return (
                                <article key={session.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-base font-black text-slate-950">{getParticipantLabel(session)}</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                {getTherapistLabel(session)} - {session.focus || 'Terapi'}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${expired ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {expired ? 'Sinkronisasi selesai' : 'Berjalan'}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="font-black uppercase text-slate-400">Mulai</p>
                                            <p className="mt-1 font-black text-slate-800">{formatClock(session.startAt)}</p>
                                        </div>
                                        <div>
                                            <p className="font-black uppercase text-slate-400">Selesai</p>
                                            <p className="mt-1 font-black text-slate-800">{formatClock(endAt)}</p>
                                        </div>
                                        <div>
                                            <p className="font-black uppercase text-slate-400">Sisa</p>
                                            <p className="mt-1 font-black text-blue-700">{formatCountdown(remaining)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className={`${expired ? 'bg-amber-500' : 'bg-blue-600'} h-full rounded-full transition-all`} style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[15px]">meeting_room</span>
                                            {session.room?.name || 'Ruang belum diset'}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[15px]">schedule</span>
                                            Durasi {parseDurationMinutes(session.duration)} menit
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
