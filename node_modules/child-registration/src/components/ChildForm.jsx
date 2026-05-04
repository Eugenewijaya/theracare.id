import React from 'react';

const ChildForm = ({ data, onChange, errors }) => {
    const handle = (e) => onChange({ ...data, [e.target.name]: e.target.value });
    const inputClass = (field) =>
        `w-full h-12 px-4 rounded-lg border ${errors?.[field] ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div className="flex flex-col gap-2">
                <label htmlFor="cFirst" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    First Name <span className="text-red-500">*</span>
                </label>
                <input id="cFirst" name="firstName" type="text" value={data.firstName || ''} onChange={handle}
                    className={inputClass('firstName')} placeholder="Enter first name" />
                {errors?.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="cLast" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Last Name <span className="text-red-500">*</span>
                </label>
                <input id="cLast" name="lastName" type="text" value={data.lastName || ''} onChange={handle}
                    className={inputClass('lastName')} placeholder="Enter last name" />
                {errors?.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="cDob" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Date of Birth <span className="text-red-500">*</span>
                </label>
                <input id="cDob" name="dob" type="date" value={data.dob || ''} onChange={handle}
                    className={`${inputClass('dob')} [&::-webkit-calendar-picker-indicator]:opacity-50 dark:[&::-webkit-calendar-picker-indicator]:invert`} />
                {errors?.dob && <p className="text-xs text-red-500">{errors.dob}</p>}
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="cGender" className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</label>
                <select id="cGender" name="gender" value={data.gender || ''} onChange={handle}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow appearance-none cursor-pointer">
                    <option value="" disabled>Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="cSchool" className="text-sm font-medium text-slate-700 dark:text-slate-300">Current School</label>
                <input id="cSchool" name="school" type="text" value={data.school || ''} onChange={handle}
                    className={inputClass('school')} placeholder="e.g. SDN Merdeka 01" />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
                <label htmlFor="cDiag" className="text-sm font-medium text-slate-700 dark:text-slate-300">Primary Diagnosis / Condition</label>
                <textarea id="cDiag" name="diagnosis" rows="3" value={data.diagnosis || ''} onChange={handle}
                    className="w-full p-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow resize-y"
                    placeholder="Briefly describe the child's primary diagnosis or condition requiring therapy..." />
            </div>
        </div>
    );
};

export default ChildForm;
