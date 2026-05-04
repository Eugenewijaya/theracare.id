import React from 'react';

const Stepper = ({ steps, currentStep }) => {
    const progressPct = ((currentStep - 1) / (steps.length - 1)) * 100;
    return (
        <div className="relative w-full px-6">
            <div aria-hidden="true" className="absolute inset-0 flex items-center px-14">
                <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full">
                    <div className="h-1 bg-primary rounded-full transition-all duration-500 ease-in-out" style={{ width: `${progressPct}%` }} />
                </div>
            </div>
            <ol className="relative z-10 flex justify-between items-center text-sm font-medium">
                {steps.map((step) => {
                    const done = step.id < currentStep;
                    const active = step.id === currentStep;
                    return (
                        <li key={step.id} className="flex flex-col items-center gap-3 bg-background-light dark:bg-background-dark px-2">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 text-sm font-bold ${
                                done    ? 'bg-primary text-white shadow-sm shadow-primary/30' :
                                active  ? 'bg-primary text-white shadow-md ring-4 ring-primary/20' :
                                          'border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                            }`}>
                                {done ? <span className="material-symbols-outlined text-[20px]">check</span> : step.id}
                            </div>
                            <span className={`text-xs transition-colors duration-300 ${
                                active ? 'text-primary font-bold' : done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                            }`}>{step.name}</span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

export default Stepper;
