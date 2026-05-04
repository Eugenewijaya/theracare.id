import React from 'react';

const Header = () => {
    return (
        <header className="bg-white dark:bg-[#1a2235] border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary p-2 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight">Admin Attendance Approval</h1>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 pl-6">
                    <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <div
                        className="w-9 h-9 rounded-full bg-cover bg-center border-2 border-slate-200 dark:border-slate-700 cursor-pointer"
                        title="Admin profile photo"
                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBKqlAreJCFQvf_NaBADNh7wk5DJ_CozpMdPxBWYR9eDC1WXD7Ay7FdPu95GRizAsWL90qtoXe-M7ltcXNqmfVCSzyN4YpGfYKQYvE-F-hbDhB-5BGcsK5VSUbKP1eXGVHRxMp7QmnXj-biTK8e_cmSuivwL5eELdYfPWZp39yK8PuFcCB2_AwzVUXmYJZQidDi-yugBHPaz4U36imE4wxkZX18zqqHwHsHk3FVlSDdzpndmoCOoLRwCPxJh8_Tqe4IFk09SJjVrA')" }}
                    ></div>
                </div>
            </div>
        </header>
    );
};

export default Header;
