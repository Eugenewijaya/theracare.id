import React from 'react';

const Sidebar = () => {
    return (
        <aside className="w-full lg:w-64 shrink-0 flex flex-col justify-between bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm h-fit">
            <div className="flex flex-col gap-6">

                <div className="flex gap-4 items-center border-b border-slate-100 dark:border-slate-800 pb-6">
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12"
                        title="Profile picture of Sarah Jenkins"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDDaJD-lJC9_9j-asqf_ECkj20HgDsjywQ0aCEtd4QynFsXPx1bjXydIWDwwA-uwfRdfc4MHdZGGz95xI8tAA2kq10_ZS2rrGk8ZCUI1xKIQyfEXOliLqmz-b7_s79Ocx0ovagQ3fXBbLD4tUnRfhma8_93TFRF8yYcjmRz2nEzacdCEejWuxu-r9GEy0aVm37KDcI1mCHHRuAWk6NSIkuJTgEIrtF1sDK8X02vuDh8znKVJw-MfKM8wX8bfb3Wbba5r63r8RoezA")' }}
                    ></div>
                    <div className="flex flex-col">
                        <h1 className="text-slate-900 dark:text-slate-100 text-base font-medium leading-normal">Sarah Jenkins</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Parent of Tommy</p>
                    </div>
                </div>

                <nav className="flex flex-col gap-2">
                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[24px]">home</span>
                        <p className="text-sm font-medium leading-normal">Overview</p>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[24px]">description</span>
                        <p className="text-sm font-medium leading-normal">Reports Archive</p>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[24px]">calendar_month</span>
                        <p className="text-sm font-medium leading-normal">Upcoming Sessions</p>
                    </a>

                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[24px]">person</span>
                        <p className="text-sm font-medium leading-normal">Profile</p>
                    </a>
                </nav>

            </div>
        </aside>
    );
};

export default Sidebar;
