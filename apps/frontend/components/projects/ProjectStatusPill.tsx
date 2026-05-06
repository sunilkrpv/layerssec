import { FileEdit, Lock } from 'lucide-react';

export interface ProjectStatusPillProps {
  hasDraft: boolean;
  publishedCount: number;
}

export function ProjectStatusPill({ hasDraft, publishedCount }: ProjectStatusPillProps) {
  if (hasDraft && publishedCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <FileEdit size={9} />
        Draft
      </span>
    );
  }
  if (hasDraft) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <FileEdit size={9} />
        Draft · v{publishedCount}
      </span>
    );
  }
  if (publishedCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Lock size={9} />
        v{publishedCount}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      New
    </span>
  );
}
