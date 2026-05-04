import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const defaultItems = [
    { id: 1, name: 'Leo Carter (Parent)', desc: "Request to move tomorrow's SI session to Thursday 3PM.", icon: 'edit_calendar', bgClass: 'bg-blue-50 text-blue-600' },
    { id: 2, name: 'Emma Davis (Parent)', desc: 'Cancellation for ABA session today (Sick leave).',      icon: 'event_busy',    bgClass: 'bg-orange-50 text-orange-600' },
];

const getLivePending = () => {
    try { return JSON.parse(localStorage.getItem('adminRequests_pending') || '[]').slice(0, 3); }
    catch { return []; }
};

const ScheduleRequests = () => {
    const navigate = useNavigate();
    const [liveReqs, setLiveReqs] = useState(getLivePending());

    useEffect(() => {
        const update = () => setLiveReqs(getLivePending());
        window.addEventListener('requestsDataUpdated', update);
        return () => window.removeEventListener('requestsDataUpdated', update);
    }, []);

    const displayItems = liveReqs.length > 0
        ? liveReqs.map((r, i) => ({ id: i, name: `${r.name} (Parent: ${r.parentName})`, desc: r.reason, icon: 'edit_calendar', bgClass: 'bg-blue-50 text-blue-600' }))
        : defaultItems;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Schedule Requests</h2>
                {liveReqs.length > 0 && (
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">{liveReqs.length} pending</span>
                )}
            </div>
            <div className="p-2 flex-1 flex flex-col gap-1">
                {displayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <span className="material-symbols-outlined text-3xl">inventory_2</span>
                        <p className="text-sm">No pending requests</p>
                    </div>
                ) : displayItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.bgClass}`}>
                                <span className="material-symbols-outlined">{item.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{item.desc}</p>
                            </div>
                        </div>
                        <button onClick={() => navigate('/requests')} className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 whitespace-nowrap ml-2">
                            Review
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScheduleRequests;
