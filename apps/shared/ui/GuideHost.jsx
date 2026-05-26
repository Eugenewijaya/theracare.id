import React, { useEffect, useMemo, useState } from 'react';
import { getFeatureGuideForPath, getRoleGuide } from '../roleGuides.js';

const GUIDE_EVENT = 'theracare-guide-open';
const GUIDE_SESSION_PREFIX = 'theracare_guide_session';
const GUIDE_SEEN_PREFIX = 'theracare_guide_seen';

function getUserId(user) {
  return user?.id || user?.userId || user?.parentId || user?.therapistId || 'anonymous';
}

function getGuideSessionKey(role, userId) {
  return `${GUIDE_SESSION_PREFIX}:${role}:${userId}`;
}

function getGuideSeenKey(role, userId) {
  return `${GUIDE_SEEN_PREFIX}:${role}:${userId}`;
}

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {}
}

function FlowGraph({ nodes = [] }) {
  if (!nodes.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Grafik alur</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {nodes.map((node, index) => (
          <React.Fragment key={`${node}-${index}`}>
            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {node}
            </span>
            {index < nodes.length - 1 && (
              <span className="material-symbols-outlined text-[18px] text-slate-400">chevron_right</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function FeatureInfoButton({ role, featureId, className = '' }) {
  if (!featureId) return null;
  const openGuide = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: { role, featureId } }));
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') openGuide(event);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={openGuide}
      onKeyDown={handleKeyDown}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/15 text-current/70 transition hover:bg-current/10 hover:text-current focus:outline-none focus:ring-2 focus:ring-current/30 ${className}`}
      title="Cara menggunakan fitur ini"
      aria-label="Cara menggunakan fitur ini"
    >
      <span className="material-symbols-outlined text-[16px]">info</span>
    </span>
  );
}

function GuideModal({ guide, selectedId, onSelect, onClose }) {
  const selected = guide.features.find((feature) => feature.id === selectedId) || guide.features[0];
  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90dvh] w-[min(980px,100%)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-300">Panduan fitur</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">{guide.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{guide.intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Tutup panduan"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr]">
          <div className="max-h-[36dvh] overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60 md:max-h-none md:border-b-0 md:border-r">
            <div className="flex flex-col gap-1">
              {guide.features.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => onSelect(feature.id)}
                  className={`rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                    selected.id === feature.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {feature.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                <span className="material-symbols-outlined">info</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black">{selected.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.purpose}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Cara melakukan aksi/pengisian</p>
              <ol className="mt-3 space-y-2">
                {selected.steps.map((step, index) => (
                  <li key={`${selected.id}-step-${index}`} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <FlowGraph nodes={selected.flow} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TourOverlay({ guide, index, onNext, onSkip }) {
  const step = guide.tour[index];
  const isLast = index >= guide.tour.length - 1;
  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[205] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[2px]">
      <div className="pointer-events-none absolute inset-x-4 top-[18%] mx-auto h-[min(280px,34dvh)] max-w-4xl rounded-3xl border-2 border-cyan-300/90 bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.40)]" />
      <div className="relative w-[min(520px,100%)] rounded-2xl border border-white/20 bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-white">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200">
            <span className="material-symbols-outlined">tips_and_updates</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
              Tutorial awal {index + 1}/{guide.tour.length}
            </p>
            <h2 className="mt-1 text-lg font-black">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.body}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {guide.tour.map((item, itemIndex) => (
              <span
                key={item.title}
                className={`h-2 rounded-full transition-all ${itemIndex === index ? 'w-7 bg-cyan-600' : 'w-2 bg-slate-300 dark:bg-slate-700'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Lewati
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white hover:bg-cyan-700"
            >
              {isLast ? 'Selesai' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuideHost({ role, user, currentPath = '/' }) {
  const guide = getRoleGuide(role);
  const userId = getUserId(user);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const keys = useMemo(() => ({
    session: getGuideSessionKey(role, userId),
    seen: getGuideSeenKey(role, userId),
  }), [role, userId]);
  const currentFeature = useMemo(() => (
    getFeatureGuideForPath(role, currentPath) || guide?.features[0] || null
  ), [currentPath, guide, role]);

  useEffect(() => {
    if (!guide) return undefined;
    const handleGuideOpen = (event) => {
      const detail = event.detail || {};
      if (detail.role && detail.role !== role) return;
      setSelectedId(detail.featureId || guide.features[0]?.id || '');
      setTourOpen(false);
      setOpen(true);
    };
    window.addEventListener(GUIDE_EVENT, handleGuideOpen);
    return () => window.removeEventListener(GUIDE_EVENT, handleGuideOpen);
  }, [guide, role]);

  useEffect(() => {
    if (!guide || !userId) return;
    setSelectedId((current) => current || currentFeature?.id || guide.features[0]?.id || '');
    const alreadyThisSession = readStorage(sessionStorage, keys.session);
    const alreadySeen = readStorage(localStorage, keys.seen);
    if (!alreadyThisSession && !alreadySeen) {
      writeStorage(sessionStorage, keys.session, new Date().toISOString());
      setTourIndex(0);
      setTourOpen(true);
    }
  }, [currentFeature?.id, guide, keys.seen, keys.session, userId]);

  if (!guide) return null;

  const markSeen = () => {
    const value = new Date().toISOString();
    writeStorage(sessionStorage, keys.session, value);
    writeStorage(localStorage, keys.seen, value);
  };

  const completeTour = () => {
    markSeen();
    setTourOpen(false);
  };

  const nextTour = () => {
    if (tourIndex >= guide.tour.length - 1) {
      completeTour();
      return;
    }
    setTourIndex((value) => value + 1);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedId(currentFeature?.id || guide.features[0]?.id || '');
          setOpen(true);
        }}
        className="absolute right-4 top-4 z-[170] inline-flex max-w-[min(320px,calc(100%-32px))] items-center gap-2 rounded-full border border-blue-200 bg-white px-3.5 py-2 text-xs font-black text-blue-700 shadow-lg shadow-blue-900/10 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800"
        title={`Panduan fitur: ${currentFeature?.label || guide.title}`}
      >
        <span className="pointer-events-none absolute -inset-1 rounded-full bg-blue-400/20 opacity-70 motion-safe:animate-ping" />
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <span className="material-symbols-outlined text-[17px]">info</span>
        </span>
        <span className="relative min-w-0 truncate">
          <span>Panduan</span>
          {currentFeature?.label && <span className="hidden sm:inline">: {currentFeature.label}</span>}
        </span>
      </button>

      {tourOpen && (
        <TourOverlay guide={guide} index={tourIndex} onNext={nextTour} onSkip={completeTour} />
      )}

      {open && (
        <GuideModal
          guide={guide}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
