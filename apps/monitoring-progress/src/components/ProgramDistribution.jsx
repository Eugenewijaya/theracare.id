import React, { useMemo } from 'react';

const ProgramDistribution = ({ store }) => {
    const { totalActive, dist } = useMemo(() => {
        const children = store?.children || [];
        if (!children.length) return { totalActive: 0, dist: [] };

        const activeChildren = children.filter(c => c.status !== 'inactive');
        const counts = {};
        let total = 0;

        activeChildren.forEach(child => {
            let prog = 'Umum';
            if (child.programs && child.programs.length > 0) {
                prog = child.programs[0].name || child.programs[0];
            } else if (child.program) {
                prog = child.program;
            }
            counts[prog] = (counts[prog] || 0) + 1;
            total++;
        });

        const colors = [
            { bg: 'bg-primary', border: '#13ec5b', fill: 'bg-primary' },
            { bg: 'bg-blue-400', border: '#60a5fa', fill: 'bg-blue-400' },
            { bg: 'bg-purple-400', border: '#c084fc', fill: 'bg-purple-400' },
            { bg: 'bg-amber-400', border: '#fbbf24', fill: 'bg-amber-400' },
            { bg: 'bg-pink-400', border: '#f472b6', fill: 'bg-pink-400' },
        ];

        const dist = Object.keys(counts).map((key, i) => {
            const val = counts[key];
            const pct = Math.round((val / total) * 100);
            return { label: key, value: val, pct, color: colors[i % colors.length] };
        }).sort((a, b) => b.value - a.value);

        return { totalActive: total, dist };

    }, [store]);

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 flex-1">
            <h2 className="text-xl font-bold mb-6">Distribusi Program</h2>
            {totalActive > 0 ? (
                <div className="flex flex-col items-center justify-center gap-6">

                    {/* Fake Donut Chart since conic-gradient is tricky in tailwind without arbitrary values */}
                    <div className="w-40 h-40 rounded-full border-[16px] border-border-light dark:border-border-dark relative flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-[16px] animate-pulse" style={{ borderColor: dist[0] ? dist[0].color.border : '#13ec5b', opacity: 0.8 }}></div>
                        <div className="z-10 flex items-center justify-center flex-col bg-surface-light dark:bg-surface-dark w-full h-full rounded-full absolute inset-0 m-auto">
                            <span className="text-2xl font-bold">{totalActive}</span>
                            <span className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary">Total Aktif</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="w-full flex flex-col gap-3">
                        {dist.map(d => (
                            <div key={d.label} className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className={`h-3 w-3 shrink-0 rounded-full ${d.color.bg}`}></span>
                                    <span className="min-w-0 break-words">{d.label}</span>
                                </div>
                                <span className="shrink-0 font-medium">{d.pct}% ({d.value})</span>
                            </div>
                        ))}
                    </div>

                </div>
            ) : (
                <p className="text-slate-500">Tidak ada data pendaftaran program.</p>
            )}
        </div>
    );
};

export default ProgramDistribution;
