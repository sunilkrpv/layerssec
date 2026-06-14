'use client';
import { useState } from 'react';
import { apiCreateDiagram, apiSuggestFlow, DiagramFull } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface NewFlowDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (diagram: DiagramFull) => void;
}

export function NewFlowDialog({ projectId, open, onOpenChange, onCreated }: NewFlowDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState<'blank' | 'ai-suggest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName('');
    setDescription('');
    setSubmitting(null);
    setError(null);
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };

  const create = async (mode: 'blank' | 'ai-suggest') => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setSubmitting(mode);
    try {
      let canvasData: unknown = { nodes: [], edges: [] };
      if (mode === 'ai-suggest') {
        const seed = await apiSuggestFlow({ projectId, flowName: name.trim(), description: description.trim() || undefined });
        canvasData = seed.diagram;
      }
      const created = await apiCreateDiagram(projectId, name.trim(), canvasData);
      onCreated?.(created);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create flow');
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-[420px] shadow-xl">
        <h3 className="text-lg font-semibold">New Flow</h3>
        <p className="text-sm text-slate-500 mt-1">Add a new data flow diagram to this project.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="flow-name" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="flow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Login, Checkout"
              className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
              autoFocus
              disabled={submitting !== null}
            />
          </div>
          <div>
            <label htmlFor="flow-description" className="block text-sm font-medium mb-1">Description <span className="text-slate-500">(optional)</span></label>
            <textarea
              id="flow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
              disabled={submitting !== null}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={submitting !== null}
            className="px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => create('blank')}
            disabled={submitting !== null || !name.trim()}
            className={cn('px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700', submitting === 'blank' && 'opacity-60')}
          >
            {submitting === 'blank' ? 'Creating…' : 'Create blank'}
          </button>
          <button
            type="button"
            onClick={() => create('ai-suggest')}
            disabled={submitting !== null || !name.trim()}
            className={cn('px-3 py-2 text-sm rounded bg-blue-600 text-white', submitting === 'ai-suggest' && 'opacity-60')}
          >
            {submitting === 'ai-suggest' ? 'AI suggesting…' : 'AI suggest'}
          </button>
        </div>
      </div>
    </div>
  );
}
