import React from 'react';

const WelcomeHeader = () => {
    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold">Welcome back, Sarah!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Here is the latest overview of your child's progress.</p>
            </div>
            <div className="w-full sm:w-64">
                <label htmlFor="child-select" className="sr-only">Select Child</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-400 text-xl">face</span>
                    </div>
                    <select
                        id="child-select"
                        className="custom-select block w-full pl-10 pr-10 py-3 text-base border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm rounded-xl bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-sm appearance-none transition-shadow"
                        defaultValue="leo"
                    >
                        <option value="leo">Leo Thompson</option>
                        <option value="mia">Mia Thompson</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default WelcomeHeader;
