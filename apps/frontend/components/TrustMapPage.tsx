'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle,
  Sun, Moon, Monitor, LogOut, User,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  apiGetProject, apiGetProjectDraft, apiListProjectThreats,
  type ProjectThreat,
} from '@/lib/api';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';
import type { LayerMap, ProjectFile } from '@/lib/layerStore';
import { buildTrustMapView, type TrustMapCard, type TrustMapView } from '@/lib/trustMap';
import KanbanColumn from './trust-map/KanbanColumn';

interface Props {
  projectId: string;
}

export default function TrustMapPage({ projectId }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [view, setView] = useState<TrustMapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme as 'light' | 'dark' | 'system') + 1) % cycle.length]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [project, draft, threatsResult] = await Promise.all([
          apiGetProject(projectId),
          apiGetProjectDraft(projectId),
          apiListProjectThreats(projectId, { limit: 500 }),
        ]);
        if (cancelled) return;

        setProjectName(project.name);

        const layers: LayerMap =
          draft && (draft.canvasData as ProjectFile | undefined)?.layers
            ? (draft.canvasData as ProjectFile).layers
            : {};

        const threats: ProjectThreat[] = threatsResult.data ?? [];
        setView(buildTrustMapView(layers, threats));
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load trust map');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const flowCount = view?.flows.length ?? 0;
  const cardCount = view?.cardCount ?? 0;

  const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);
  const cardRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerCardRef = useCallback((cardKey: string, el: HTMLDivElement | null) => {
    const map = cardRefsRef.current;
    if (el) map.set(cardKey, el);
    else map.delete(cardKey);
  }, []);

  const handleCardClick = useCallback((card: TrustMapCard) => {
    router.push(`/projects/${projectId}?currLayer=${card.layerId}&selectNode=${card.nodeId}`);
  }, [router, projectId]);

  const highlightedCardKeys = new Set<string>();
  void hoveredCardKey;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* Top bar — h-9 secondary page pattern */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to diagram
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-accent-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ? `${projectName} — Trust Map` : 'Trust Map'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
          </button>
          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {storedUser && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{storedUser.email}</span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 size={20} className="mr-2 animate-spin" /> Loading trust map…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<AlertCircle size={28} />}
              heading="Couldn't load trust map"
              subtext={error}
            />
          </div>
        ) : !view || (view.columns.length === 0 && view.unboundedCards.length === 0) ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<ShieldCheck size={28} />}
              heading="No trust boundaries yet"
              subtext="Add a Trust Boundary node in your diagram to populate the trust map."
              cta={
                <Button onClick={() => router.push(`/projects/${projectId}`)}>
                  Open diagram
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid h-full grid-cols-[1fr_340px]">
            {/* Kanban region (filled in later tasks) */}
            <div className="relative flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {projectName ?? 'project'} — trust map
                </span>
                <span className="text-slate-400">·</span>
                <span>{cardCount} nodes</span>
                <span className="text-slate-400">·</span>
                <span>{flowCount} flows</span>
              </div>
              <div className="relative flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full min-w-max gap-3 p-4">
                  {view!.columns.map((col) => (
                    <KanbanColumn
                      key={col.boundaryKey}
                      column={col}
                      highlightedCardKeys={highlightedCardKeys}
                      onCardClick={handleCardClick}
                      onCardHover={setHoveredCardKey}
                      registerCardRef={registerCardRef}
                    />
                  ))}
                  {view!.unboundedCards.length > 0 && (
                    <KanbanColumn
                      column={{
                        boundaryId: '__unassigned__',
                        boundaryKey: '__unassigned__',
                        layerId: '',
                        layerName: '',
                        label: 'Unassigned',
                        trustLevel: 'custom',
                        cards: view!.unboundedCards,
                      }}
                      highlightedCardKeys={highlightedCardKeys}
                      onCardClick={handleCardClick}
                      onCardHover={setHoveredCardKey}
                      registerCardRef={registerCardRef}
                    />
                  )}
                </div>
              </div>
            </div>
            <aside className="border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-950">
              <div className="p-4 text-sm text-slate-400">analysis placeholder</div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
