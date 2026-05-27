import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';

const Header = ({ searchValue = '', onSearchChange = () => {} }) => {
    const navigate = useNavigate();
    const { clinicName, brandColor } = useAdmin();
    return (
        <header className="hidden lg:flex flex-col md:flex-row items-center justify-between gap-4 border-b border-solid border-border-light dark:border-border-dark px-10 py-3 bg-surface-light dark:bg-surface-dark sticky top-0 z-10 w-full">
            <div className="flex min-w-0 items-center gap-8">
                <div className="flex min-w-0 items-center gap-4" style={{ color: brandColor }}>
                    <span className="material-symbols-outlined shrink-0 text-2xl">medical_services</span>
                    <h2 className="min-w-0 truncate text-text-light-primary dark:text-text-dark-primary text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName}</h2>
                </div>
                <label className="flex flex-col min-w-40 !h-10 max-w-64">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full border border-border-light dark:border-border-dark focus-within:border-primary">
                        <div className="text-text-light-secondary dark:text-text-dark-secondary flex bg-background-light dark:bg-background-dark items-center justify-center pl-4 rounded-l-lg border-r-0">
                            <span className="material-symbols-outlined">search</span>
                        </div>
                        <input
                            value={searchValue}
                            onChange={(event) => onSearchChange(event.target.value)}
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-text-light-primary dark:text-text-dark-primary focus:outline-0 focus:ring-0 border-none bg-background-light dark:bg-background-dark h-full placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary px-4 pl-2 text-base font-normal leading-normal"
                            placeholder="Cari anak, terapis, atau program"
                            aria-label="Cari data monitoring"
                        />
                    </div>
                </label>
            </div>
            <div className="flex flex-1 shrink-0 justify-end gap-8">
                <div className="flex gap-2">
                    <button onClick={() => navigate('/notifications')} className="flex items-center justify-center rounded-lg h-10 w-10 bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary hover:text-primary transition-colors relative">
                        <span className="material-symbols-outlined">notifications</span>
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>
                    <button onClick={() => navigate('/users')} className="flex items-center justify-center rounded-lg h-10 w-10 bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">account_circle</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
