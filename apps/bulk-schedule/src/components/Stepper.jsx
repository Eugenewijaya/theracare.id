import React from 'react';

const STEPS = ['Criteria', 'Frequency', 'Timing', 'Preview'];

const Stepper = ({ currentStep }) => {
    return (
        <nav aria-label="Progress">
            <ol className="flex items-center" role="list">
                {STEPS.map((label, index) => {
                    const stepNum = index + 1;
                    const isCompleted = stepNum < currentStep;
                    const isCurrent   = stepNum === currentStep;
                    const isUpcoming  = stepNum > currentStep;
                    const isLast      = index === STEPS.length - 1;

                    return (
                        <li key={label} className={`relative ${!isLast ? 'pr-8 sm:pr-20' : ''}`}>
                            {/* Connector line */}
                            {!isLast && (
                                <div aria-hidden="true" className="absolute inset-0 flex items-center">
                                    <div className={`h-0.5 w-full ${isCompleted ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'} transition-colors duration-300`} />
                                </div>
                            )}

                            {/* Step bubble */}
                            {isCompleted ? (
                                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                                    <span className="material-symbols-outlined text-slate-900 text-sm">check</span>
                                    <span className="sr-only">{label} - Completed</span>
                                </span>
                            ) : isCurrent ? (
                                <span aria-current="step" className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-white dark:bg-slate-900 shadow-sm">
                                    <span className="text-primary text-sm font-bold">{stepNum}</span>
                                    <span className="sr-only">{label} - Current</span>
                                </span>
                            ) : (
                                <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stepNum}</span>
                                    <span className="sr-only">{label} - Upcoming</span>
                                </span>
                            )}

                            {/* Step label */}
                            <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap ${
                                isCurrent  ? 'text-primary' :
                                isCompleted ? 'text-slate-700 dark:text-slate-300' :
                                'text-slate-500 dark:text-slate-400'
                            }`}>
                                {label}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Stepper;

