import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const toneMap = {
  danger: {
    icon: 'warning',
    ring: 'bg-red-50 text-red-600 border-red-100',
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  warning: {
    icon: 'priority_high',
    ring: 'bg-amber-50 text-amber-700 border-amber-100',
    button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
  info: {
    icon: 'info',
    ring: 'bg-sky-50 text-sky-700 border-sky-100',
    button: 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500',
  },
  success: {
    icon: 'check_circle',
    ring: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
  },
};

function Dialog({
  title,
  message,
  details,
  tone = 'warning',
  icon,
  confirmText = 'Lanjutkan',
  cancelText = 'Batal',
  requireText = false,
  inputLabel,
  inputPlaceholder,
  templates = [],
  confirmOnly = false,
  onResolve,
}) {
  const config = toneMap[tone] || toneMap.warning;
  const [input, setInput] = useState('');
  const canConfirm = !requireText || input.trim().length >= 8;
  const selectedIcon = icon || config.icon;
  const normalizedTemplates = useMemo(() => templates.filter(Boolean), [templates]);

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900"
        style={{ animation: 'theracareDialogIn 180ms ease-out' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${config.ring}`}>
            <span className="material-symbols-outlined text-[24px]">{selectedIcon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black leading-tight text-slate-950 dark:text-white">{title || 'Konfirmasi tindakan'}</h2>
            {message && <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>}
            {details && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {details}
              </div>
            )}
          </div>
        </div>

        {(inputLabel || requireText || normalizedTemplates.length > 0) && (
          <div className="border-y border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
            {normalizedTemplates.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {normalizedTemplates.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setInput(template)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {template}
                  </button>
                ))}
              </div>
            )}
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {inputLabel || 'Catatan'}
            </label>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={4}
              placeholder={inputPlaceholder || 'Tulis alasan atau catatan singkat...'}
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-sky-900/30"
              autoFocus
            />
            {requireText && (
              <p className={`mt-2 text-xs font-semibold ${canConfirm ? 'text-emerald-600' : 'text-slate-400'}`}>
                Minimal 8 karakter agar alasan cukup jelas.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:p-5">
          {!confirmOnly && (
            <button
              type="button"
              onClick={() => onResolve({ confirmed: false, input: '' })}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onResolve({ confirmed: true, input: input.trim() })}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${config.button}`}
          >
            {confirmText}
          </button>
        </div>

        <style>{`
          @keyframes theracareDialogIn {
            from { opacity: 0; transform: translateY(10px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}

function renderDialog(options) {
  if (typeof document === 'undefined') {
    return Promise.resolve({ confirmed: false, input: '' });
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  const cleanup = () => {
    root.unmount();
    host.remove();
  };

  return new Promise((resolve) => {
    root.render(
      <Dialog
        {...options}
        onResolve={(result) => {
          cleanup();
          resolve(result);
        }}
      />
    );
  });
}

export async function confirmAction(options = {}) {
  const result = await renderDialog(options);
  return result.confirmed ? result : false;
}

export async function notifyDialog(options = {}) {
  await renderDialog({
    tone: 'info',
    confirmOnly: true,
    confirmText: 'Oke',
    ...options,
  });
}
