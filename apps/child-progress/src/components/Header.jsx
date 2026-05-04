import React from 'react';

const Header = ({ searchValue, onSearchChange }) => {
    return (
        <header className="hidden lg:flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-solid border-b-border-light px-4 sm:px-10 py-3 mb-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 w-full sm:w-auto">
                <div className="flex items-center gap-4 text-primary-content dark:text-primary shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: 32 }}>health_and_safety</span>
                    <h2 className="text-primary-content dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">Kemajuan Anak</h2>
                </div>
                <label className="flex flex-col w-full sm:min-w-40 sm:max-w-64 h-10 shrink-0">
                    <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                        <div className="text-secondary-content dark:text-slate-400 flex border-none bg-secondary dark:bg-slate-700 items-center justify-center pl-4 rounded-l-xl border-r-0">
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>
                        </div>
                        <input 
                            value={searchValue || ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-primary-content dark:text-white focus:outline-0 focus:ring-0 border-none bg-secondary dark:bg-slate-700 focus:border-none h-full placeholder:text-secondary-content dark:placeholder:text-slate-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" 
                            placeholder="Cari anak..." 
                        />
                    </div>
                </label>
            </div>
            {/* Removed redundant admin profile here */}
        </header>
    );
};

export default Header;
