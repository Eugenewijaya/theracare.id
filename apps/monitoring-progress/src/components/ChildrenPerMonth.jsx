import React, { useMemo } from 'react';

const ChildrenPerMonth = ({ store }) => {
    const data = useMemo(() => {
        const children = store?.children || [];
        if (children.length === 0) return [];
        
        const counts = {};
        children.forEach(c => {
            if (c.registeredAt || c.createdAt) {
                const d = new Date(c.registeredAt || c.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        
        const result = [];
        for (let i = 7; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
            result.push({ label, value: counts[key] || 0 });
        }
        return result;
    }, [store]);

    if (!data.length) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
                <h2 className="text-xl font-bold">Pendaftaran Anak Per Bulan</h2>
                <p className="text-slate-500 mt-2">Belum ada anak yang terdaftar.</p>
            </div>
        );
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const total  = data.reduce((a, d) => a + d.value, 0);
    const avg    = (total / data.length).toFixed(1);
    const chartPoints = data.map((d, i) => {
        const x = data.length === 1 ? 360 : 24 + (i * (672 / (data.length - 1)));
        const y = 172 - ((d.value / maxVal) * 132);
        return { ...d, x, y };
    });
    const polyline = chartPoints.map(p => `${p.x},${p.y}`).join(' ');
    const area = chartPoints.length > 0 ? `M ${chartPoints[0].x},184 L ${polyline} L ${chartPoints[chartPoints.length - 1].x},184 Z` : '';

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Pendaftaran Anak Per Bulan
                    </h2>
                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                        Tren registrasi 8 bulan terakhir
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Total</p>
                        <p className="text-2xl font-bold text-primary">{total}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Rata-rata/Bulan</p>
                        <p className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">{avg}</p>
                    </div>
                </div>
            </div>

            {/* Line Chart */}
            <div className="relative mt-2 mb-3 h-52 border-b border-border-light dark:border-border-dark">
                <svg viewBox="0 0 720 200" className="h-full w-full overflow-visible" role="img" aria-label="Tren pendaftaran anak per bulan">
                    <path d={area} fill="rgba(19, 236, 91, 0.12)" />
                    <polyline points={polyline} fill="none" stroke="currentColor" className="text-primary" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    {chartPoints.map((p, i) => (
                        <g key={p.label}>
                            <circle cx={p.x} cy={p.y} r={i === chartPoints.length - 1 ? 7 : 5} fill="currentColor" className="text-primary" stroke="white" strokeWidth="3">
                                <title>{`${p.label}: ${p.value} anak`}</title>
                            </circle>
                            <text x={p.x} y={Math.max(18, p.y - 14)} textAnchor="middle" className="fill-text-light-secondary text-[11px] font-bold dark:fill-text-dark-secondary">
                                {p.value}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            {/* Labels */}
            <div className="flex justify-between gap-3">
                {data.map(d => (
                    <span key={d.label} className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary text-center flex-1 truncate">
                        {d.label}
                    </span>
                ))}
            </div>

            {/* Trend indicator */}
            {(() => {
                const last = data[data.length - 1]?.value ?? 0;
                const prev = data[data.length - 2]?.value ?? 0;
                const diff = last - prev;
                if (diff === 0) return null;
                const isUp = diff > 0;
                return (
                    <div className={`mt-4 flex items-center gap-1.5 text-xs font-medium ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        <span className="material-symbols-outlined text-[16px]">{isUp ? 'trending_up' : 'trending_down'}</span>
                        <span>{Math.abs(diff)} {isUp ? 'lebih banyak' : 'lebih sedikit'} dari bulan lalu</span>
                    </div>
                );
            })()}
        </div>
    );
};

export default ChildrenPerMonth;
