import React from 'react';

const Header = () => {
    return (
        <header className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 w-full">
            <div className="flex flex-col gap-1">
                <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight">Availability Calendar</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">Manage your weekly schedule and clinical shifts</p>
            </div>
            {/* The action buttons (Copy to Next Week, Submit) were moved to the Quick Actions sidebar */ }
        </header>
    );
};

export default Header;
