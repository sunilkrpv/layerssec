'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { apiDeleteProject } from '@/lib/api';

type Phase = 'confirm' | 'deleting' | 'success';

interface Props {
  project: { id: string; name: string };
  onClose: () => void;
  onDeleted: (projectId: string) => void;
}

export default function DeleteProjectModal({ project, onClose, onDeleted }: Props) {
  const [typedName, setTypedName] = useState('');
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'confirm') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, phase]);

  const canDelete = typedName.trim() === project.name && phase === 'confirm';

  const handleDelete = async () => {
    if (!canDelete) return;
    setPhase('deleting');
    setError(null);
    try {
      await apiDeleteProject(project.id);
      setPhase('success');
      setTimeout(() => {
        onDeleted(project.id);
        onClose();
      }, 1200);
    } catch (e) {
      setPhase('confirm');
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={() => phase === 'confirm' && onClose()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'deleting' ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10">
            <Loader2 size={22} className="animate-spin text-blue-600" />
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Deleting project… do not navigate away or close this tab
            </p>
          </div>
        ) : phase === 'success' ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10">
            <CheckCircle2 size={26} className="text-emerald-500" />
            <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
              Project deleted
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Delete project?
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                This will permanently delete{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {project.name}
                </span>{' '}
                and all associated data — diagrams, versions, threat models, posture scores, AI
                chat history, attack simulations, and AI vectors.{' '}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </span>
              </p>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Type the project name to confirm:{' '}
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {project.name}
                  </span>
                </label>
                <input
                  autoFocus
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={project.name}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-red-600 dark:focus:ring-red-900/30"
                />
              </div>

              {error && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={12} />
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2 px-6 pb-5">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canDelete}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete Project
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
