import React from 'react';

const QuickActions = () => {
    return (
        <div className="bg-primary/10 rounded-xl p-5 border border-primary/20">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
                <button className="flex flex-col items-center justify-center gap-2 p-3 bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm hover:shadow border border-transparent hover:border-primary/30 transition-all">
                    <span className="material-symbols-outlined text-primary">mail</span>
                    <span className="text-xs font-medium">Message</span>
                </button>
                <button className="flex flex-col items-center justify-center gap-2 p-3 bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm hover:shadow border border-transparent hover:border-primary/30 transition-all">
                    <span className="material-symbols-outlined text-primary">menu_book</span>
                    <span className="text-xs font-medium">Resources</span>
                </button>
            </div>
        </div>
    );
};

export default QuickActions;
