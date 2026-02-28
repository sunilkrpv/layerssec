'use client';

import { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';

interface PublishModalProps {
  /** The version number this publish will create (e.g. 3 → shows "v3") */
  nextVersionNumber: number;
  isPublishing: boolean;
  onPublish: (comment: string) => void;
  onCancel: () => void;
}

export default function PublishModal({
  nextVersionNumber,
  isPublishing,
  onPublish,
  onCancel,
}: PublishModalProps) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPublish(comment.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <Lock size={14} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Publish Diagram</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isPublishing}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Publishing freezes the current canvas as a versioned snapshot. You'll need to check out
            a new version to continue editing.
          </p>

          <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-900/10">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              This will become{' '}
              <span className="font-bold">v{nextVersionNumber}</span>
            </p>
          </div>

          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Comment <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe what changed in this version…"
            rows={3}
            disabled={isPublishing}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-700"
          />

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPublishing}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPublishing}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {isPublishing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Lock size={13} />
              )}
              Publish v{nextVersionNumber}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
