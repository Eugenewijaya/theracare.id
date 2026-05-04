import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();

    return (
        <header className="hidden lg:flex flex-col md:flex-row gap-4 items-center justify-between border-b border-solid border-slate-200 dark:border-slate-800 px-6 md:px-10 py-4 w-full">
            <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                <div className="size-6 text-primary">
                    <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <path clipRule="evenodd" d="M24 4H42V17.3333V30.6667H24V44H6V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                    </svg>
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-tight">TherapyHub</h2>
            </div>
            <div className="hidden md:flex flex-1 justify-end gap-8">
                <div
                    onClick={() => navigate('/performance')}
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20 cursor-pointer hover:border-primary transition-colors"
                    title="Profile picture of therapist"
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDgqZOtJdJ3T8x4Ek8AWUusOLbZI_IdOxxa7V2hX26WNzKD6VV-WS5_rC5eASl3MkitPNFHE49YopmDDb3_yf9qHL6o-4nQfEobyc5b4RXpkKnTTrw4-tpZJ-3ZCoVX381doV4AbflJmufT24rH_0kMMA_F-YP9cU37K0VmleMI12yNjYKLNw9aVowtfHwdpaYO-Tv-dIXlmv0_ydXcH_XWeP1h7wMdGD4yPVdbweW4b3v6Ac-DYrbLCXkT3bCRXWMhIN9SMRq3BA')" }}
                ></div>
            </div>
        </header>
    );
};

export default Header;
