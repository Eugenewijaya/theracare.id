import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../../shared/api/client';

const Sidebar = () => {
    const navigate = useNavigate();
    const handleContactSupport = async () => {
        try {
            const res = await adminApi.getPublicSettings();
            const settings = res.ok ? (res.data?.data || {}) : {};
            const phone = String(settings.adminWhatsApp || '').replace(/\D/g, '');
            if (phone) window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer');
        } catch (e) {
            console.error(e);
        }
    };
    return (
        <div className="hidden md:flex flex-col w-64 h-full bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex-shrink-0">
            <div className="flex h-full flex-col justify-between p-4">

                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="bg-primary/20 p-2 rounded-xl text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined">health_and_safety</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-text-primary-light dark:text-text-primary-dark text-base font-bold leading-normal">Therapy Clinic</h1>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs font-medium leading-normal">Parent Portal</p>
                        </div>
                    </div>

                    <nav className="flex flex-col gap-2">
                        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary text-left">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
                            <p className="text-sm font-semibold leading-normal">Dashboard</p>
                        </button>
                        <button type="button" onClick={() => navigate('/reschedule')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors text-left">
                            <span className="material-symbols-outlined">calendar_month</span>
                            <p className="text-sm font-medium leading-normal">My Child's Schedule</p>
                        </button>
                        <button type="button" onClick={() => navigate('/reports')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors text-left">
                            <span className="material-symbols-outlined">assignment</span>
                            <p className="text-sm font-medium leading-normal">Progress Reports</p>
                        </button>

                    </nav>
                </div>

                <div className="flex flex-col gap-4 mt-auto">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <p className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">Need help?</p>
                        <button onClick={handleContactSupport} className="w-full py-2 text-sm font-semibold text-primary bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">chat</span>
                            Contact Support
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Sidebar;
