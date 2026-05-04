import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessionsWithDetails, updateSessionStatus } from '../../../shared/clinicDataStore';

const PendingAttendance = () => {
    const navigate = useNavigate();
    const [items, setItems]   = useState([]);
    const [toast, setToast]   = useState(null);

    useEffect(() => {
        const load = () => {
            const today = new Date().toISOString().split('T')[0];
            const allSessions = getAllSessionsWithDetails();
            // Show upcoming sessions for today
            const pending = allSessions.filter(s => s.status === 'upcoming' && s.date === today)
                .sort((a,b) => a.startTime.localeCompare(b.startTime));
            
            const transformed = pending.map(s => ({
                id: s.id,
                name: s.child ? s.child.name : 'Unknown Child',
                role: `${s.focus || 'Therapy'} w/ ${s.therapist ? s.therapist.name : 'Therapist'}`,
                time: s.startTime,
                avatarObj: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDQeL2J2P2O5uH8P506H6yP924t0M1qH1R6_4tSXY37m8vA5239uA3d8gV9902iSxwI4wA0V1d0V90N7O8V32z1_82_1dD3AXY8o50F8L_sX51O5N4V8w6y3tEcxkY72P8K4pQvJ7WbQ0O22WwYn3C7N90X5Z12K8R9_E2gG4_V988L0sD8H930R7W19A208B8V45p0z45Z_d1tU')",
            }));
            setItems(transformed);
        };
        load();
        window.addEventListener('clinicDataUpdated', load);
        return () => window.removeEventListener('clinicDataUpdated', load);
    }, []);
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleApprove = (item) => {
        updateSessionStatus(item.id, 'done');
        showToast(`Kehadiran ${item.name} berhasil disetujui.`, 'success');
    };

    const handleReject = (item) => {
        updateSessionStatus(item.id, 'cancelled');
        showToast(`Sesi ${item.name} telah dibatalkan.`, 'error');
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
            {/* Inline Toast */}
            {toast && (
                <div className={`absolute top-3 right-3 left-3 z-10 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold shadow-lg border transition-all ${
                    toast.type === 'success'
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-red-50 text-red-800 border-red-200'
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
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                        <p className="text-sm font-medium">Semua kehadiran telah dikonfirmasi / Sesi kosong</p>
                    </div>
                ) : items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cover bg-center border border-slate-200" style={{ backgroundImage: item.avatarObj }} />
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
