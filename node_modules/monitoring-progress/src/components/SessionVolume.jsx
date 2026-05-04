import React, { useMemo } from 'react';

const SessionVolume = ({ store }) => {
    const data = useMemo(() => {
        const sessions = store?.sessions || [];
        if (sessions.length === 0) return [];
        
        const counts = {};
        sessions.forEach(s => {
            if (s.date) {
                const d = new Date(s.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        
        const result = [];
        for (let i = 4; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('id-ID', { month: 'short' });
            result.push({ label, value: counts[key] || 0 });
        }
        return result;
    }, [store]);

    if (!data.length) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
                <h2 className="text-xl font-bold mb-4">Volume Sesi Bulanan</h2>
                <p className="text-slate-500">Belum ada sesi tercatat</p>
            </div>
        );
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
            <h2 className="text-xl font-bold mb-4">Volume Sesi Bulanan</h2>
            <div className="h-48 flex items-end justify-between gap-2 pt-4 border-b border-border-light dark:border-border-dark mb-2">
                {data.map((m, i) => {
                    const isLatest = i === data.length - 1;
                    const pct = (m.value / maxVal) * 100;
                    return (
                        <div
                            key={m.label}
                            className={`w-full ${isLatest ? 'bg-primary' : 'bg-primary/40 hover:bg-primary/60'} transition-colors rounded-t-sm relative group`}
                            style={{ height: `${Math.max(pct, 5)}%` }}
                        >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{m.value}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-xs text-text-light-secondary dark:text-text-dark-secondary">
                {data.map((m) => (
                    <span key={m.label} className="w-full text-center">{m.label}</span>
                ))}
            </div>
        </div>
    );
};

export default SessionVolume;
