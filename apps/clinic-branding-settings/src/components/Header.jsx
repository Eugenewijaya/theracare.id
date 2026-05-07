import React from 'react';
import { useClinicSettings } from '../../../shared/clinicSettings';

const Header = () => {
    const { clinicName, primaryColor, logoUrl } = useClinicSettings();
    return (
        <header className="hidden lg:flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-10 py-3 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="size-8 rounded-lg flex items-center justify-center text-white overflow-hidden" style={{ backgroundColor: primaryColor }}>
                    {logoUrl ? <img src={logoUrl} alt={`${clinicName} logo`} className="w-full h-full object-contain p-1" /> : <span className="material-symbols-outlined text-[22px]">local_hospital</span>}
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName} Admin</h2>
            </div>
            <div className="flex flex-1 justify-end gap-8">
                <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700"
                    title="Admin user profile picture"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD0Wz-UzDeExTdzzeR3ghRIHRGizxwmOgZTPnf9LEicsosXRSVbnncLg6L2_huZtLsgRqYCIBgnW3QIha9US17Q10BJZ7XiFtTy3h7IVtTZXBXzMqe_xSiYliNoD8FRPdsz1V9EArBh9-I4nYy4X146bns8GFT8_1qhK9cqrIl6cdVZuF-j_tPq5E5Q1xf39O9pVkq9B9bCwYzIVFpSr0lfkqoF3-EOwIl05eE4ZZdTCKgeV1Bb9KMA23qBcUd097YZFvnt5yi2mg")' }}
                ></div>
            </div>
        </header>
    );
};

export default Header;
