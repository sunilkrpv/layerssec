'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, GitCompareArrows, Clock, Loader2, GitBranch } from 'lucide-react';
import { apiListProjectVersions, type DiagramVersion } from '@/lib/api';

interface VersionCompareSheetProps {
  projectId: string;
  onClose: () => void;
}

export default function VersionCompareSheet({ projectId, onClose }: VersionCompareSheetProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<string[]>([]);

  useEffect(() => {
    apiListProjectVersions(projectId)
      .then((all) => setVersions(all.filter((v) => v.status === 'published')))
      .finally(() => setLoading(false));
  }, [projectId]);

  const toggle = (id: string) => {
    setSelections((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selections.length !== 2) return;
    const [id1, id2] = selections;
    const v1 = versions.find((v) => v.id === id1)!;
    const v2 = versions.find((v) => v.id === id2)!;
    const [base, compare] =
      (v1.versionNumber ?? 0) <= (v2.versionNumber ?? 0) ? [v1, v2] : [v2, v1];
    const pc1 = base.publishComment ? encodeURIComponent(base.publishComment) : '';
    const pc2 = compare.publishComment ? encodeURIComponent(compare.publishComment) : '';
    router.push(
      `/diff?projectId=${projectId}&v1=${base.id}&vn1=${base.versionNumber ?? ''}&pc1=${pc1}&v2=${compare.id}&vn2=${compare.versionNumber ?? ''}&pc2=${pc2}`,
    );
    onClose();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <GitCompareArrows size={14} className="text-slate-500 dark:text-slate-400" />
          <h2 className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Compare Versions
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={13} />
          </button>
        </div>

        {/* Instruction banner */}
        <div className="flex-shrink-0 border-b border-blue-100 bg-blue-50 px-4 py-2.5 dark:border-blue-900 dark:bg-blue-900/10">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Select <strong>2 published versions</strong> to compare.
            {selections.length > 0 && (
              <span className="ml-1 font-medium">{selections.length}/2 selected</span>
            )}
          </p>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <GitBranch size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No published versions yet.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Publish your diagram to create a version snapshot.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {versions.map((v) => {
                const selected = selections.includes(v.id);
                const selectionIndex = selections.indexOf(v.id);
                const disabled = !selected && selections.length >= 2;
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => !disabled && toggle(v.id)}
                      disabled={disabled}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors disabled:opacity-40 ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
                          selected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                        }`}
                      >
                        {selected ? selectionIndex + 1 : ''}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            v{v.versionNumber}
                          </span>
                          {v.publishComment && (
                            <span className="truncate text-xs text-slate-700 dark:text-slate-200">
                              {v.publishComment}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                          <Clock size={9} />
                          {formatDate(v.publishedAt ?? v.createdAt)}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <button
            onClick={handleCompare}
            disabled={selections.length !== 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GitCompareArrows size={14} />
            {selections.length === 2
              ? 'Compare Selected Versions'
              : `Select ${2 - selections.length} more version${selections.length === 0 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}
