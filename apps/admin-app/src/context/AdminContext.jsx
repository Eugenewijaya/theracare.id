import React, { createContext, useContext, useState } from 'react';
import { useClinicSettings } from '../../../shared/clinicSettings';

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const clinicSettings = useClinicSettings();
    
    // In a real app, adminProfile would likely be fetched from an API
    const [adminProfile, setAdminProfile] = useState({
        name: 'Admin',
        role: 'Administrator',
        avatar: 'A'
    });

    const value = {
        clinicName: clinicSettings.clinicName,
        brandColor: clinicSettings.primaryColor,
        primaryColor: clinicSettings.primaryColor,
        secondaryColor: clinicSettings.secondaryColor,
        logoUrl: clinicSettings.logoUrl,
        faviconUrl: clinicSettings.faviconUrl,
        setClinicName: (clinicName) => clinicSettings.save({ clinicName }),
        setBrandColor: (primaryColor) => clinicSettings.save({ primaryColor }),
        setLogoUrl: (logoUrl) => clinicSettings.save({ logoUrl }),
        clinicSettings,
        saveClinicSettings: clinicSettings.save,
        refreshClinicSettings: clinicSettings.refresh,
        adminProfile,
        setAdminProfile,
        sidebarCollapsed,
        setSidebarCollapsed
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};
