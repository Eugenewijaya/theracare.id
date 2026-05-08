import React, { useEffect, useState } from 'react';
import logoSrc from '../assets/login-logo.svg';
import photoSrc from '../assets/login-photo.svg';

const TONES = {
  admin: {
    accent: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    ring: 'focus:ring-blue-500/20 focus:border-blue-500',
    soft: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: 'admin_panel_settings',
  },
  parent: {
    accent: 'text-sky-700',
    button: 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-500',
    ring: 'focus:ring-sky-500/20 focus:border-sky-500',
    soft: 'bg-sky-50 text-sky-700 border-sky-100',
    icon: 'family_restroom',
  },
  therapist: {
    accent: 'text-teal-700',
    button: 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-500',
    ring: 'focus:ring-teal-500/20 focus:border-teal-500',
    soft: 'bg-teal-50 text-teal-700 border-teal-100',
    icon: 'psychology',
  },
};

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Copyright', href: '/copyright' },
  { label: 'Support', href: 'mailto:support@theracare.id' },
];

export default function LoginExperience({
  portalKey,
  portalName,
  subtitle,
  description,
  formTitle = 'Masuk ke akun',
  formDescription = 'Gunakan akun yang sudah didaftarkan oleh admin.',
  submitLabel = 'Masuk',
  loadingLabel = 'Memverifikasi...',
  remember,
  onRememberChange,
  error,
  isLoading,
  onSubmit,
  children,
}) {
  const tone = TONES[portalKey] || TONES.admin;
  const startedKey = `theracare.login.started.${portalKey}`;
  const [started, setStarted] = useState(() => {
    try {
      return localStorage.getItem(startedKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (started) {
      try { localStorage.setItem(startedKey, 'true'); } catch {}
    }
  }, [started, startedKey]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(390px,0.9fr)_minmax(460px,1.1fr)]">
        <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-slate-900 px-6 py-7 text-white sm:px-10 lg:min-h-screen">
          <img
            src={photoSrc}
            alt="Temporary clinic welcome visual"
            className="absolute inset-0 h-full w-full object-cover opacity-95"
          />
          <div className="absolute inset-0 bg-slate-950/20" />

          <div className="relative z-10 flex items-center justify-center">
            <div className="flex flex-col items-center text-center">
              <img src={logoSrc} alt="Temporary clinic logo" className="h-20 w-20 login-float" />
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.28em] text-white/80">Special Need Center</p>
            </div>
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center text-center">
            <div className="rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur-md">
              {portalName}
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{subtitle}</h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/78">{description}</p>
            {!started && (
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/35"
              >
                Get Started
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}
          </div>

          <div className="relative z-10 flex items-center justify-center gap-2 text-[11px] font-semibold text-white/65">
            <span>TheraCare Clinical Platform</span>
            <span className="h-1 w-1 rounded-full bg-white/45" />
            <span>Secure Access</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            {!started ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${tone.soft}`}>
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{tone.icon}</span>
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Mulai akses portal</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Klik Get Started untuk membuka form login. Pilihan ini akan disimpan di browser.</p>
                <button
                  type="button"
                  onClick={() => setStarted(true)}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 ${tone.button}`}
                >
                  Get Started
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
                <div className="mb-6 flex flex-col items-center text-center">
                  <img src={logoSrc} alt="Temporary clinic logo" className="h-16 w-16" />
                  <p className={`mt-4 text-xs font-black uppercase tracking-[0.22em] ${tone.accent}`}>{portalName}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{formTitle}</h2>
                  <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">{formDescription}</p>
                </div>

                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                  {children}

                  {error && (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                      {error}
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => onRememberChange?.(event.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-500/20"
                    />
                    <span className="text-sm font-semibold text-slate-600">Simpan login di perangkat ini</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${tone.button}`}
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        {loadingLabel}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">login</span>
                        {submitLabel}
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            <footer className="mt-6 text-center">
              <p className="text-xs font-semibold text-slate-400">Copyright 2026 Evid Wijaya. All rights reserved.</p>
              <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
                {LEGAL_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="hover:text-slate-900">
                    {link.label}
                  </a>
                ))}
              </nav>
            </footer>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .login-float {
          animation: loginFloat 5.5s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}

export function LoginInput({ id, label, icon, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}

export const loginInputClassName = 'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
