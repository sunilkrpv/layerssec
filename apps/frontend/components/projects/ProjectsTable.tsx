'use client';

import { ChevronRight, Clock, FolderOpen, Trash2 } from 'lucide-react';
import { projectColor, formatRelativeDate } from '@/lib/projectBadges';
import { ProjectStatusPill } from '@/components/projects/ProjectStatusPill';
import type { ProjectWithVersioning } from '@/lib/api';

export interface ProjectsTableProps {
  projects: ProjectWithVersioning[];
  selectedId: string | null;
  onSelect: (project: ProjectWithVersioning) => void;
  onRequestDelete: (project: ProjectWithVersioning) => void;
}

export function ProjectsTable({ projects, selectedId, onSelect, onRequestDelete }: ProjectsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
            <Th>Name</Th>
            <Th>Created</Th>
            <Th>Last updated</Th>
            <Th>Status</Th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.map((p) => (
            <tr
              key={p.id}
              onClick={() => onSelect(p)}
              className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                selectedId === p.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${projectColor(p.id).bg} ${projectColor(p.id).text}`}>
                    <FolderOpen size={14} />
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock size={11} />
                  {formatRelativeDate(p.createdAt)}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatRelativeDate(p.updatedAt)}
                </span>
              </td>
              <td className="px-4 py-3">
                <ProjectStatusPill hasDraft={p.hasDraft} publishedCount={p.publishedCount} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    title="Delete project"
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(p); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} className="ml-1 text-slate-300 dark:text-slate-600" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </th>
  );
}
