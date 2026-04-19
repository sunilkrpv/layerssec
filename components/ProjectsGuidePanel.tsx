'use client';

import { Lock, FileEdit, GitBranch, ArrowRightCircle, BookOpen } from 'lucide-react';

const INFO_ITEMS = [
  {
    icon: Lock,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'Published',
    desc: 'A frozen snapshot of your diagram. Shared and read-only — edit by checking out the latest version.',
  },
  {
    icon: FileEdit,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Draft in progress',
    desc: 'Your active working copy. Only one draft allowed per project at a time.',
  },
  {
    icon: GitBranch,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Versions',
    desc: 'Each publish creates a numbered version (v1, v2…). You can view, compare, or check out any published version.',
  },
  {
    icon: ArrowRightCircle,
    iconBg: 'bg-indigo-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Check Out',
    desc: 'Creates a new draft from the latest published version. Unavailable if a draft already exists.',
  },
];

export default function ProjectsGuidePanel() {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <BookOpen size={14} className="text-slate-500 dark:text-slate-400" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Guide
        </span>
      </div>

      <div className="space-y-4">
        {INFO_ITEMS.map(({ icon: Icon, iconBg, iconColor, title, desc }) => (
          <div key={title} className="flex gap-3">
            <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon size={13} className={iconColor} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">Tip</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-600 dark:text-blue-400/80">
          Click any project row to open its version history and manage drafts.
        </p>
      </div>
    </aside>
  );
}
