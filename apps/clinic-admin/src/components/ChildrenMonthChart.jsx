import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { childrenApi } from '../../../shared/api/client';

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getEmptyChartData = () => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        result.push({
            key: getMonthKey(d),
            label: d.toLocaleDateString('id-ID', { month: 'short' }),
            value: 0,
        });
    }
    return result;
};

const buildChartData = (children = []) => {
    const base = getEmptyChartData();
    const counts = {};

    children.forEach(child => {
        const rawDate = child.registeredAt || child.createdAt || child.created_at;
        if (!rawDate) return;
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return;
        const key = getMonthKey(date);
        counts[key] = (counts[key] || 0) + 1;
    });

    return base.map(item => ({ ...item, value: counts[item.key] || 0 }));
};

const ChildrenMonthChart = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await childrenApi.getAll();
                if (!cancelled && res.ok) {
                    setChildren(res.data?.data || []);
                }
            } catch (error) {
                console.error('Failed to load children chart data', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const data = useMemo(() => buildChartData(children), [children]);
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const latest = data[data.length - 1];
    const prev   = data[data.length - 2];
    const diff   = (latest?.value ?? 0) - (prev?.value ?? 0);
    const isUp   = diff > 0;
    const total  = data.reduce((a, d) => a + d.value, 0);
    const chartPoints = data.map((d, i) => {
        const x = data.length === 1 ? 120 : 10 + (i * (220 / (data.length - 1)));
        const y = 66 - ((d.value / maxVal) * 54);
        return { ...d, x, y };
    });
    const polyline = chartPoints.map(p => `${p.x},${p.y}`).join(' ');
    const area = chartPoints.length > 0 ? `M ${chartPoints[0].x},70 L ${polyline} L ${chartPoints[chartPoints.length - 1].x},70 Z` : '';

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
                    <p className="text-xs text-slate-500">{loading ? 'Memuat data...' : '6 bulan terakhir'}</p>
                    {diff !== 0 && (
                        <p className={`text-xs font-semibold flex items-center gap-0.5 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span className="material-symbols-outlined text-[14px]">{isUp ? 'trending_up' : 'trending_down'}</span>
                            {Math.abs(diff)} vs bln lalu
                        </p>
                    )}
                </div>
            </div>

            {/* Mini line chart */}
            <div className="mb-2 h-20 border-b border-slate-100">
                <svg viewBox="0 0 240 80" className="h-full w-full overflow-visible" role="img" aria-label="Tren data anak per bulan">
                    <path d={area} fill="rgba(19, 127, 236, 0.12)" />
                    <polyline points={polyline} fill="none" stroke="var(--clinic-primary, #137fec)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    {chartPoints.map((p, i) => (
                        <g key={p.label}>
                            <circle cx={p.x} cy={p.y} r={i === chartPoints.length - 1 ? 5 : 4} fill={i === chartPoints.length - 1 ? 'var(--clinic-primary, #137fec)' : '#bfdbfe'} stroke="#fff" strokeWidth="2">
                                <title>{`${p.label}: ${p.value}`}</title>
                            </circle>
                        </g>
                    ))}
                </svg>
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
