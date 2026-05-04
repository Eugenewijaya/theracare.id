import React from 'react';

const ReportCard = ({ title, value, trend, icon, color }) => {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        <span className="material-symbols-outlined text-[16px]">{trend.isPositive ? 'trending_up' : 'trending_down'}</span>
                        {trend.value}%
                    </div>
                )}
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    );
};

export default ReportCard;
