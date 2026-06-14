'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle, ChevronRight, Home,
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
import { type LayerMap, type ProjectFile, ROOT_LAYER_ID, getLayerPath } from '@/lib/layerStore';
import { FEATURES } from '@/lib/features';
import { buildTrustMapView, type TrustMapCard } from '@/lib/trustMap';
import KanbanColumn from './trust-map/KanbanColumn';
import FlowOverlay from './trust-map/FlowOverlay';
import BoundaryAnalysisPanel from './trust-map/BoundaryAnalysisPanel';

interface Props {
  projectId: string;
}

export default function TrustMapPage({ projectId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerMap>({});
  const [threats, setThreats] = useState<ProjectThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const urlLayerId = searchParams.get('currLayer');
  const [currentLayerId, setCurrentLayerId] = useState<string>(urlLayerId ?? ROOT_LAYER_ID);

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

        const loaded: LayerMap =
          draft && (draft.canvasData as ProjectFile | undefined)?.layers
            ? (draft.canvasData as ProjectFile).layers
            : {};
        setLayers(loaded);
        setThreats(threatsResult.data ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load trust map');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Reconcile URL → state: if `?currLayer` exists and is valid, mirror it.
  useEffect(() => {
    if (!urlLayerId) return;
    if (layers[urlLayerId] && urlLayerId !== currentLayerId) {
      setCurrentLayerId(urlLayerId);
    }
  }, [urlLayerId, layers, currentLayerId]);

  // Fallback if currentLayerId points to a missing layer (project changed).
  useEffect(() => {
    if (!loading && Object.keys(layers).length > 0 && !layers[currentLayerId]) {
      setCurrentLayerId(ROOT_LAYER_ID);
    }
  }, [loading, layers, currentLayerId]);

  const view = useMemo(() => {
    if (loading || Object.keys(layers).length === 0) return null;
    return buildTrustMapView(layers, threats, currentLayerId);
  }, [layers, threats, currentLayerId, loading]);

  const flowCount = view?.flows.length ?? 0;
  const cardCount = view?.cardCount ?? 0;

  const breadcrumb = useMemo(() => {
    if (!layers[currentLayerId]) return [];
    return getLayerPath(layers, currentLayerId);
  }, [layers, currentLayerId]);

  const navigateToLayer = useCallback((layerId: string) => {
    setCurrentLayerId(layerId);
    const sp = new URLSearchParams(searchParams.toString());
    if (layerId === ROOT_LAYER_ID) sp.delete('currLayer');
    else sp.set('currLayer', layerId);
    const qs = sp.toString();
    router.replace(`/projects/${projectId}/trust-map${qs ? `?${qs}` : ''}`);
  }, [router, projectId, searchParams]);

  const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);
  const [hoveredFlowEdgeId, setHoveredFlowEdgeId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const cardRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);

  // Session-only column order override (per-layer reset). Keys = boundaryKey.
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Reset hover + column order state when changing layers.
  useEffect(() => {
    setHoveredCardKey(null);
    setHoveredFlowEdgeId(null);
    setColumnOrder([]);
    setDraggingKey(null);
    setDragOverKey(null);
    cardRefsRef.current.clear();
  }, [currentLayerId]);

  const orderedColumns = useMemo(() => {
    if (!view) return [];
    if (columnOrder.length === 0) return view.columns;
    const byKey = new Map(view.columns.map((c) => [c.boundaryKey, c]));
    const seen = new Set<string>();
    const result: typeof view.columns = [];
    for (const k of columnOrder) {
      const c = byKey.get(k);
      if (c && !seen.has(k)) { result.push(c); seen.add(k); }
    }
    for (const c of view.columns) {
      if (!seen.has(c.boundaryKey)) result.push(c);
    }
    return result;
  }, [view, columnOrder]);

  const moveColumn = useCallback((fromKey: string, toKey: string) => {
    if (!view || fromKey === toKey) return;
    const baseOrder = columnOrder.length > 0
      ? columnOrder.filter((k) => view.columns.some((c) => c.boundaryKey === k))
      : view.columns.map((c) => c.boundaryKey);
    // ensure all current keys present
    for (const c of view.columns) {
      if (!baseOrder.includes(c.boundaryKey)) baseOrder.push(c.boundaryKey);
    }
    const fromIdx = baseOrder.indexOf(fromKey);
    const toIdx = baseOrder.indexOf(toKey);
    if (fromIdx < 0 || toIdx < 0) return;
    baseOrder.splice(fromIdx, 1);
    baseOrder.splice(toIdx, 0, fromKey);
    setColumnOrder(baseOrder);
  }, [view, columnOrder]);

  const handleColumnDragStart = useCallback((key: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }, []);

  const handleColumnDragOver = useCallback((key: string) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingKey || draggingKey === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) setDragOverKey(key);
  }, [draggingKey, dragOverKey]);

  const handleColumnDragLeave = useCallback(() => {
    setDragOverKey(null);
  }, []);

  const handleColumnDrop = useCallback((key: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromKey = e.dataTransfer.getData('text/plain') || draggingKey;
    if (fromKey) moveColumn(fromKey, key);
    setDraggingKey(null);
    setDragOverKey(null);
  }, [draggingKey, moveColumn]);

  const handleColumnDragEnd = useCallback(() => {
    setDraggingKey(null);
    setDragOverKey(null);
  }, []);

  const handleFlowClick = useCallback((flow: import('@/lib/trustMap').TrustMapFlow) => {
    setHoveredFlowEdgeId(flow.edgeId);
  }, []);

  const registerCardRef = useCallback((cardKey: string, el: HTMLDivElement | null) => {
    const map = cardRefsRef.current;
    if (el) map.set(cardKey, el);
    else map.delete(cardKey);
  }, []);

  const handleCardClick = useCallback((card: TrustMapCard) => {
    router.push(`/projects/${projectId}?currLayer=${card.layerId}&selectNode=${card.nodeId}`);
  }, [router, projectId]);

  const handleCardDrill = useCallback((card: TrustMapCard) => {
    if (!card.childLayerId) return;
    navigateToLayer(card.childLayerId);
  }, [navigateToLayer]);

  const highlightedCardKeys = (() => {
    const set = new Set<string>();
    if (hoveredFlowEdgeId) {
      const f = view?.flows.find((x) => x.edgeId === hoveredFlowEdgeId);
      if (f) {
        set.add(f.sourceCardKey);
        set.add(f.targetCardKey);
      }
    }
    return set;
  })();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* Top bar */}
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
          <div className="flex h-full flex-col">
            {FEATURES.DRILLDOWN_UI && <LayerBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateToLayer} />}
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={<ShieldCheck size={28} />}
                heading={
                  currentLayerId === ROOT_LAYER_ID
                    ? 'No trust boundaries yet'
                    : `No trust boundaries in "${layers[currentLayerId]?.name ?? 'this layer'}"`
                }
                subtext="Add a Trust Boundary node in your diagram to populate the trust map."
                cta={
                  <Button onClick={() => router.push(`/projects/${projectId}?currLayer=${currentLayerId}`)}>
                    Open diagram
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div className={`grid h-full ${panelCollapsed ? 'grid-cols-[1fr_36px]' : 'grid-cols-[1fr_340px]'}`}>
            {/* Kanban region */}
            <div className="relative flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
              {FEATURES.DRILLDOWN_UI && <LayerBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateToLayer} />}
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {view.layerName} layer
                </span>
                <span className="text-slate-400">·</span>
                <span>{cardCount} nodes</span>
                <span className="text-slate-400">·</span>
                <span>{flowCount} flows</span>
              </div>
              <div ref={kanbanScrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
                <FlowOverlay
                  flows={view.flows}
                  containerRef={kanbanScrollRef}
                  cardRefs={cardRefsRef}
                  hoveredFlowEdgeId={hoveredFlowEdgeId}
                  hoveredCardKey={hoveredCardKey}
                  onFlowHover={setHoveredFlowEdgeId}
                  onFlowClick={handleFlowClick}
                  layoutRevision={orderedColumns.map((c) => c.boundaryKey).join('|')}
                />
                <div className="flex h-full min-w-max gap-3 p-4">
                  {orderedColumns.map((col) => (
                    <KanbanColumn
                      key={col.boundaryKey}
                      column={col}
                      highlightedCardKeys={highlightedCardKeys}
                      onCardClick={handleCardClick}
                      onCardDrill={handleCardDrill}
                      onCardHover={setHoveredCardKey}
                      registerCardRef={registerCardRef}
                      draggable
                      isDragging={draggingKey === col.boundaryKey}
                      isDragOver={dragOverKey === col.boundaryKey}
                      onDragStart={handleColumnDragStart(col.boundaryKey)}
                      onDragEnd={handleColumnDragEnd}
                      onDragOver={handleColumnDragOver(col.boundaryKey)}
                      onDragLeave={handleColumnDragLeave}
                      onDrop={handleColumnDrop(col.boundaryKey)}
                    />
                  ))}
                  {view.unboundedCards.length > 0 && (
                    <KanbanColumn
                      column={{
                        boundaryId: '__unassigned__',
                        boundaryKey: '__unassigned__',
                        layerId: '',
                        layerName: '',
                        label: 'Unassigned',
                        trustLevel: 'custom',
                        cards: view.unboundedCards,
                      }}
                      highlightedCardKeys={highlightedCardKeys}
                      onCardClick={handleCardClick}
                      onCardDrill={handleCardDrill}
                      onCardHover={setHoveredCardKey}
                      registerCardRef={registerCardRef}
                    />
                  )}
                </div>
              </div>
            </div>
            <BoundaryAnalysisPanel
              view={view}
              projectId={projectId}
              hoveredFlowEdgeId={hoveredFlowEdgeId}
              onThreatClick={(flow) => setHoveredFlowEdgeId(flow.edgeId)}
              onDrillNested={navigateToLayer}
              collapsed={panelCollapsed}
              onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface BreadcrumbProps {
  breadcrumb: ReturnType<typeof getLayerPath>;
  onNavigate: (layerId: string) => void;
}

function LayerBreadcrumb({ breadcrumb, onNavigate }: BreadcrumbProps) {
  if (breadcrumb.length === 0) return null;
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-1.5 text-xs dark:border-slate-700 dark:bg-gray-950">
      {breadcrumb.map((layer, i) => {
        const isLast = i === breadcrumb.length - 1;
        return (
          <div key={layer.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} className="text-slate-400 dark:text-slate-600" />}
            <button
              onClick={() => !isLast && onNavigate(layer.id)}
              disabled={isLast}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5
                ${isLast
                  ? 'cursor-default font-semibold text-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
            >
              {i === 0 && <Home size={11} />}
              {layer.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}
