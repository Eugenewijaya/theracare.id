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
    const chartPoints = data.map((d, i) => {
        const x = data.length === 1 ? 160 : 18 + (i * (284 / (data.length - 1)));
        const y = 160 - ((d.value / maxVal) * 124);
        return { ...d, x, y };
    });
    const polyline = chartPoints.map(p => `${p.x},${p.y}`).join(' ');
    const area = chartPoints.length > 0 ? `M ${chartPoints[0].x},170 L ${polyline} L ${chartPoints[chartPoints.length - 1].x},170 Z` : '';

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
            <h2 className="text-xl font-bold mb-4">Volume Sesi Bulanan</h2>
            <div className="mb-2 h-48 border-b border-border-light pt-4 dark:border-border-dark">
                <svg viewBox="0 0 320 180" className="h-full w-full overflow-visible" role="img" aria-label="Volume sesi bulanan">
                    <path d={area} fill="rgba(19, 236, 91, 0.12)" />
                    <polyline points={polyline} fill="none" stroke="currentColor" className="text-primary" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    {chartPoints.map((p, i) => (
                        <g key={p.label}>
                            <circle cx={p.x} cy={p.y} r={i === chartPoints.length - 1 ? 6 : 5} fill="currentColor" className="text-primary" stroke="white" strokeWidth="3">
                                <title>{`${p.label}: ${p.value} sesi`}</title>
                            </circle>
                            <text x={p.x} y={Math.max(18, p.y - 13)} textAnchor="middle" className="fill-text-light-secondary text-[12px] font-bold dark:fill-text-dark-secondary">
                                {p.value}
                            </text>
                        </g>
                    ))}
                </svg>
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
