import React from 'react';

const RequestCard = ({ name, parentName, session, date, reason, slots, submittedAgo, approveDisabled, onReject, onProcess, onApprove }) => {
    return (
        <div className="bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/20 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 flex-1">
                {/* Status Badge */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">pending_actions</span>
                            Pending
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">{submittedAgo}</span>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                </div>

                {/* Requester */}
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    {name} <span className="text-slate-500 dark:text-slate-400 text-base font-normal">(Parent: {parentName})</span>
                </h3>

                {/* Original Session Info */}
                <div className="bg-slate-50 dark:bg-background-dark/50 rounded-lg p-4 mb-4 border border-slate-100 dark:border-primary/10 mt-4">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">event</span>
                        Original Session
                    </h4>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">{session}</p>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">{date}</p>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-primary/20">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">info</span>
                            Reason for Change
                        </h4>
                        <p className="text-slate-700 dark:text-slate-300 text-sm italic">"{reason}"</p>
                    </div>
                </div>

                {/* Proposed Slots */}
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Proposed Alternate Slots:</h4>
                <div className="flex flex-col gap-2">
                    {slots.map((slot, i) => (
                        <label key={i} className="flex items-center p-3 border border-slate-200 dark:border-primary/30 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-primary/10 transition-colors">
                            <input type="radio" name={`slot_${name.replace(/\s/g, '_')}`} className="text-primary focus:ring-primary h-4 w-4 border-slate-300 dark:border-primary/50 bg-transparent" />
                            <span className="ml-3 text-sm text-slate-700 dark:text-slate-200 font-medium flex-1">{slot.time}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${slot.status === 'available'
                                    ? 'text-green-600 dark:text-primary bg-green-100 dark:bg-primary/20'
                                    : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
                                }`}>
                                {slot.status === 'available' ? 'Tutor Available' : 'Conflict'}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 dark:bg-background-dark/80 p-4 border-t border-slate-200 dark:border-primary/20 flex justify-end gap-3">
                <button 
                    onClick={onReject}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                    Reject
                </button>
                <button 
                    onClick={onProcess}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg hover:bg-slate-50 dark:hover:bg-primary/20 transition-colors"
                >
                    Process
                </button>
                <button 
                    onClick={onApprove}
                    disabled={approveDisabled}
                    className={`px-5 py-2 text-sm font-bold text-background-dark bg-primary rounded-lg shadow-sm transition-colors ${approveDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'}`}
                >
                    Approve Selected
                </button>
            </div>
        </div>
    );
};

export default RequestCard;
