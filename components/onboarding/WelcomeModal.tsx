'use client';

import { useState } from 'react';
import {
  Shield, BarChart2, GitCompare, Sword, ArrowRight, X,
} from 'lucide-react';
import { useOnboarding } from '@/lib/onboardingStore';

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: <Shield size={28} />,
    title: 'Model your architecture',
    body: 'Draw layered data-flow/architecture diagrams with 22 node types and trust boundaries. Every diagram becomes the source of truth for security analysis.',
    accent: 'from-blue-500 to-indigo-600',
  },
  {
    icon: <BarChart2 size={28} />,
    title: 'STRIDE threat model + posture score',
    body: 'AI runs STRIDE per node and edge of your architecture, surfaces threats with severity and computes a 0-100 posture score - the risk register writes itself.',
    accent: 'from-violet-500 to-purple-600',
  },
  {
    icon: <GitCompare size={28} />,
    title: 'Diff versions, track drift',
    body: 'Publish snapshots, check out and diff any two versions side-by-side. See exactly what changed - and how the threat surface moved.',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    icon: <Sword size={28} />,
    title: 'Simulate attack paths',
    body: 'Pick an entry point in your architecture and let AI map multi-hop attack paths through your architecture. Prioritise mitigations where they matter most.',
    accent: 'from-rose-500 to-orange-600',
  },
];

export default function WelcomeModal() {
  const { state, update } = useOnboarding();
  const [index, setIndex] = useState(0);

  if (!state || state.welcomeModalSeenAt) return null;

  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const dismiss = () => {
    void update({ welcomeModalSeenAt: new Date().toISOString() });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          title="Skip"
        >
          <X size={16} />
        </button>

        <div className={`flex h-32 items-end bg-gradient-to-br ${slide.accent} px-8 pb-5 text-white`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-sm">{slide.icon}</div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
                {index + 1} of {SLIDES.length}
              </p>
              <h2 className="text-[18px] font-bold">{slide.title}</h2>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
            {slide.body}
          </p>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!last && (
                <button
                  onClick={dismiss}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => (last ? dismiss() : setIndex(index + 1))}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {last ? 'Get started' : 'Next'}
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
