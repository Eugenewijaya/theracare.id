import React, { useState } from 'react';
import Stepper from './components/Stepper';
import ParentForm from './components/ParentForm';
import ChildForm from './components/ChildForm';
import ProgramForm from './components/ProgramForm';
import ReviewStep from './components/ReviewStep';
import RegistrationModeStep from './components/RegistrationModeStep';
import { parentsApi, childrenApi } from '../../shared/api/client';

// Steps dynamically determined by registration mode
const STEPS_NEW = [
    { id: 0, name: 'Mode' },
    { id: 1, name: 'Parent Info' },
    { id: 2, name: 'Child Info' },
    { id: 3, name: 'Program' },
    { id: 4, name: 'Review' },
];

const STEPS_EXISTING = [
    { id: 0, name: 'Mode' },
    { id: 2, name: 'Child Info' },
    { id: 3, name: 'Program' },
    { id: 4, name: 'Review' },
];

const EMPTY_PARENT = { name: '', phone: '', email: '', address: '' };
const EMPTY_CHILD  = {
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    school: '',
    diagnosis: '',
    program: '',
    totalSessions: 12,
    periodStartDate: '',
    periodEndDate: '',
    therapyDays: [],
    sessionStartTime: '09:00',
    sessionDuration: '60',
    billingMode: 'per_session',
};

const STEP_META = {
    0: { title: 'Jenis Pendaftaran',   subtitle: 'Pilih mode registrasi pasien baru.',                      icon: 'select_all'    },
    1: { title: 'Parent Information',   subtitle: 'Enter the parent or guardian contact details.',            icon: 'person'        },
    2: { title: 'Child Information',    subtitle: "Enter the child's personal and medical details.",           icon: 'child_care'    },
    3: { title: 'Program Assignment',   subtitle: 'Select the appropriate therapy program for this child.',    icon: 'menu_book'     },
    4: { title: 'Review & Submit',      subtitle: 'Verify all information before finalizing the registration.',icon: 'rate_review'   },
};

