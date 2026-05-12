import React, { useState } from 'react';
import TopNavBar from './components/TopNavBar';
import Stepper from './components/Stepper';
import StepForm from './components/StepForm';
import { sessionsApi } from '../../shared/api/client';

const TOTAL_STEPS = 4;

const INITIAL_DATA = {
    therapist: '', child: '', program: '', room: '',
    days: [], recurrence: 'weekly', totalSessions: '',
    startTime: '09:00', duration: '60', startDate: '', endDate: '',
};

const DAY_INDEX = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

function generateSessionDates(formData) {
    if (!formData.startDate || !formData.endDate || formData.days.length === 0) return [];
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const selectedDayIndices = formData.days.map(d => DAY_INDEX[d]);
    const recurrenceMultiplier = formData.recurrence === 'biweekly' ? 2 : formData.recurrence === 'monthly' ? 4 : 1;
    const dates = [];
    const limit = formData.totalSessions ? parseInt(formData.totalSessions) : 999;
    let weekCounter = 0;

    for (let d = new Date(start); d <= end && dates.length < limit; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 1 && d > start) weekCounter++;
        if (recurrenceMultiplier > 1 && weekCounter % recurrenceMultiplier !== 0 && weekCounter > 0) continue;
        if (selectedDayIndices.includes(d.getDay())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${day}`);
        }
    }
    return dates;
}

// ── Confirmation Modal ─────────────────────────────────────────────────────
function ConfirmModal({ formData, sessionCount, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'scaleIn 0.2s ease-out' }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
                    </div>
                    <div>
                        <h3 className="text-white font-extrabold text-lg leading-tight">Konfirmasi Bulk Generate</h3>
                        <p className="text-emerald-100 text-sm font-medium mt-0.5">Periksa ringkasan jadwal sebelum dibuat</p>
                    </div>
                </div>

                {/* Summary */}
                <div className="p-6 space-y-4">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl px-5 py-4 flex items-center gap-4">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                        <div>
                            <p className="text-emerald-700 dark:text-emerald-300 font-extrabold text-2xl">{sessionCount} Sesi</p>
                            <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">akan dibuat secara otomatis</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { icon: 'person', label: 'Terapis', value: formData.therapist || '—' },
                            { icon: 'child_care', label: 'Anak', value: formData.child || '—' },
                            { icon: 'medical_services', label: 'Program', value: formData.program || '—' },
                            { icon: 'meeting_room', label: 'Ruang', value: formData.room || '—' },
                            { icon: 'schedule', label: 'Jam Mulai', value: formData.startTime || '—' },
                            { icon: 'hourglass', label: 'Durasi', value: formData.duration ? `${formData.duration} menit` : '—' },
                            { icon: 'event', label: 'Mulai', value: formData.startDate || '—' },
                            { icon: 'event_busy', label: 'Selesai', value: formData.endDate || '—' },
                        ].map(item => (
                            <div key={item.label} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5">
                                <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5 shrink-0">{item.icon}</span>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{item.label}</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{item.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg px-4 py-2.5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">date_range</span>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                            Hari: {formData.days.join(', ') || '—'}
                        </span>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-4 py-3 flex items-start gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                        <p className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                            Pastikan data sudah benar. Jadwal yang telah dibuat akan langsung terlihat di semua dashboard.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-5 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                        Ya, Generate Sekarang!
                    </button>
                </div>
            </div>
            <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
        </div>
    );
}

// ── Success Modal ──────────────────────────────────────────────────────────
function SuccessModal({ sessionCount, onClose }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden text-center"
                style={{ animation: 'scaleIn 0.25s ease-out' }}
            >
                <div className="px-8 pt-10 pb-2">
                    {/* Animated checkmark */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30">
                        <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Berhasil Dibuat!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{sessionCount} sesi</span> berhasil digenerate dan sudah tersimpan.
                    </p>
                    <p className="text-slate-400 text-xs mt-2">Jadwal sudah terlihat di Therapist, Admin, dan Parent dashboard.</p>
                </div>

                <div className="flex flex-col gap-2 p-6">
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-5 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20"
                        >
                            Selesai
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.88) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
        </div>
    );
}

function App() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(INITIAL_DATA);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [generatedCount, setGeneratedCount] = useState(0);

    const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));
    const handleNext = () => setCurrentStep(s => Math.min(s + 1, TOTAL_STEPS));
    const handleBack = () => setCurrentStep(s => Math.max(s - 1, 1));

    const isStepValid = (() => {
        if (currentStep === 1) return !!(formData.therapist && formData.child && formData.program && formData.room);
        if (currentStep === 2) return (formData.days || []).length > 0 && !!formData.recurrence && !!formData.totalSessions;
        if (currentStep === 3) return !!(formData.startTime && formData.duration && formData.startDate && formData.endDate);
        return true;
    })();

    const sessionDates = generateSessionDates(formData);

    const handleGenerateClick = () => {
        setShowConfirm(true);
    };

    const handleConfirmGenerate = async () => {
        setShowConfirm(false);

        const dates = generateSessionDates(formData);
        if (dates.length === 0) return;

        const newSessionsData = dates.map((date) => {
            return {
                therapistId: formData.therapist,
                childId: formData.child,
                date,
                startTime: formData.startTime,
                duration: `${formData.duration} mins`,
                focus: formData.program,
                roomId: formData.room,
            };
        });

        try {
            await sessionsApi.createBulk(newSessionsData);
            setGeneratedCount(dates.length);
            setShowSuccess(true);
            // reset form
            setFormData(INITIAL_DATA);
            setCurrentStep(1);
        } catch(e) {
            console.error(e);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
    };

    return (
        <>
            <TopNavBar />
            <div className="flex min-h-full flex-1 overflow-hidden">
                <main className="flex flex-1 flex-col items-center bg-slate-50 p-6 dark:bg-slate-900 sm:p-8 lg:p-12">
                    <div className="w-full max-w-4xl bg-white dark:bg-background-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">

                        {/* Header with Stepper */}
                        <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 sm:py-6">
                            <h1 className="text-2xl font-bold leading-tight tracking-[-0.015em] mb-6">Bulk Schedule Generator</h1>
                            <Stepper currentStep={currentStep} />
                        </div>

                        {/* Form Content */}
                        <StepForm currentStep={currentStep} data={formData} update={update} />

                        {/* Footer Actions */}
                        <div className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                            <button
                                onClick={handleBack}
                                disabled={currentStep === 1}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                Back
                            </button>

                            {currentStep < TOTAL_STEPS ? (
                                <button
                                    onClick={handleNext}
                                    disabled={!isStepValid}
                                    className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary text-slate-900 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next
                                    <span className="material-symbols-outlined ml-2 text-lg">arrow_forward</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleGenerateClick}
                                    className="flex items-center justify-center rounded-lg h-10 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/20 gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">event_available</span>
                                    Generate Schedule
                                    {sessionDates.length > 0 && (
                                        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                                            {sessionDates.length} sesi
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>

                    </div>
                </main>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <ConfirmModal
                    formData={formData}
                    sessionCount={sessionDates.length}
                    onConfirm={handleConfirmGenerate}
                    onCancel={() => setShowConfirm(false)}
                />
            )}

            {/* Success Modal */}
            {showSuccess && (
                <SuccessModal
                    sessionCount={generatedCount}
                    onClose={handleSuccessClose}
                />
            )}
        </>
    );
}

export default App;
