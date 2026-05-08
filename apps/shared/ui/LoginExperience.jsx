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

const MOTION_CARDS = [
  { icon: 'verified_user', title: 'Secure session', detail: 'Role-based access' },
  { icon: 'clinical_notes', title: 'Reports ready', detail: 'Synced to portal' },
  { icon: 'event_available', title: 'Schedule active', detail: 'Live therapy workflow' },
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
        <section className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-slate-900 px-6 py-7 text-white sm:px-10 lg:min-h-screen">
          <img
            src={photoSrc}
            alt="Temporary special needs center welcome visual"
            className="login-photo-motion absolute inset-0 h-full w-full object-cover opacity-95"
          />
          <div className="absolute inset-0 bg-slate-950/20" />
          <div className="login-scan absolute inset-0 opacity-30" />

          <div className="relative z-10 flex items-center justify-center">
            <div className="flex flex-col items-center text-center">
              <div className="login-logo-orbit relative">
                <img src={logoSrc} alt="Temporary special needs center logo" className="relative z-10 h-20 w-20 login-float" />
              </div>
              <p className="login-fade-up mt-4 text-xs font-bold uppercase tracking-[0.28em] text-white/80">Special Need Center</p>
            </div>
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center text-center login-fade-up login-delay-1">
            <div className="rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur-md login-badge">
              {portalName}
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{subtitle}</h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/80">{description}</p>
            {!started && (
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="login-cta mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/35"
              >
                Get Started
                <span className="material-symbols-outlined text-[18px] login-arrow">arrow_forward</span>
              </button>
            )}
          </div>

          <div className="pointer-events-none absolute left-6 top-[27%] z-10 hidden w-64 flex-col gap-3 xl:flex">
            {MOTION_CARDS.map((card, index) => (
              <div key={card.title} className={`login-status-card login-status-card-${index + 1} flex items-center gap-3 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 backdrop-blur-md`}>
                <span className="material-symbols-outlined text-[22px] text-white">{card.icon}</span>
                <div>
                  <p className="text-xs font-black leading-tight text-white">{card.title}</p>
                  <p className="text-[11px] font-semibold text-white/70">{card.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute bottom-24 right-8 z-10 hidden w-52 rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md lg:block login-progress-card">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
              <span>Portal sync</span>
              <span>Live</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="login-progress h-full rounded-full bg-white" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <span className="login-meter h-9 rounded-xl bg-white/15" />
              <span className="login-meter login-meter-2 h-9 rounded-xl bg-white/15" />
              <span className="login-meter login-meter-3 h-9 rounded-xl bg-white/15" />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-2 text-[11px] font-semibold text-white/70 login-fade-up login-delay-2">
            <span>TheraCare Therapy Platform</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span>Secure Access</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            {!started ? (
              <div className="login-panel-enter rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${tone.soft}`}>
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{tone.icon}</span>
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Mulai akses portal</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Klik Get Started untuk membuka form login. Pilihan ini akan disimpan di browser.</p>
                <button
                  type="button"
                  onClick={() => setStarted(true)}
                  className={`login-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 ${tone.button}`}
                >
                  Get Started
                  <span className="material-symbols-outlined text-[18px] login-arrow">arrow_forward</span>
                </button>
              </div>
            ) : (
              <div className="login-panel-enter rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
                <div className="mb-6 flex flex-col items-center text-center">
                  <img src={logoSrc} alt="Temporary special needs center logo" className="h-16 w-16" />
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
        @keyframes photoDrift {
          0%, 100% { transform: scale(1.03) translate3d(0, 0, 0); }
          50% { transform: scale(1.08) translate3d(-14px, 10px, 0); }
        }
        @keyframes scanMove {
          0% { background-position: 0 0; }
          100% { background-position: 72px 72px; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelEnter {
          from { opacity: 0; transform: translateY(22px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes orbitPulse {
          0%, 100% { transform: scale(.95); opacity: .32; }
          50% { transform: scale(1.14); opacity: .62; }
        }
        @keyframes statusSlide {
          0%, 100% { transform: translateX(0); opacity: .82; }
          50% { transform: translateX(16px); opacity: 1; }
        }
        @keyframes progressSweep {
          0% { transform: translateX(-58%); }
          55%, 100% { transform: translateX(0); }
        }
        @keyframes meterRise {
          0%, 100% { transform: scaleY(.42); opacity: .55; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes arrowNudge {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: 0 0 32px rgba(255,255,255,.22); }
        }
        .login-photo-motion {
          animation: photoDrift 16s ease-in-out infinite;
          will-change: transform;
        }
        .login-scan {
          background-image:
            linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px);
          background-size: 72px 72px;
          animation: scanMove 18s linear infinite;
        }
        .login-fade-up {
          animation: fadeUp .76s cubic-bezier(.2,.7,.2,1) both;
        }
        .login-delay-1 { animation-delay: .16s; }
        .login-delay-2 { animation-delay: .32s; }
        .login-float {
          animation: loginFloat 5.5s ease-in-out infinite;
        }
        .login-logo-orbit::before,
        .login-logo-orbit::after {
          content: '';
          position: absolute;
          inset: -14px;
          border: 1px solid rgba(255,255,255,.45);
          border-radius: 28px;
          animation: orbitPulse 4.8s ease-in-out infinite;
        }
        .login-logo-orbit::after {
          inset: -25px;
          animation-delay: 1.3s;
          opacity: .22;
        }
        .login-badge {
          animation: badgeGlow 3.6s ease-in-out infinite;
        }
        .login-panel-enter {
          animation: panelEnter .66s cubic-bezier(.2,.7,.2,1) both;
        }
        .login-status-card {
          animation: statusSlide 6.5s ease-in-out infinite;
          box-shadow: 0 18px 45px rgba(15,23,42,.16);
        }
        .login-status-card-2 { animation-delay: 1.15s; margin-left: 36px; }
        .login-status-card-3 { animation-delay: 2.1s; margin-left: 14px; }
        .login-progress-card {
          animation: fadeUp .9s cubic-bezier(.2,.7,.2,1) .28s both;
        }
        .login-progress {
          width: 100%;
          transform-origin: left;
          animation: progressSweep 3.8s ease-in-out infinite;
        }
        .login-meter {
          display: block;
          transform-origin: bottom;
          animation: meterRise 2.8s ease-in-out infinite;
        }
        .login-meter-2 { animation-delay: .42s; }
        .login-meter-3 { animation-delay: .82s; }
        .login-cta:hover .login-arrow,
        .login-cta:focus-visible .login-arrow {
          animation: arrowNudge .7s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-photo-motion,
          .login-scan,
          .login-fade-up,
          .login-float,
          .login-logo-orbit::before,
          .login-logo-orbit::after,
          .login-badge,
          .login-panel-enter,
          .login-status-card,
          .login-progress-card,
          .login-progress,
          .login-meter,
          .login-cta:hover .login-arrow,
          .login-cta:focus-visible .login-arrow {
            animation: none;
          }
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
