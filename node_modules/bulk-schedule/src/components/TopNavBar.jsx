import React from 'react';

const TopNavBar = () => {
    return (
        <header className="hidden lg:flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-6 py-3 bg-background-light dark:bg-background-dark z-10 shrink-0 w-full">
            <div className="flex items-center gap-4 text-slate-900 dark:text-slate-100">
                <div className="size-6 text-primary">
                    <span className="material-symbols-outlined text-2xl">local_hospital</span>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">Therapy Center Admin</h2>
            </div>
            <div className="flex flex-1 justify-end gap-8">
                <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700"
                    title="Admin User Profile Avatar"
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDCpCEAWGyJiofPPvyxX2SUqstA1o5G7oyqe8Z-iM3VkeAKIBkpQsIsDq-KKhXKn0WP0DvCYJ3fV1fOcBuBgmqIW6U180W38SNudnqtzBXmPBErL6ESsGGDCssUvkN6VDAPqh67EwZPfHMQaszQq7tPm1XvpcRNTwHnOb6VjM5kRlWS_Q4kHHpWrhjIIIo3HuUxWuAttq5S9iH2R009-B_dXwwza--UtiEmVO8HPfGTj3mgv2mp-L7z4_Zo7de4yNOAThL2fpYkHQ')" }}
                ></div>
            </div>
        </header>
    );
};

export default TopNavBar;
