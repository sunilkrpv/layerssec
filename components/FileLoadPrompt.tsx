'use client';

import { useState } from 'react';
import { FolderOpen, AlertTriangle, FileJson, X } from 'lucide-react';
import { canUseFileSystemAPI } from '@/lib/fileStore';

interface FileLoadPromptProps {
  /** The layer ID referenced in the shared URL */
  targetLayerId: string;
  /** Called when user successfully picks and opens a file */
  onOpenFile: () => Promise<void>;
  /** Called when user dismisses without loading */
  onDismiss: () => void;
  /** Loading state while file is being processed */
  isLoading?: boolean;
}

export default function FileLoadPrompt({
  targetLayerId,
  onOpenFile,
  onDismiss,
  isLoading = false,
}: FileLoadPromptProps) {
  const supportsFileAPI = canUseFileSystemAPI();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
          <FolderOpen size={28} className="text-blue-600" />
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-lg font-semibold text-slate-900">
          Open Project File
        </h2>
        <p className="mb-1 text-center text-sm text-slate-600">
          This link points to a specific layer in a Drafter project.
        </p>
        <div className="mx-auto mb-6 flex max-w-xs items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2">
          <FileJson size={13} className="flex-shrink-0 text-slate-400" />
          <span className="truncate font-mono text-xs text-slate-500">{targetLayerId}</span>
        </div>

        <p className="mb-6 text-center text-sm text-slate-600">
          {supportsFileAPI
            ? 'Open your project file (.json) to load the diagram and navigate to that layer.'
            : 'Use the Import Project option to load your project file, then navigate to the layer manually.'}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onOpenFile}
            disabled={isLoading || !supportsFileAPI}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={16} />
            {isLoading ? 'Loading…' : 'Open Project File'}
          </button>

          {!supportsFileAPI && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              Your browser doesn&apos;t support the File System API. Use File &gt; Import Project to
              load manually, then navigate from the Layers panel.
            </p>
          )}

          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
