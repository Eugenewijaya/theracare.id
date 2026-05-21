import React from 'react';
import LanguageSettingsPanel from '../../../shared/ui/LanguageSettingsPanel';

export default function Settings() {
  return (
    <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 lg:border-t-0">
      <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20">
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">Pengaturan</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Kelola preferensi tampilan portal terapis.</p>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <LanguageSettingsPanel />

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Preferensi Portal</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Pengaturan akun klinis seperti jadwal kerja, cuti, dan laporan tetap mengikuti data yang disinkronkan dari sistem utama.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
