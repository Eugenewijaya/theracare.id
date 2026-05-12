import React from 'react';

export default function FriendlyLoader({
  title = 'Sebentar ya',
  message = 'Kami sedang menyiapkan ruang kerjamu.',
  compact = false,
}) {
  return (
    <div className={`flex ${compact ? 'py-8' : 'min-h-full'} items-center justify-center bg-slate-50 dark:bg-slate-950`}>
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-[1.65rem] bg-sky-100 shadow-inner dark:bg-sky-900/40" />
          <div className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lg ring-1 ring-sky-100 dark:bg-slate-900 dark:ring-slate-700">
            <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[25px] text-sky-600 dark:text-sky-300">
              favorite
            </span>
          </div>
          <span className="theracare-loader-dot absolute left-1 top-7 h-3 w-3 rounded-full bg-emerald-400" />
          <span className="theracare-loader-dot absolute right-2 top-4 h-3 w-3 rounded-full bg-amber-400 [animation-delay:120ms]" />
          <span className="theracare-loader-dot absolute bottom-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-sky-500 [animation-delay:240ms]" />
        </div>
        <div>
          <p className="text-base font-black text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
        </div>
      </div>
      <style>{`
        .theracare-loader-dot {
          animation: theracareBounce 900ms ease-in-out infinite;
        }
        @keyframes theracareBounce {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.65; }
          50% { transform: translateY(-9px) scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
