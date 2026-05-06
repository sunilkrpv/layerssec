'use client';

import { useState, useEffect, type KeyboardEvent } from 'react';
import { GitBranch, X } from 'lucide-react';

interface DrillDownModalProps {
  defaultName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function DrillDownModal({ defaultName, onConfirm, onCancel }: DrillDownModalProps) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    onConfirm(trimmed || defaultName);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">Name this layer</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Layer name..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-2 text-xs text-slate-400">
          A new canvas will open for this node's internal design.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Create Layer
          </button>
        </div>
      </div>
    </div>
  );
}
