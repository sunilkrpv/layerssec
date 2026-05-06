'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Minus,
  Sparkles,
  Gauge,
  FileText,
  ChevronRight,
  ShieldAlert,
  Sword,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

type PipelineTone = 'blue' | 'red';

const PIPELINE: { icon: LucideIcon; label: string; tone: PipelineTone }[] = [
  { icon: Sparkles, label: 'Diagram', tone: 'blue' },
  { icon: ShieldAlert, label: 'Threats', tone: 'red' },
  { icon: Gauge, label: 'Posture', tone: 'blue' },
  { icon: Sword, label: 'Simulate', tone: 'red' },
  { icon: FileText, label: 'Report', tone: 'blue' },
];

const TONE_TILE: Record<PipelineTone, string> = {
  blue: 'bg-blue-50 ring-blue-100 dark:bg-slate-700/60 dark:ring-slate-600',
  red: 'bg-red-50 ring-red-100 dark:bg-red-900/20 dark:ring-red-500/30',
};

const TONE_ICON: Record<PipelineTone, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  red: 'text-red-600 dark:text-red-400',
};

function PipelineStep({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: PipelineTone }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition ${TONE_TILE[tone]}`}>
        <Icon size={15} className={TONE_ICON[tone]} />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[460px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
          <LayersLogo size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Layers</h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">v0.1 Alpha</p>

        {/* Tagline */}
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          AI-native threat modeling on a live architecture canvas.
        </p>

        {/* Pipeline */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {PIPELINE.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1.5">
              <PipelineStep icon={step.icon} label={step.label} tone={step.tone} />
              {i < PIPELINE.length - 1 && (
                <ChevronRight size={12} className="mb-4 text-slate-300 dark:text-slate-600" />
              )}
            </div>
          ))}
        </div>

        {/* Extras — threats dashboard + AI mitigation advice */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700/60">Threats dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700/60">AI mitigation advice</span>
        </div>

        {/* Tech credit */}
        <div className="mt-6 flex items-center justify-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <Minus size={10} />
          <span>Built with Next.js, React Flow &amp; NestJs</span>
          <Minus size={10} />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="mt-6 rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
