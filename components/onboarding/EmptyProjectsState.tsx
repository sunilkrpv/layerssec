'use client';

import { Plus, Layers, Shield, BarChart2, Sword, GitCompare } from 'lucide-react';
import { useOnboarding } from '@/lib/onboardingStore';

interface Props {
  onNewProject: () => void;
}

const BULLETS = [
  { icon: <Layers size={14} />, title: 'Layered DFD canvas', body: 'Drill into nodes to model sub-systems with 22 node types + trust boundaries.' },
  { icon: <Shield size={14} />, title: 'STRIDE threat model', body: 'LLMs (Claude/OpenAI/Ollama) analyses every node and edge per CISSP categories - severity, mitigation, audit trail.' },
  { icon: <BarChart2 size={14} />, title: 'Posture score (0–100)', body: 'Deterministic scoring across 5 security dimensions, with unmitigated-threat penalty.' },
  { icon: <GitCompare size={14} />, title: 'Versioning + diff', body: 'Publish snapshots and diff any two versions to track how your threat surface evolves.' },
  { icon: <Sword size={14} />, title: 'Attack simulations', body: 'Pick an entry point; Claude maps multi-hop attack paths through your architecture.' },
];

export default function EmptyProjectsState({ onNewProject }: Props) {
  const { state } = useOnboarding();
  const aiReady = state?.aiConfigured ?? false;

  return (
    <div
      data-onboarding="empty-projects"
      className="mx-auto max-w-2xl py-10"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-8 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-sm">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-[18px] font-bold">Start your first project</h2>
              <p className="mt-0.5 text-[13px] text-white/85">
                A project is one architecture you threat-model continuously.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            Every Layers project gives you a versioned diagram plus the full security workflow on top of it:
          </p>

          <ul className="mt-4 space-y-3">
            {BULLETS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  {b.icon}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{b.title}</p>
                  <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-3">
            <button
              data-onboarding="new-project-btn"
              onClick={onNewProject}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={15} />
              Create your first project
            </button>
            {!aiReady && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Tip: connect an AI provider first to unlock diagram generation.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
