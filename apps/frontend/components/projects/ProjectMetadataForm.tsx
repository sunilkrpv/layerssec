'use client';

import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { type Environment } from '@/lib/api';
import { cn } from '@/lib/utils';

const COMPLIANCE_OPTIONS = ['SOC2', 'ISO27001', 'PCI', 'HIPAA', 'GDPR', 'FedRAMP'];

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tech Stack */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Tech Stack
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {state.techStack.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTechTag(tag)}
                className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
          placeholder="Type a tag and press Enter"
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Environment */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Environment
        </label>
        <select
          value={state.environment ?? ''}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              environment: (e.target.value as Environment) || null,
            }))
          }
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">(none)</option>
          <option value="DEV">DEV</option>
          <option value="STAGING">STAGING</option>
          <option value="PROD">PROD</option>
        </select>
      </div>

      {/* Compliance */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Compliance
        </label>
        <div className="flex flex-wrap gap-3">
          {COMPLIANCE_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={state.compliance.includes(option)}
                onChange={() => toggleCompliance(option)}
                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Notes
        </label>
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={3}
          placeholder="Any additional context about this project…"
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Repo URL */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Repo URL
        </label>
        <input
          type="url"
          value={state.repoUrl}
          onChange={(e) => setState((s) => ({ ...s, repoUrl: e.target.value }))}
          placeholder="https://github.com/org/repo"
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            'rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
            saving && 'opacity-60 cursor-not-allowed',
          )}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
