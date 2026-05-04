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

            {/* Bar Chart */}
            <div className="flex items-end justify-between gap-3 h-48 mt-2 mb-3 border-b border-border-light dark:border-border-dark pb-px">
                {data.map((d, i) => {
                    const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                    const isLatest = i === data.length - 1;
                    return (
                        <div key={d.label} className="flex flex-col items-center gap-1 flex-1 h-full justify-end group">
                            <span className={`text-xs font-bold transition-all duration-200 ${isLatest ? 'text-primary opacity-100' : 'text-text-light-secondary dark:text-text-dark-secondary opacity-0 group-hover:opacity-100'}`}>
                                {d.value}
                            </span>
                            <div
                                className={`w-full rounded-t-md transition-all duration-500 cursor-pointer ${
                                    isLatest
                                        ? 'bg-primary'
                                        : 'bg-primary/40 hover:bg-primary/70 dark:bg-primary/30 dark:hover:bg-primary/60'
                                }`}
                                style={{ height: `${Math.max(pct, d.value > 0 ? 5 : 0)}%` }}
                                title={`${d.label}: ${d.value} anak`}
                            />
                        </div>
                    );
                })}
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