function App() {
    const [step, setStep]                   = useState(0); // start at mode selection
    const [regMode, setRegMode]             = useState(null); // 'new' | 'existing'
    const [parentData, setParentData]       = useState(EMPTY_PARENT);
    const [currentChild, setCurrentChild]   = useState(EMPTY_CHILD);
    const [childrenList, setChildrenList]   = useState([]);
    const [errors, setErrors]               = useState({});
    const [submitted, setSubmitted]         = useState(false);
    const [result, setResult]               = useState(null);
    const [isExistingParent, setIsExistingParent] = useState(false);
    const [existingParentId, setExistingParentId] = useState(null);

    const activeSteps = regMode === 'existing' ? STEPS_EXISTING : STEPS_NEW;

    const validate = {
        0: () => true, // mode step validation is handled by the component itself
        1: () => {
            const e = {};
            if (!parentData.name?.trim())    e.name    = 'Full name is required.';
            if (!parentData.phone?.trim())   e.phone   = 'Phone number is required.';
            if (!parentData.address?.trim()) e.address = 'Address is required.';
            setErrors(e);
            return !Object.keys(e).length;
        },
        2: () => {
            const e = {};
            if (!currentChild.firstName?.trim()) e.firstName = 'First name is required.';
            if (!currentChild.lastName?.trim())  e.lastName  = 'Last name is required.';
            if (!currentChild.dob)               e.dob       = 'Date of birth is required.';
            setErrors(e);
            return !Object.keys(e).length;
        },
        3: () => {
            const e = {};
            if (!currentChild.program) e.program = 'Please select a therapy program.';
            if (!currentChild.therapistId) e.therapistId = 'Silakan pilih terapis utama.';
            if (!currentChild.periodStartDate) e.periodStartDate = 'Tanggal mulai periode wajib diisi.';
            if (!Number(currentChild.totalSessions || 0)) e.totalSessions = 'Jumlah sesi wajib diisi.';
            setErrors(e);
            return !Object.keys(e).length;
        },
    };

    const goNext = async () => {
        if (!validate[step]?.()) return;

        if (step === 1 && regMode === 'new') {
            try {
                const res = await parentsApi.getAll();
                const parents = res.data?.data || [];
                const existing = parents.find(p => p.phone === parentData.phone);
                setIsExistingParent(!!existing);
                if (existing) setParentData({ name: existing.name, phone: existing.phone, email: existing.email || '', address: existing.address });
            } catch (e) {
                console.error(e);
            }
        }
        if (step === 3) {
            setChildrenList(prev => [...prev, { ...currentChild }]);
            setCurrentChild(EMPTY_CHILD);
        }
        setErrors({});

        // Determine next step based on mode
        const currentIdx = activeSteps.findIndex(s => s.id === step);
        if (currentIdx < activeSteps.length - 1) {
            setStep(activeSteps[currentIdx + 1].id);
        }
    };

    const goPrev = () => {
        setErrors({});
        const currentIdx = activeSteps.findIndex(s => s.id === step);
        if (currentIdx > 0) {
            setStep(activeSteps[currentIdx - 1].id);
        }
    };

    const handleAddAnother = () => { setCurrentChild(EMPTY_CHILD); setErrors({}); setStep(2); };

    const handleModeSelect = (mode) => {
        setRegMode(mode);
        if (mode === 'new') {
            setIsExistingParent(false);
            setExistingParentId(null);
            setParentData(EMPTY_PARENT);
            setStep(1); // go to parent form
        }
        // For 'existing', the RegistrationModeStep will call onSelectParent
    };

    const handleSelectParent = (parent) => {
        setParentData({ name: parent.name, phone: parent.phone, email: parent.email || '', address: parent.address });
        setIsExistingParent(true);
        setExistingParentId(parent.id);
        setStep(2); // skip parent form, go directly to child info
    };

    const handleSubmit = async () => {
        let parentId;
        let parentObj;
        let isNew = false;
        let tempPassword = null;

        try {
            if (regMode === 'existing' && existingParentId) {
                parentId = existingParentId;
                parentObj = { name: parentData.name };
            } else {
                const res = await parentsApi.create(parentData);
                if (!res.ok || !res.data?.data) {
                    throw new Error(res.data?.error || res.data?.message || 'Gagal membuat akun orang tua.');
                }
                const parent = res.data?.data || {};
                parentId = parent.id || parent.userId;
                parentObj = parent;
                isNew = true;
                tempPassword = parent.tempPassword;
            }

            const registeredChildren = [];
            for (const child of childrenList) {
                const scheduleRules = Array.isArray(child.therapyDays)
                    ? child.therapyDays.map(day => ({
                        day,
                        startTime: child.sessionStartTime || '09:00',
                        duration: `${child.sessionDuration || 60} mins`,
                        therapistId: child.therapistId,
                    }))
                    : [];
                const therapyProgramsList = child.program ? [{
                    programId: child.programId || null,
                    type: child.program,
                    totalSessions: Number(child.totalSessions || 12),
                    goal: child.programGoal || '',
                    startDate: child.periodStartDate,
                    endDate: child.periodEndDate || null,
                    pricePerSession: Number(child.programPricePerSession || 0),
                    pricePerMonth: Number(child.programPricePerMonth || 0),
                    billingMode: child.billingMode || 'per_session',
                    scheduleRules,
                    generateSessions: scheduleRules.length > 0,
                }] : [];
                const childRes = await childrenApi.create({ ...child, parentId, therapyProgramsList });
                if (!childRes.ok || !childRes.data?.data) {
                    throw new Error(childRes.data?.error || childRes.data?.message || `Gagal mendaftarkan ${child.firstName}.`);
                }
                registeredChildren.push(childRes.data.data);
            }

            setResult({
                parentName: parentObj.name || parentData.name,
                tempPassword,
                childCount: childrenList.length,
                isNew,
                isExisting: regMode === 'existing',
                registeredChildren,
            });
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            setErrors({ submit: e.message || 'Registrasi gagal. Periksa koneksi backend dan coba lagi.' });
        }
    };

    const handleReset = () => {
        setStep(0); setRegMode(null); setParentData(EMPTY_PARENT); setCurrentChild(EMPTY_CHILD);
        setChildrenList([]); setErrors({}); setSubmitted(false); setResult(null);
        setIsExistingParent(false); setExistingParentId(null);
    };

    // ── Success screen ─────────────────────────────────────────────
    if (submitted && result) {
        return (
            <main className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-6 bg-background-light dark:bg-background-dark">
                <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Registration Complete!</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        {result.childCount} child record{result.childCount > 1 ? 's' : ''} successfully registered
                        {result.isNew ? ' and a new parent account has been created.'
                            : result.isExisting ? ` and linked to ${result.parentName}'s existing account.`
                            : ' and linked to the existing parent account.'}
                    </p>
                </div>
                {result.isNew && result.tempPassword && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-5 w-full max-w-sm text-left">
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">key</span>
                            Temporary Login Credentials
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Share with the parent. They can change this password after first login.</p>
                        <div className="mt-3 bg-white dark:bg-background-dark rounded-lg p-3 border border-amber-200 dark:border-amber-700 font-mono text-base font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                            {result.tempPassword}
                        </div>
                    </div>
                )}
                {result.registeredChildren && result.registeredChildren.length > 0 && (
                    <div className="w-full max-w-sm text-left">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                            Nomor Induk Terapi Anak (NITA)
                        </p>
                        <div className="flex flex-col gap-2">
                            {result.registeredChildren.map((child, i) => (
                                <div key={child.nita} className="flex items-center justify-between bg-white dark:bg-background-dark border border-slate-200 dark:border-primary/20 rounded-lg px-4 py-3">
                                    <div>
                                        <p className="text-xs text-slate-500">Anak #{i + 1}</p>
                                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{child.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 mb-0.5">NITA</p>
                                        <code className="font-mono text-lg font-bold text-primary tracking-widest">{child.nita}</code>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">NITA digunakan sebagai ID login anak dan primary key sistem.</p>
                    </div>
                )}
                <button onClick={handleReset}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm mt-2">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Register Another Patient
                </button>
            </main>
        );
    }

    // ── Wizard ─────────────────────────────────────────────────────
    const meta = STEP_META[step];
    const childLabel = childrenList.length > 0 && step === 2
        ? `Adding child #${childrenList.length + 1} for ${parentData.name || 'this parent'}`
        : meta.subtitle;

    const isStepValid = (() => {
        if (step === 0) return regMode !== null;
        if (step === 1) return !!parentData.name?.trim() && !!parentData.phone?.trim() && !!parentData.address?.trim();
        if (step === 2) return !!currentChild.firstName?.trim() && !!currentChild.lastName?.trim() && !!currentChild.dob;
        if (step === 3) return !!currentChild.program && !!currentChild.therapistId && !!currentChild.periodStartDate && Number(currentChild.totalSessions || 0) > 0;
        return true;
    })();

    const isLastStep = step === 4;
    const isFirstStep = step === 0;

    return (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8 bg-background-light dark:bg-background-dark">
            {/* Header */}
            <header className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[22px]">how_to_reg</span>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Patient Registration</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Complete the steps below to enroll a new patient family.</p>
                </div>
            </header>

            {/* Stepper */}
            <Stepper steps={activeSteps} currentStep={step} />

            {/* Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">{meta.icon}</span>
                        {meta.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{childLabel}</p>
                </div>

                <div className="p-6">
                    {step === 0 && <RegistrationModeStep onSelectMode={handleModeSelect} onSelectParent={handleSelectParent} />}
                    {step === 1 && <ParentForm data={parentData} onChange={setParentData} errors={errors} />}
                    {step === 2 && <ChildForm  data={currentChild} onChange={setCurrentChild} errors={errors} />}
                    {step === 3 && <ProgramForm data={currentChild} onChange={setCurrentChild} errors={errors} />}
                    {step === 4 && <ReviewStep parentData={parentData} childrenList={childrenList} onAddAnother={handleAddAnother} isExistingParent={isExistingParent} />}
                    {errors.submit && (
                        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {errors.submit}
                        </div>
                    )}
                </div>

                {step !== 0 && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                        <button type="button" onClick={goPrev}
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Back
                        </button>
                        {!isLastStep ? (
                            <button type="button" onClick={goNext} disabled={!isStepValid}
                                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed">
                                Continue
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        ) : (
                            <button type="button" onClick={handleSubmit}
                                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500">
                                <span className="material-symbols-outlined text-[18px]">send</span>
                                Submit Registration
                            </button>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

export default App;
