import React, { createContext, useContext, useState } from 'react';

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
    const [clinicName, setClinicName] = useState('TheraCare');
    const [brandColor, setBrandColor] = useState('#137fec'); // Default to primary blue
    const [logoUrl, setLogoUrl] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    // In a real app, adminProfile would likely be fetched from an API
    const [adminProfile, setAdminProfile] = useState({
        name: 'Admin',
        role: 'Administrator',
        avatar: 'A'
    });

    const value = {
        clinicName,
        setClinicName,
        brandColor,
        setBrandColor,
        logoUrl,
        setLogoUrl,
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
