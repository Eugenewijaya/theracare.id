import React, { useState } from 'react';

const SettingsSidebar = () => {
    const [settings, setSettings] = useState({
        schedule: { email: true, inApp: true, sms: false },
        registration: { email: true, inApp: true, sms: false },
        reports: { email: false, inApp: true, sms: false },
    });

    const toggleSetting = (category, channel) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [channel]: !prev[category][channel]
            }
        }));
    };

    const CheckboxRow = ({ label, category, channel, disabled = false }) => (
        <label className={`text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
                type="checkbox"
                checked={settings[category][channel]}
                onChange={() => !disabled && toggleSetting(category, channel)}
                disabled={disabled}
                className="rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600 bg-transparent dark:bg-slate-800"
            />
            {label}
        </label>
    );

    return (
        <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl">settings</span>
                    <h3 className="text-lg font-bold">Notification Settings</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Choose how you want to receive alerts for different categories.</p>

                <div className="flex flex-col gap-5">

                    <div className="flex flex-col gap-3">
                        <h4 className="text-sm font-semibold">Schedule Changes</h4>
                        <div className="flex justify-between items-center">
                            <CheckboxRow label="Email" category="schedule" channel="email" />
                            <CheckboxRow label="In-App" category="schedule" channel="inApp" />
                            <CheckboxRow label="SMS" category="schedule" channel="sms" />
                        </div>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-800" />

                    <div className="flex flex-col gap-3">
                        <h4 className="text-sm font-semibold">New Registrations</h4>
                        <div className="flex justify-between items-center">
                            <CheckboxRow label="Email" category="registration" channel="email" />
                            <CheckboxRow label="In-App" category="registration" channel="inApp" />
                            <CheckboxRow label="SMS" category="registration" channel="sms" />
                        </div>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-800" />

                    <div className="flex flex-col gap-3">
                        <h4 className="text-sm font-semibold">Reports & Documents</h4>
                        <div className="flex justify-between items-center">
                            <CheckboxRow label="Email" category="reports" channel="email" />
                            <CheckboxRow label="In-App" category="reports" channel="inApp" />
                            <CheckboxRow label="SMS" category="reports" channel="sms" disabled={true} />
                        </div>
                    </div>

                </div>

                <button className="w-full mt-8 bg-primary hover:bg-primary/90 text-white rounded-lg py-2.5 text-sm font-bold transition-colors shadow-sm">
                    Save Preferences
                </button>
            </div>
        </aside>
    );
};

export default SettingsSidebar;
