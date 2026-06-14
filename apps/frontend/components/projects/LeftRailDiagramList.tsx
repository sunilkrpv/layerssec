'use client';
import { cn } from '@/lib/utils';

export type RailSelection =
  | { kind: 'project' }
  | { kind: 'diagram'; id: string };

export interface LeftRailDiagram {
  id: string;
  name: string;
  threatCount: number;
  postureGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface Props {
  diagrams: LeftRailDiagram[];
  selectedId?: string;
  onSelect: (sel: RailSelection) => void;
  onNewFlow?: () => void;
}

export function LeftRailDiagramList({ diagrams, selectedId, onSelect, onNewFlow }: Props) {
  const isProjectSelected = !selectedId;
  return (
    <nav className="flex flex-col w-[260px] border-r border-slate-200 dark:border-slate-800 h-full bg-slate-100 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => onSelect({ kind: 'project' })}
        className={cn(
          'px-4 py-3 text-left font-semibold border-b border-slate-200 dark:border-slate-800',
          isProjectSelected
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'text-slate-800 dark:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60',
        )}
      >
        Project
      </button>
      <button
        type="button"
        onClick={onNewFlow}
        className="mx-2 my-2 px-3 py-2 rounded text-left text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
      >
        + New Flow
      </button>
      <ul className="flex-1 overflow-auto">
        {diagrams.map(d => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect({ kind: 'diagram', id: d.id })}
              className={cn(
                'w-full px-4 py-2 text-left flex justify-between items-center text-sm',
                selectedId === d.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60',
              )}
            >
              <span className="truncate">{d.name}</span>
              {d.threatCount > 0 && (
                <span className="ml-2 text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5 dark:bg-red-900/40 dark:text-red-200">
                  {d.threatCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
