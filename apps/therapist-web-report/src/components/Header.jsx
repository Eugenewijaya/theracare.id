import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();

    return (
        <header className="hidden lg:flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a262d] px-4 sm:px-8 py-4 flex-shrink-0 z-10 w-full">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">Session Report Form</h2>
            </div>
            <div className="flex items-center justify-end gap-6">
                <button className="relative text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center">
                    <span className="material-symbols-outlined">notifications</span>
                    <span className="absolute top-0 right-1 size-2 bg-primary rounded-full border border-white dark:border-[#1a262d]"></span>
                </button>
                <div
                    onClick={() => navigate('/performance')}
                    className="bg-slate-200 dark:bg-slate-700 bg-cover bg-center rounded-full size-10 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                    title="Therapist profile picture"
                >
                    <img
                        alt="Profile"
                        className="w-full h-full object-cover pointer-events-none"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDU6_suo9W01SKhTOh8jxYTtxq00rxoYqc42QStr1pyji5vSrB6blCkllAaaniSdFVP1G6I516r1Q2CqJi2PV4eneLnjaXGlDaZ3HHY0wC8WlbJh32TNp2oYIVIRtGThUq8V8r3EqyD5p9ep_TNsAVQAApKSzTXz9ztAFbmkde3ndrh74VbrAIQnw1bwqOL2_LpPU7qLhYSnyYk1fxUKpIXOMnXNcDzbJOZKpnvqN4obLGYV68J3TawLDB1r5eojrstQhOzxyaO2g"
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;
