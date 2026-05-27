import React from 'react';
import { useClinicSettings } from '../../../shared/clinicSettings';
import PortalProfileMenu from '../../../shared/ui/PortalProfileMenu';
import { useAuth } from '../../../admin-app/src/context/AuthContext';

const Header = () => {
    const { clinicName, primaryColor, logoUrl } = useClinicSettings();
    const auth = useAuth();
    const user = auth?.user || { name: 'Admin', role: 'admin', status: 'Aktif' };
    const navigateTo = (path) => {
        if (typeof window !== 'undefined') window.location.assign(path);
    };
    const handleLogout = async () => {
        await auth?.logout?.();
        navigateTo('/login');
    };

    return (
        <header className="hidden lg:flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-10 py-3 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="size-8 rounded-lg flex items-center justify-center text-white overflow-hidden" style={{ backgroundColor: primaryColor }}>
                    {logoUrl ? <img src={logoUrl} alt={`${clinicName} logo`} className="w-full h-full object-contain p-1" /> : <span className="material-symbols-outlined text-[22px]">local_hospital</span>}
                </div>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">{clinicName} Admin</h2>
            </div>
            <div className="flex flex-1 justify-end">
                <PortalProfileMenu
                    user={user}
                    role="admin"
                    onLogout={handleLogout}
                    onNavigateProfile={() => navigateTo('/users')}
                    onNavigateAnnouncements={() => navigateTo('/notifications')}
                    onNavigateSettings={() => navigateTo('/settings/branding')}
                />
            </div>
        </header>
    );
};

export default Header;
