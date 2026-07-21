'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, FolderKanban, LayoutDashboard, GitBranch,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
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
}

const STORAGE_KEY = 'layers_project_sidebar_collapsed';

export function LeftRailDiagramList({ diagrams, selectedId, onSelect }: Props) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '\\') {
        e.preventDefault();
        setCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem(STORAGE_KEY, String(next));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const isProjectSelected = !selectedId;

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-slate-200 bg-slate-100 transition-all duration-200 dark:border-slate-800 dark:bg-slate-950',
        collapsed ? 'w-14' : 'w-[240px]',
      )}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation back */}
      <div className="flex flex-col gap-0.5 px-2 pt-3">
        <RailItem
          icon={<Home size={14} />}
          label="Home"
          collapsed={collapsed}
          onClick={() => router.push('/home')}
        />
        <RailItem
          icon={<FolderKanban size={14} />}
          label="My Projects"
          collapsed={collapsed}
          onClick={() => router.push('/home')}
        />
      </div>

      <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

      {/* Project Overview */}
      <div className="px-2">
        <RailItem
          icon={<LayoutDashboard size={14} />}
          label="Overview"
          active={isProjectSelected}
          collapsed={collapsed}
          onClick={() => onSelect({ kind: 'project' })}
        />
      </div>

      {/* Flows section */}
      {!collapsed && (
        <p className="mt-3 mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
          Flows
        </p>
      )}
      {collapsed && <div className="my-3 border-t border-slate-200 dark:border-slate-800" />}

      <ul className="flex-1 overflow-auto px-2">
        {diagrams.length === 0 && !collapsed && (
          <li className="px-3 py-2 text-[12px] text-slate-400">No flows yet</li>
        )}
        {diagrams.map((d) => (
          <li key={d.id}>
            <RailItem
              icon={<GitBranch size={14} />}
              label={d.name}
              badge={d.threatCount > 0 ? d.threatCount : undefined}
              badgeColor="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
              active={selectedId === d.id}
              collapsed={collapsed}
              onClick={() => onSelect({ kind: 'diagram', id: d.id })}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function RailItem({
  icon, label, active, badge, badgeColor, collapsed, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
  badgeColor?: string;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500')}>
        {icon}
      </span>
      {!collapsed && <span className="flex-1 truncate text-[13px] font-medium">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', badgeColor ?? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}>
          {badge}
        </span>
      )}
    </button>
  );
}
