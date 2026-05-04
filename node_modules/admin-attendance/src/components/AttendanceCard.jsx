import React, { useState, useEffect } from 'react';

/* ──────────────────────────────────────────────
   Confirmation Modal (rendered inside card)
────────────────────────────────────────────── */
function ConfirmModal({ name, type, onConfirm, onCancel }) {
    const isApprove = type === 'approve';
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl">
            <div className="flex flex-col items-center gap-4 px-6 text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isApprove ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <span className={`material-symbols-outlined text-3xl ${isApprove ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isApprove ? 'help' : 'warning'}
                    </span>
                </div>
                <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">
                        {isApprove ? `Approve attendance for` : `Reject attendance for`}
                    </p>
                    <p className="text-primary font-bold text-base">{name}?</p>
                </div>
                <div className="flex gap-2 w-full">
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-2 rounded-lg text-white text-sm font-bold transition-colors ${isApprove ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                    >
                        {isApprove ? 'Yes, Approve' : 'Yes, Reject'}
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────
   AttendanceCard
────────────────────────────────────────────── */
const AttendanceCard = ({ name, role, avatar, checkedIn, scheduled, status, statusColor, onApprove, onReject }) => {
    const isLate = statusColor === 'yellow';
    const isCritical = statusColor === 'red';

    // States: 'idle' | 'confirmApprove' | 'confirmReject' | 'approved' | 'rejected'
    const [cardState, setCardState] = useState('idle');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastFading, setToastFading] = useState(false);

    /* Show fade-in/out toast when rejection is "cancelled" by the user */
    const showCancelToast = () => {
        setToastVisible(true);
        setToastFading(false);
        setTimeout(() => setToastFading(true), 1800);
        setTimeout(() => setToastVisible(false), 2400);
    };

    const handleApproveClick = () => setCardState('confirmApprove');
    const handleRejectClick = () => setCardState('confirmReject');

    const handleConfirm = () => {
        if (cardState === 'confirmApprove') {
            setCardState('approved');
            setTimeout(() => onApprove(), 900);
        } else {
            setCardState('rejected');
            setTimeout(() => onReject(), 600);
        }
    };

    const handleCancel = () => {
        setCardState('idle');
        if (cardState === 'confirmReject') {
            // "Cancelled" reject → toast saying child IS present
            showCancelToast();
        }
    };

    /* ── style helpers ── */
    const borderClass = isCritical
        ? 'border-red-200 dark:border-red-900/50'
        : 'border-slate-200 dark:border-slate-800';

    const topBarClass = isCritical ? 'bg-red-500' : isLate ? 'bg-yellow-400' : '';

    const badgeClass = isCritical
        ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20'
        : isLate
            ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20'
            : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20';

    const timeInfoBg = isCritical
        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800';

    const checkedInColor = isCritical
        ? 'text-red-600 dark:text-red-400 font-bold'
        : isLate
            ? 'text-yellow-600 dark:text-yellow-400 font-semibold'
            : 'text-slate-900 dark:text-white font-semibold';

    const isConfirming = cardState === 'confirmApprove' || cardState === 'confirmReject';

    return (
        <div
            className={`bg-white dark:bg-background-dark rounded-xl border ${borderClass} p-5 flex flex-col gap-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden
                ${cardState === 'approved' ? 'scale-95 opacity-0 duration-700' : 'scale-100 opacity-100'}
                ${cardState === 'rejected' ? 'opacity-0 duration-500' : ''}
            `}
            style={{ transition: 'opacity 0.6s ease, transform 0.6s ease' }}
        >
            {(isLate || isCritical) && (
                <div className={`absolute top-0 left-0 right-0 h-1 ${topBarClass}`}></div>
            )}

            {/* ── Confirmation overlay ── */}
            {isConfirming && (
                <ConfirmModal
                    name={name}
                    type={cardState === 'confirmApprove' ? 'approve' : 'reject'}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}

            {/* ── "Approved / checked-in" overlay ── */}
            {cardState === 'approved' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-green-50/90 dark:bg-green-900/40 rounded-xl gap-2">
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center animate-bounce">
                        <span className="material-symbols-outlined text-white text-4xl">check</span>
                    </div>
                    <p className="text-green-700 dark:text-green-300 font-bold text-sm">{name} is present ✓</p>
                </div>
            )}

            {/* ── Fade toast (rejection cancelled) ── */}
            {toastVisible && (
                <div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-lg"
                    style={{
                        transition: 'opacity 0.5s ease',
                        opacity: toastFading ? 0 : 1,
                    }}
                >
                    ✅ {name} is still marked as present.
                </div>
            )}

            {/* Top Row */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-full bg-cover bg-center border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                        title={name}
                        style={{ backgroundImage: `url('${avatar}')` }}
                    ></div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{role}</p>
                    </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${badgeClass}`}>
                    {isCritical && <span className="material-symbols-outlined text-[14px]">warning</span>}
                    {status}
                </span>
            </div>

            {/* Time Info */}
            <div className={`rounded-lg p-3 grid grid-cols-2 gap-4 border ${timeInfoBg}`}>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Checked-in</p>
                    <p className={`text-sm ${checkedInColor}`}>{checkedIn}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Scheduled</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{scheduled}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-auto pt-2">
                <button
                    onClick={handleApproveClick}
                    disabled={isConfirming || cardState === 'approved'}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    Approve
                </button>
                <button
                    onClick={handleRejectClick}
                    disabled={isConfirming || cardState === 'approved'}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-lg">cancel</span>
                    Reject
                </button>
            </div>
        </div>
    );
};

export default AttendanceCard;
