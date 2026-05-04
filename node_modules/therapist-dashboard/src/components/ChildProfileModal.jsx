import React from 'react';

const ChildProfileModal = ({ session, onClose }) => {
    if (!session || !session.child) return null;

    const { child, parent } = session;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 flex justify-between items-start relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-black/10">
                            {child.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-white">
                            <h2 className="text-2xl font-bold leading-tight">{child.name}</h2>
                            <p className="text-teal-100 font-medium text-sm flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">child_care</span>
                                NITA: {child.nita || child.id}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
                    
                    {/* Child Biodata Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">person</span>
                            Child Biodata
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Date of Birth</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{child.dob || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Gender</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{child.gender || 'Not provided'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Active Programs</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {(child.programs || []).length > 0 ? (
                                        child.programs.map((p, idx) => (
                                            <span key={idx} className="bg-teal-100/50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-lg text-xs font-bold border border-teal-200/50 dark:border-teal-800/50">
                                                {p.name || p}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-slate-500 font-medium">None</span>
                                    )}
                                </div>
                            </div>
                            {child.notes && (
                                <div className="col-span-2 mt-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Special Notes</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        {child.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Parent Contact Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">family_restroom</span>
                            Parent Contact Info
                        </h3>
                        {parent ? (
                            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30 flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner">
                                        {parent.firstName ? parent.firstName.charAt(0) : <span className="material-symbols-outlined text-[20px]">person</span>}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{parent.firstName} {parent.lastName}</p>
                                        <p className="text-xs font-medium text-slate-500">Primary Contact</p>
                                    </div>
                                </div>
                                <div className="grid gap-3 pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-[18px] text-blue-500 flex-shrink-0 mt-0.5">call</span>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Phone Number</p>
                                            <a href={`tel:${parent.phone}`} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                {parent.phone || 'Not provided'}
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-[18px] text-blue-500 flex-shrink-0 mt-0.5">location_on</span>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Address</p>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                                                {parent.address || 'Not provided'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center justify-center text-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-3xl">sentiment_dissatisfied</span>
                                <p className="text-sm font-medium text-slate-500">Parent information is not linked for this child.</p>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer Action */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChildProfileModal;
