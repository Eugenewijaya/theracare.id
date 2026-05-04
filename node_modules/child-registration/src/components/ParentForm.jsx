import React from 'react';

const ParentForm = ({ data, onChange, errors }) => {
    const handle = (e) => onChange({ ...data, [e.target.name]: e.target.value });
    const inputClass = (field) =>
        `w-full h-12 px-4 rounded-lg border ${errors?.[field] ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <div className="flex flex-col gap-2 md:col-span-2">
                <label htmlFor="pName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full Name <span className="text-red-500">*</span>
                </label>
                <input id="pName" name="name" type="text" value={data.name || ''} onChange={handle}
                    className={inputClass('name')} placeholder="Parent or guardian full name" />
                {errors?.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="pPhone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Phone Number <span className="text-red-500">*</span>
                </label>
                <input id="pPhone" name="phone" type="tel" value={data.phone || ''} onChange={handle}
                    className={inputClass('phone')} placeholder="e.g. 0812-3456-7890" />
                {errors?.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="pEmail" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email <span className="text-slate-400 text-xs font-normal">(optional)</span>
                </label>
                <input id="pEmail" name="email" type="email" value={data.email || ''} onChange={handle}
                    className={inputClass('email')} placeholder="email@example.com" />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
                <label htmlFor="pAddress" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Address <span className="text-red-500">*</span>
                </label>
                <textarea id="pAddress" name="address" rows="3" value={data.address || ''} onChange={handle}
                    className={`w-full p-4 rounded-lg border ${errors?.address ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow resize-y`}
                    placeholder="Full home / domicile address..." />
                {errors?.address && <p className="text-xs text-red-500">{errors.address}</p>}
            </div>
        </div>
    );
};

export default ParentForm;
