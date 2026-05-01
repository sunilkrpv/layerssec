'use client';

import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { apiUpdateProject } from '@/lib/api';
import DeleteProjectModal from './projects/DeleteProjectModal';

const NAME_MAX = 100;
const DESC_MAX = 1024;

interface Props {
  projectId: string;
  initialName: string;
  initialDescription: string | null;
  onClose: () => void;
  onSaved: (updates: { name: string; description: string }) => void;
  onDeleted?: (projectId: string) => void;
}

export default function ProjectEditModal({
  projectId, initialName, initialDescription, onClose, onSaved, onDeleted,
}: Props) {
  const [showDelete, setShowDelete] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, saving]);

  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const nameInvalid = trimmedName.length === 0 || trimmedName.length > NAME_MAX;
  const descInvalid = trimmedDesc.length > DESC_MAX;
  const dirty = trimmedName !== initialName.trim() || trimmedDesc !== (initialDescription ?? '').trim();
  const canSave = dirty && !nameInvalid && !descInvalid && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await apiUpdateProject(projectId, { name: trimmedName, description: trimmedDesc });
      onSaved({ name: trimmedName, description: trimmedDesc });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Edit project</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Name</label>
              <span className={`text-[11px] tabular-nums ${trimmedName.length > NAME_MAX ? 'text-red-500' : 'text-slate-400'}`}>
                {trimmedName.length}/{NAME_MAX}
              </span>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              disabled={saving}
              autoFocus
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/50"
            />
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Description</label>
              <span className={`text-[11px] tabular-nums ${trimmedDesc.length > DESC_MAX ? 'text-red-500' : 'text-slate-400'}`}>
                {trimmedDesc.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESC_MAX}
              disabled={saving}
              rows={5}
              placeholder="What does this project model? Who uses it?"
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/50"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            onClick={() => setShowDelete(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 size={12} />
            Delete project
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteProjectModal
          project={{ id: projectId, name: initialName }}
          onClose={() => setShowDelete(false)}
          onDeleted={(id) => {
            setShowDelete(false);
            onDeleted?.(id);
          }}
        />
      )}
    </div>
  );
}
