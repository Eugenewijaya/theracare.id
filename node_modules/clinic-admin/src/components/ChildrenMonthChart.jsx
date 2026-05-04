import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const getChartData = () => {
    const result = [];
    try {
        const store = JSON.parse(localStorage.getItem('clinicData') || '{}');
        const children = store.children || [];
        const counts = {};
        
        children.forEach(c => {
            if (c.registeredAt || c.createdAt) {
                const d = new Date(c.registeredAt || c.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            result.push({ label, value: counts[key] || 0 });
        }
    } catch {
        // Fallback to empty 6 months if error
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            result.push({ label, value: 0 });
        }
    }
    return result;
};

const ChildrenMonthChart = () => {
    const navigate = useNavigate();
    const data = useMemo(() => getChartData(), []);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const latest = data[data.length - 1];
    const prev   = data[data.length - 2];
    const diff   = (latest?.value ?? 0) - (prev?.value ?? 0);
    const isUp   = diff > 0;
    const total  = data.reduce((a, d) => a + d.value, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Data Anak / Bulan</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Tren registrasi baru</p>
                </div>
                <button
                    onClick={() => navigate('/monitoring')}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                    Lihat detil
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl font-bold text-slate-900">{total}</div>
                <div>
                    <p className="text-xs text-slate-500">6 bulan terakhir</p>
                    {diff !== 0 && (
                        <p className={`text-xs font-semibold flex items-center gap-0.5 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span className="material-symbols-outlined text-[14px]">{isUp ? 'trending_up' : 'trending_down'}</span>
                            {Math.abs(diff)} vs bln lalu
                        </p>
                    )}
                </div>
            </div>

            {/* Mini bar chart */}
            <div className="flex items-end gap-1.5 h-16 border-b border-slate-100 pb-px mb-2">
                {data.map((d, i) => {
                    const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                    const isLatest = i === data.length - 1;
                    return (
                        <div key={d.label} className="flex flex-col items-center flex-1 h-full justify-end group">
                            <div
                                className={`w-full rounded-t transition-all duration-500 ${isLatest ? 'bg-primary' : 'bg-primary/30 hover:bg-primary/60'}`}
                                style={{ height: `${Math.max(pct, d.value > 0 ? 8 : 0)}%` }}
                                title={`${d.label}: ${d.value}`}
                            />
                        </div>
                    );
                })}
            </div>
            {/* Labels */}
            <div className="flex gap-1.5">
                {data.map(d => (
                    <span key={d.label} className="text-[10px] text-slate-400 text-center flex-1">{d.label}</span>
                ))}
            </div>
        </div>
    );
};

export default ChildrenMonthChart;
