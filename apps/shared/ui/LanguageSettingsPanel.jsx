import React, { useEffect, useState } from 'react';
import {
  getLanguageMeta,
  LANGUAGE_CHANGED_EVENT,
  readLanguage,
  SUPPORTED_LANGUAGES,
  translatePhrase,
  writeLanguage,
} from '../i18n/language';

export default function LanguageSettingsPanel({ compact = false }) {
  const [language, setLanguage] = useState(() => readLanguage());

  useEffect(() => {
    const sync = (event) => setLanguage(event.detail?.language || readLanguage());
    window.addEventListener(LANGUAGE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(LANGUAGE_CHANGED_EVENT, sync);
  }, []);

  const updateLanguage = (nextLanguage) => {
    setLanguage(writeLanguage(nextLanguage));
  };
  const copy = (text) => translatePhrase(text, language) || text;
  const activeLanguage = getLanguageMeta(language);

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">{copy('Bahasa Tampilan')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {copy('Pilih bahasa portal. Istilah umum seperti Dashboard, email, dan WhatsApp tetap dipertahankan jika lebih familiar.')}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
            {copy('Default sistem: Bahasa Indonesia.')}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <span className="material-symbols-outlined text-[14px]">translate</span>
          {copy('Aktif')}: <span data-no-translate>{activeLanguage.shortLabel}</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SUPPORTED_LANGUAGES.map((item) => {
          const active = item.code === language;
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => updateLanguage(item.code)}
              aria-pressed={active}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                active
                  ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500/10 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-200 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{active ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
              <span className="flex flex-col leading-tight" data-no-translate>
                <span>{item.shortLabel}</span>
                {item.nativeLabel && item.nativeLabel !== item.shortLabel ? (
                  <span className="text-[10px] font-bold opacity-70">{item.nativeLabel}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
