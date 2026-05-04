import React from 'react';

const Stepper = () => {
    return (
        <div className="w-full">
            <div className="flex items-center justify-between relative before:absolute before:top-1/2 before:-translate-y-1/2 before:h-0.5 before:w-full before:bg-slate-200 dark:before:bg-slate-700 before:z-0">
                {/* Step 1 */}
                <div className="relative z-10 flex flex-col items-center gap-2 bg-background-light dark:bg-background-dark px-2">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-primary/30 ring-4 ring-background-light dark:ring-background-dark">
                        1
                    </div>
                    <span className="text-sm font-bold text-primary">Personal Info</span>
                </div>

                {/* Step 2 */}
                <div className="relative z-10 flex flex-col items-center gap-2 bg-background-light dark:bg-background-dark px-2">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-500 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold ring-4 ring-background-light dark:ring-background-dark transition-colors">
                        2
                    </div>
                    <span className="text-sm font-medium text-slate-500">Qualifications</span>
                </div>

                {/* Step 3 */}
                <div className="relative z-10 flex flex-col items-center gap-2 bg-background-light dark:bg-background-dark px-2">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-500 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold ring-4 ring-background-light dark:ring-background-dark transition-colors">
                        3
                    </div>
                    <span className="text-sm font-medium text-slate-500">Work Schedule</span>
                </div>

                {/* Step 4 */}
                <div className="relative z-10 flex flex-col items-center gap-2 bg-background-light dark:bg-background-dark px-2">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-500 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold ring-4 ring-background-light dark:ring-background-dark transition-colors">
                        4
                    </div>
                    <span className="text-sm font-medium text-slate-500">Review</span>
                </div>
            </div>
        </div>
    );
};

export default Stepper;
