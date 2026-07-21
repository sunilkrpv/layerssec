'use client';

import { useState, KeyboardEvent } from 'react';
import { X, Layers, Globe, ShieldCheck, FileText, Link2 } from 'lucide-react';
import { type Environment } from '@/lib/api';
import { cn } from '@/lib/utils';

const COMPLIANCE_OPTIONS = ['SOC2', 'ISO27001', 'PCI', 'HIPAA', 'GDPR', 'FedRAMP'];

const ENV_STYLES: Record<Environment, string> = {
  DEV: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  STAGING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PROD: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

interface FormState {
  techStack: string[];
  environment: Environment | null;
  compliance: string[];
  notes: string;
  repoUrl: string;
}

interface Props {
  initial: FormState;
  onSave: (patch: FormState) => Promise<void>;
}

function FieldCard({
  icon, title, hint, children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function ProjectMetadataForm({ initial, onSave }: Props) {
  const [state, setState] = useState<FormState>({ ...initial });
  const [techInput, setTechInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTechTag() {
    const tag = techInput.trim();
    if (!tag) return;
    if (!state.techStack.includes(tag)) {
      setState((s) => ({ ...s, techStack: [...s.techStack, tag] }));
    }
    setTechInput('');
  }

  function removeTechTag(tag: string) {
    setState((s) => ({ ...s, techStack: s.techStack.filter((t) => t !== tag) }));
  }

  function handleTechKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTechTag();
    }
  }

  function toggleCompliance(option: string) {
    setState((s) => ({
      ...s,
      compliance: s.compliance.includes(option)
        ? s.compliance.filter((c) => c !== option)
        : [...s.compliance, option],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Tech Stack */}
        <FieldCard
          icon={<Layers size={14} />}
          title="Tech Stack"
          hint="Languages, frameworks, key services"
        >
          <div className="mb-2 flex flex-wrap gap-1.5">
            {state.techStack.length === 0 && (
              <span className="text-[11px] italic text-slate-400">No tags yet</span>
            )}
            {state.techStack.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTechTag(tag)}
                  className="ml-0.5 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
                  aria-label={`Remove ${tag}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={handleTechKeyDown}
            onBlur={addTechTag}
            placeholder="Type a tag, press Enter"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </FieldCard>

        {/* Environment */}
        <FieldCard
          icon={<Globe size={14} />}
          title="Environment"
          hint="Deployment target"
        >
          <div className="flex gap-2">
            {(['DEV', 'STAGING', 'PROD'] as Environment[]).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, environment: s.environment === env ? null : env }))
                }
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  state.environment === env
                    ? cn(ENV_STYLES[env], 'border-transparent')
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200',
                )}
              >
                {env}
              </button>
            ))}
          </div>
        </FieldCard>

        {/* Compliance */}
        <FieldCard
          icon={<ShieldCheck size={14} />}
          title="Compliance"
          hint="Frameworks this project must meet"
        >
          <div className="flex flex-wrap gap-1.5">
            {COMPLIANCE_OPTIONS.map((option) => {
              const active = state.compliance.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleCompliance(option)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </FieldCard>

        {/* Repo URL */}
        <FieldCard
          icon={<Link2 size={14} />}
          title="Repository"
          hint="Link source code (optional)"
        >
          <input
            type="url"
            value={state.repoUrl}
            onChange={(e) => setState((s) => ({ ...s, repoUrl: e.target.value }))}
            placeholder="https://github.com/org/repo"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </FieldCard>
      </div>

      {/* Notes (full-width) */}
      <FieldCard
        icon={<FileText size={14} />}
        title="Notes"
        hint="Additional context, decisions, caveats"
      >
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={3}
          placeholder="Any additional context about this project…"
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </FieldCard>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            'rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
            saving && 'cursor-not-allowed opacity-60',
          )}
        >
          {saving ? 'Saving…' : 'Save metadata'}
        </button>
      </div>
    </form>
  );
}
