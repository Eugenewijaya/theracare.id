import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../../../shared/api/client';

const PendingAttendance = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const res = await sessionsApi.getAll();
            if (!res.ok) {
                throw new Error(res.data?.error || 'Data sesi belum bisa dimuat.');
            }
            const allSessions = res.data?.data || [];
            const today = new Date().toISOString().split('T')[0];
            const pending = allSessions
                .filter(s => s.status === 'upcoming' && s.date === today)
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            setItems(pending.map(s => ({
                id: s.id,
                name: s.child?.name || s.childId || 'Anak',
                role: `${s.focus || 'Therapy'} w/ ${s.therapist?.name || 'Terapis'}`,
                time: s.startTime,
                initial: (s.child?.name || 'A').charAt(0).toUpperCase(),
            })));
        } catch (error) {
            console.error('Failed to load pending attendance', error);
            setItems([]);
            showToast(error.message || 'Data kehadiran belum bisa dimuat.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
        const interval = setInterval(loadSessions, 60000);
        return () => clearInterval(interval);
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleApprove = async (item) => {
        try {
            const res = await sessionsApi.updateStatus(item.id, 'confirmed');
            if (!res.ok) throw new Error(res.data?.error || 'Kehadiran belum bisa disetujui.');
            showToast(`Kehadiran ${item.name} berhasil disetujui.`, 'success');
            loadSessions();
        } catch (error) {
            console.error('Failed to approve attendance', error);
            showToast(error.message || 'Kehadiran belum bisa disetujui.', 'error');
        }
    };

    const handleReject = async (item) => {
        try {
            const res = await sessionsApi.updateStatus(item.id, 'cancelled');
            if (!res.ok) throw new Error(res.data?.error || 'Sesi belum bisa dibatalkan.');
            showToast(`Sesi ${item.name} telah dibatalkan.`, 'success');
            loadSessions();
        } catch (error) {
            console.error('Failed to reject attendance', error);
            showToast(error.message || 'Sesi belum bisa dibatalkan.', 'error');
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
            {toast && (
                <div className={`absolute top-3 right-3 left-3 z-10 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold shadow-lg border transition-all ${
                    toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                    <span className="material-symbols-outlined text-[18px]">{toast.type === 'success' ? 'check_circle' : 'cancel'}</span>
                    {toast.message}
                </div>
            )}

            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">fact_check</span>
                    Kehadiran Sesi Mendatang
                </h2>
                <button onClick={() => navigate('/attendance')} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">View All</button>
            </div>

            <div className="p-2 flex-1 flex flex-col gap-1">
                {loading ? (
                    <div className="flex flex-col gap-2 p-3">
                        {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                        <p className="text-sm font-medium">Semua kehadiran telah dikonfirmasi / Sesi kosong</p>
                    </div>
                ) : items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">{item.initial}</div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.role} • Check-in: {item.time}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleApprove(item)}
                                className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 hover:scale-110 transition-all" title="Approve">
                                <span className="material-symbols-outlined text-[18px]">check</span>
                            </button>
                            <button onClick={() => handleReject(item)}
                                className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all" title="Reject">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PendingAttendance;
