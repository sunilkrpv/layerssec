'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useOnboarding } from '@/lib/onboardingStore';

interface Props {
  onOpenSettings: () => void;
  onNewProject: () => void;
}

/**
 * Floating bottom-right checklist shown to new users until all three milestones
 * are hit — or the user dismisses. Self-hides once the checklist is 100% complete
 * (flips `checklistDismissedAt` implicitly via explicit dismiss button).
 */
export default function OnboardingChecklist({ onOpenSettings, onNewProject }: Props) {
  const { state, update } = useOnboarding();
  const [expanded, setExpanded] = useState(true);

  if (!state) return null;
  if (state.checklistDismissedAt) return null;

  interface ChecklistItem {
    key: string;
    label: string;
    done: boolean;
    onClick?: () => void;
    hint?: string;
    locked?: boolean;
  }

  const items: ChecklistItem[] = [
    {
      key: 'ai',
      label: 'Connect an AI provider',
      done: state.aiConfigured,
      onClick: onOpenSettings,
    },
    {
      key: 'project',
      label: 'Create your first project',
      done: !!state.firstProjectCreatedAt,
      onClick: state.aiConfigured ? onNewProject : onOpenSettings,
      locked: !state.aiConfigured,
      hint: !state.aiConfigured ? 'Connect AI first to enable diagram generation' : undefined,
    },
    {
      key: 'threat',
      label: 'Run your first STRIDE analysis',
      done: !!state.firstThreatAnalysisAt,
      locked: !state.firstProjectCreatedAt,
      hint: !state.firstProjectCreatedAt ? 'Create a project to unlock' : 'Open any project and click "Run Threat Analysis"',
    },
    {
      key: 'posture',
      label: 'Compute a posture score',
      done: !!state.firstPostureScoreAt,
      locked: !state.firstThreatAnalysisAt,
      hint: !state.firstThreatAnalysisAt ? 'Run a threat analysis first' : 'Posture score deducts points for unmitigated threats',
    },
    {
      key: 'attack',
      label: 'Run an attack simulation or export a report',
      done: !!state.firstAttackSimAt,
      locked: !state.firstPostureScoreAt,
      hint: !state.firstPostureScoreAt ? 'Compute a posture score first' : 'Pick an entry point in any project',
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  const dismiss = () => {
    void update({ checklistDismissedAt: new Date().toISOString() });
  };

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v); } }}
        className="flex w-full cursor-pointer items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 dark:border-slate-800 dark:from-blue-950/40 dark:to-indigo-950/40"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
          <div className="text-left">
            <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
              {allDone ? 'You\'re all set!' : 'Getting started'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {completed} of {total} complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Dismiss */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            title="Dismiss"
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={13} />
          </button>
          {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100 dark:bg-slate-800">
        <div
          className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      {expanded && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <li key={item.key}>
              <button
                onClick={() => !item.done && item.onClick?.()}
                disabled={item.done || !item.onClick}
                title={item.hint}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-slate-800/50"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    item.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : item.locked
                      ? 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {item.done && <Check size={11} strokeWidth={3} />}
                </span>
                <div className="flex-1">
                <span
                  className={`block text-[12px] ${
                    item.done
                      ? 'text-slate-400 line-through dark:text-slate-500'
                      : item.locked
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'font-medium text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {item.label}
                </span>
                {item.hint && !item.done && (
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-400 dark:text-slate-500">
                    {item.hint}
                  </span>
                )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {allDone && expanded && (
        <button
          onClick={dismiss}
          className="w-full bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-700"
        >
          Hide this checklist
        </button>
      )}
    </div>
  );
}
