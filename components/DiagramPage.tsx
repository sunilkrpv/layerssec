'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider, type Node, type Edge, type ReactFlowInstance } from 'reactflow';
import { toPng } from 'html-to-image';

import DiagramCanvas, { type ExtendedRFInstance } from '@/components/DiagramCanvas';
import NodePalette from '@/components/NodePalette';
import PropertiesPanel from '@/components/PropertiesPanel';
import EdgePropertiesPanel from '@/components/EdgePropertiesPanel';
import MenuBar from '@/components/MenuBar';
import Toolbar from '@/components/Toolbar';
import LayerBar from '@/components/LayerBar';
import LayersPanel from '@/components/LayersPanel';
import NodeContextMenu from '@/components/NodeContextMenu';
import DrillDownModal from '@/components/DrillDownModal';
import ReassignLayerModal from '@/components/ReassignLayerModal';
import DeleteLayerModal from '@/components/DeleteLayerModal';
import AssignLayerModal from '@/components/AssignLayerModal';
import AIChatPanel from '@/components/AIChatPanel';
import FileLoadPrompt from '@/components/FileLoadPrompt';
import StartupModal from '@/components/StartupModal';
import AuthModal from '@/components/AuthModal';
import ProjectsModal from '@/components/ProjectsModal';
import PublishModal from '@/components/PublishModal';

import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';
import type { UserProfile, Project } from '@/lib/api';
import {
  apiUpdateDiagram, apiCreateDiagram, apiGenerateDiagram,
  apiPublishDiagram, apiListProjectVersions, apiGetProjectDraft,
  apiGetDiagram, apiGetProject, apiCheckoutVersion, DraftExistsError,
} from '@/lib/api';
import { getStoredUser, clearTokens, isLoggedIn, isLocalMode, clearLocalMode } from '@/lib/authStore';
import {
  loadAllLayers,
  saveAllLayers,
  makeInitialLayers,
  createChildLayer,
  createStandaloneLayer,
  findChildLayer,
  getLayerPath,
  updateLayer,
  collectDescendantIds,
  deleteLayerCascade,
  getOrphanedLayers,
  ROOT_LAYER_ID,
  type LayerMap,
  type Layer,
} from '@/lib/layerStore';
import {
  canUseFileSystemAPI,
  pickAndReadFile,
  writeToHandle,
  pickSaveAndWrite,
  downloadProjectFile,
  type ProjectFile,
} from '@/lib/fileStore';
import { CanvasContext } from '@/lib/canvasContext';
import { LINE_NODE_TYPES } from '@/lib/nodeConfig';

// ─── helper: synchronously capture current canvas state ──────────────────────
function captureCanvas(
  ref: React.MutableRefObject<ExtendedRFInstance | null>,
): { nodes: Node[]; edges: Edge[] } | null {
  const instance = ref.current as ReactFlowInstance | null;
  if (!instance) return null;
  const obj = instance.toObject();
  return { nodes: obj.nodes as Node[], edges: obj.edges };
}

// ─── helper: trigger a JSON file download ────────────────────────────────────
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── helper: read currLayer from the current URL search params ───────────────
function readCurrLayerParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('currLayer');
}

// ─── helper: read ?view=diagramId — load a specific published version ─────────
function readViewDiagramParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('view');
}

interface DiagramPageProps {
  projectId: string;
}

export default function DiagramPage({ projectId }: DiagramPageProps) {
  const router = useRouter();
  const rfInstanceRef = useRef<ExtendedRFInstance | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // Clipboard lifted here so it persists when DiagramCanvas remounts on layer switch
  const clipboardRef = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }>({ nodes: [], edges: [] });

  // ── Layer state — init navStack from URL currLayer param ─────────────────
  const [layers, setLayers] = useState<LayerMap>(() => loadAllLayers());
  const [navStack, setNavStack] = useState<string[]>(() => {
    const currLayerParam = readCurrLayerParam();
    if (currLayerParam) {
      const allLayers = loadAllLayers();
      // Only use URL param if the layer exists locally; otherwise we'll show a file prompt
      const path = getLayerPath(allLayers, currLayerParam);
      if (path.length > 0 && allLayers[currLayerParam]) return path.map((l) => l.id);
    }
    return [ROOT_LAYER_ID];
  });

  // ── File management ───────────────────────────────────────────────────────
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Guard ref — set to false on sign-out / 401 so debounced saves don't overwrite clean state
  const saveEnabledRef = useRef(true);

  // Refs so auto-save interval / debounced saves can access latest state without stale closures
  const layersRef = useRef(layers);
  const navStackRef = useRef(navStack);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const autoSaveRef = useRef(true); // mirrors autoSave state for use inside callbacks
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { navStackRef.current = navStack; }, [navStack]);
  useEffect(() => { fileHandleRef.current = fileHandle; }, [fileHandle]);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);

  // ── URL file-load prompt — shown when currLayer param exists but not found locally ──
  const [showFileLoadPrompt, setShowFileLoadPrompt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const param = readCurrLayerParam();
    if (!param) return null;
    const allLayers = loadAllLayers();
    return allLayers[param] ? null : param;
  });
  const [fileLoadPending, setFileLoadPending] = useState(false);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  /** ID of the backend Diagram currently open (enables cloud auto-save). */
  const [backendDiagramId, setBackendDiagramId] = useState<string | null>(null);
  const backendDiagramIdRef = useRef<string | null>(null);
  useEffect(() => { backendDiagramIdRef.current = backendDiagramId; }, [backendDiagramId]);

  /** Name of the currently open cloud project — shown in the UI. */
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  /** Whether the currently open cloud diagram is read-only (published). */
  const [isReadOnly, setIsReadOnly] = useState(false);
  const isReadOnlyRef = useRef(false);
  useEffect(() => { isReadOnlyRef.current = isReadOnly; }, [isReadOnly]);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  /** Number of published versions in the current project (used to compute next version number). */
  const [publishedVersionCount, setPublishedVersionCount] = useState(0);

  /**
   * Incremented every time loadCanvasFromData is called.
   * Forces DiagramCanvas to remount with fresh initialNodes even when currentLayerId
   * does not change (e.g. server data loaded while already on ROOT layer).
   */
  const [canvasLoadKey, setCanvasLoadKey] = useState(0);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);

  // ── On mount: prune malformed layers (no id or no name) from the store ──────
  useEffect(() => {
    setLayers((prev) => {
      const cleaned: LayerMap = {};
      let changed = false;
      for (const [key, layer] of Object.entries(prev)) {
        if (!layer.id || key !== layer.id) { changed = true; continue; } // skip miskeyed / no-id entries
        cleaned[key] = layer;
      }
      if (!changed) return prev;
      saveAllLayers(cleaned);
      return cleaned;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Auth guard — redirect to /login if no session and not in local mode ────
  useEffect(() => {
    if (!isLoggedIn() && !isLocalMode()) {
      router.replace('/login');
    }
  }, [router]);

  // ── 401 handler — session expired anywhere in the app ─────────────────────
  useEffect(() => {
    const handle401 = () => {
      saveEnabledRef.current = false;
      clearTokens();
      clearLocalMode();
      setUser(null);
      setBackendDiagramId(null);
      setCurrentProjectName(null);
      setShowProjectsModal(false);
      router.replace('/login');
    };
    window.addEventListener('drafter:unauthorized', handle401);
    return () => window.removeEventListener('drafter:unauthorized', handle401);
  }, [router]);

  // ── Global keyboard shortcuts (Cmd+L: layers panel, Cmd+P: projects modal) ─
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const isTyping =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isTyping) return;
      if (e.key === 'l') {
        e.preventDefault();
        setShowLayersPanel((v) => !v);
      } else if (e.key === 'p') {
        e.preventDefault();
        setShowProjectsModal(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [animateEdges, setAnimateEdges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Startup modal — shown on fresh load when there's no existing work
  const [showStartupModal, setShowStartupModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (readCurrLayerParam()) return false; // URL-sharing flow takes priority
    // Cloud projects are auto-loaded from the backend — never show startup modal for them
    if (projectId !== 'local' && isLoggedIn()) return false;
    const allLayers = loadAllLayers();
    const isBlank =
      Object.keys(allLayers).length <= 1 &&
      (allLayers[ROOT_LAYER_ID]?.nodes?.length ?? 0) === 0;
    return isBlank;
  });
  const [startupLoading, setStartupLoading] = useState(false);

  // AI chat panel — open on initial load only when startup modal is not shown
  const [showChatPanel, setShowChatPanel] = useState(!showStartupModal);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: Node<NodeData>;
    selectedNodes: Node<NodeData>[];
    hasReassignableTargets: boolean;
    hasAssignableOrphans: boolean;
  } | null>(null);

  // Drill-down naming modal
  const [drillTarget, setDrillTarget] = useState<Node<NodeData> | null>(null);

  // Reassign layer modal
  const [reassignTarget, setReassignTarget] = useState<{
    sourceNodeId: string;
    layerId: string;
    layerName: string;
    targetCandidates: Node<NodeData>[];
  } | null>(null);

  // Delete layer confirmation modal
  const [deleteLayerTarget, setDeleteLayerTarget] = useState<string | null>(null);

  // Assign orphaned layer modal
  const [assignLayerTarget, setAssignLayerTarget] = useState<{
    nodeId: string;
    nodeLabel: string;
    orphans: Layer[];
  } | null>(null);

  // ── Derived values ────────────────────────────────────────────────────────
  const currentLayerId = navStack[navStack.length - 1];
  const currentLayer = layers[currentLayerId];
  const hasNodes = (currentLayer?.nodes.length ?? 0) > 0;

  // ── URL sync — update browser URL whenever the active layer changes ───────
  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      `/projects/${projectId}?currLayer=${currentLayerId}`,
    );
  }, [currentLayerId, projectId]);

  // ── Auto-save interval (every 60 s when ON + file handle or backend diagram is set) ─────
  useEffect(() => {
    if (!autoSave) return;
    const id = setInterval(async () => {
      // Always capture live canvas state (flushes current layer via rfInstanceRef)
      const projectData = buildProjectSnapshotRef.current();

      // Local file save
      const handle = fileHandleRef.current;
      if (handle) {
        try {
          await writeToHandle(handle, projectData);
          setLastSaved(new Date());
        } catch (err) {
          console.error('[Auto-save local] Failed:', err);
        }
      }

      // Cloud save
      const diagId = backendDiagramIdRef.current;
      if (diagId) {
        try {
          await apiUpdateDiagram(diagId, projectData);
          setLastSaved(new Date());
        } catch (err) {
          console.error('[Auto-save cloud] Failed:', err);
        }
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [autoSave]);

  // ── Persist helpers ───────────────────────────────────────────────────────

  // snapshot must be captured BEFORE calling setLayers — never inside the updater,
  // because React may run updaters after the old DiagramCanvas has begun unmounting
  // (React Flow's Zustand store tears down, toObject() returns empty).
  const flushCurrentLayer = useCallback(
    (prev: LayerMap, layerId: string, snapshot: { nodes: Node[]; edges: Edge[] } | null): LayerMap => {
      if (!snapshot) return prev;
      return {
        ...prev,
        [layerId]: { ...prev[layerId], nodes: snapshot.nodes, edges: snapshot.edges },
      };
    },
    [],
  );

  // handleLayerSave: only persists to localStorage. Cloud saves happen explicitly
  // via the Save button or the 60 s auto-save interval, both of which call
  // buildProjectSnapshot() to capture the live canvas at that moment.
  const handleLayerSave = useCallback(
    (nodes: Node<NodeData>[], edges: Edge[]) => {
      if (!saveEnabledRef.current) return;
      setLayers((prev) => {
        const updated = {
          ...prev,
          [currentLayerId]: { ...prev[currentLayerId], nodes, edges },
        };
        saveAllLayers(updated);
        return updated;
      });
    },
    [currentLayerId],
  );

  // ── Auto-load cloud project by URL ────────────────────────────────────────
  // When navigating directly to /projects/:uuid, fetch draft (or latest published) from backend.
  // If ?view=diagramId is in the URL, load that specific version (read-only).
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (projectId === 'local' || !isLoggedIn() || backendDiagramId || autoLoadedRef.current) return;
    autoLoadedRef.current = true;

    const viewDiagramId = readViewDiagramParam();

    (async () => {
      try {
        // Load project name in background — non-blocking, failure is non-fatal
        apiGetProject(projectId)
          .then((proj) => setCurrentProjectName(proj.name))
          .catch(() => {/* non-fatal */});

        // ?view=diagramId — load a specific version as read-only
        if (viewDiagramId) {
          const full = await apiGetDiagram(viewDiagramId);
          loadCanvasFromDataRef.current(full.canvasData as ProjectFile);
          setBackendDiagramId(full.id);
          setIsReadOnly(true); // viewed versions are always read-only
          return;
        }

        // Fast path: check for an existing draft first
        const draft = await apiGetProjectDraft(projectId);
        if (draft) {
          // Use draft directly — no redundant apiGetDiagram call
          loadCanvasFromDataRef.current(draft.canvasData as ProjectFile);
          setBackendDiagramId(draft.id);
          setIsReadOnly(false);
          // Load version count in background
          apiListProjectVersions(projectId)
            .then((v) => setPublishedVersionCount(v.filter((d) => d.status === 'published').length))
            .catch(() => {/* non-fatal */});
          return;
        }

        // No draft — check for published versions (failure treated as no versions)
        let pubVersions: Array<{ id: string; status: string; createdAt: string }> = [];
        try {
          const versions = await apiListProjectVersions(projectId);
          pubVersions = versions.filter((v) => v.status === 'published');
          setPublishedVersionCount(pubVersions.length);
        } catch {/* non-fatal — treat as no published versions */}

        if (pubVersions.length > 0) {
          const latest = pubVersions[pubVersions.length - 1];
          const full = await apiGetDiagram(latest.id);
          loadCanvasFromDataRef.current(full.canvasData as ProjectFile);
          setBackendDiagramId(full.id);
          setIsReadOnly(true);
        } else {
          // Brand new project — create a blank draft so saves work immediately
          const emptyCanvas: ProjectFile = { layers: makeInitialLayers(), navStack: [ROOT_LAYER_ID] };
          const newDiagram = await apiCreateDiagram(projectId, 'main', emptyCanvas);
          loadCanvasFromDataRef.current(emptyCanvas);
          setBackendDiagramId(newDiagram.id);
          setIsReadOnly(false);
        }
      } catch (err) {
        // 401 is dispatched as drafter:unauthorized and handled globally
        if (err instanceof Error && err.name === 'ApiUnauthorizedError') return;
        console.error('[Auto-load] Failed to load project:', err);
        setError('Failed to load project — saves may not work. Please refresh the page.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── File operations ───────────────────────────────────────────────────────

  /** Load canvas data (ProjectFile) into memory — shared by auto-load and handleOpenCloudProject. */
  const loadCanvasFromData = useCallback((canvasData: ProjectFile) => {
    const importedLayers: LayerMap =
      canvasData?.layers && typeof canvasData.layers === 'object' && Object.keys(canvasData.layers).length > 0
        ? canvasData.layers
        : makeInitialLayers();
    saveAllLayers(importedLayers);
    setLayers(importedLayers);
    setNavStack(canvasData?.navStack?.length ? canvasData.navStack : [ROOT_LAYER_ID]);
    // Force DiagramCanvas to remount with the fresh initialNodes even when
    // currentLayerId doesn't change (e.g. server data loaded while already on ROOT).
    setCanvasLoadKey((k) => k + 1);
    setSelectedNode(null);
    setSelectedEdge(null);
    setLastSaved(null);
    setFileHandle(null);
  }, []);

  // Stable ref so the auto-load effect (above) can call the latest version without stale closure
  const loadCanvasFromDataRef = useRef(loadCanvasFromData);
  useEffect(() => { loadCanvasFromDataRef.current = loadCanvasFromData; }, [loadCanvasFromData]);

  /** Build the current in-memory project snapshot (flushing canvas first). */
  const buildProjectSnapshot = useCallback((): ProjectFile => {
    const snapshot = captureCanvas(rfInstanceRef);
    const latestLayers = snapshot
      ? {
          ...layersRef.current,
          [currentLayerId]: {
            ...layersRef.current[currentLayerId],
            nodes: snapshot.nodes,
            edges: snapshot.edges,
          },
        }
      : layersRef.current;
    return { layers: latestLayers, navStack: navStackRef.current };
  }, [currentLayerId]);

  // Stable ref so intervals/closures always call the latest buildProjectSnapshot
  const buildProjectSnapshotRef = useRef(buildProjectSnapshot);
  useEffect(() => {
    buildProjectSnapshotRef.current = buildProjectSnapshot;
  }, [buildProjectSnapshot]);

  /** Open a project file and load it into memory. */
  const handleOpenFile = useCallback(async () => {
    if (!canUseFileSystemAPI()) {
      setError('Your browser does not support the File System API. Use Import Project instead.');
      return;
    }
    try {
      const result = await pickAndReadFile();
      if (!result) return; // user cancelled
      const { handle, data } = result;
      setFileHandle(handle);
      setLayers(data.layers);
      saveAllLayers(data.layers);
      setNavStack(data.navStack?.length ? data.navStack : [ROOT_LAYER_ID]);
      setSelectedNode(null);
      setSelectedEdge(null);
      setLastSaved(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open file.');
    }
  }, []);

  /**
   * Open a project file in response to a shared URL.
   * After loading, navigate to targetLayerId and validate it exists.
   */
  const handleOpenFileForURL = useCallback(
    async (targetLayerId: string) => {
      if (!canUseFileSystemAPI()) return;
      setFileLoadPending(true);
      try {
        const result = await pickAndReadFile();
        if (!result) {
          setFileLoadPending(false);
          return; // user cancelled
        }
        const { handle, data } = result;

        if (!data.layers[targetLayerId]) {
          setError(
            `Layer "${targetLayerId}" was not found in the opened file. You may have opened the wrong project.`,
          );
          setFileLoadPending(false);
          return;
        }

        // Load data and navigate to the target layer
        setFileHandle(handle);
        setLayers(data.layers);
        saveAllLayers(data.layers);

        const path = getLayerPath(data.layers, targetLayerId);
        setNavStack(path.length > 0 ? path.map((l) => l.id) : [ROOT_LAYER_ID]);
        setSelectedNode(null);
        setSelectedEdge(null);
        setLastSaved(null);
        setShowFileLoadPrompt(null); // dismiss prompt
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to open file.');
      } finally {
        setFileLoadPending(false);
      }
    },
    [],
  );

  /**
   * Retry cloud project setup after an auto-load failure.
   * Finds or creates a backendDiagramId then immediately saves current canvas.
   */
  const retryAutoLoad = useCallback(async () => {
    if (!isLoggedIn()) return;
    setError(null);
    try {
      let diagId = backendDiagramIdRef.current;
      if (!diagId) {
        if (projectId === 'local') return;
        const draft = await apiGetProjectDraft(projectId);
        if (draft) {
          diagId = draft.id;
        } else {
          const emptyCanvas: ProjectFile = { layers: makeInitialLayers(), navStack: [ROOT_LAYER_ID] };
          const newDiagram = await apiCreateDiagram(projectId, 'main', emptyCanvas);
          diagId = newDiagram.id;
        }
        setBackendDiagramId(diagId);
      }
      // Immediately save the current canvas state
      const data = buildProjectSnapshotRef.current();
      await apiUpdateDiagram(diagId, data);
      setLastSaved(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'ApiUnauthorizedError') return;
      setError('Failed to reconnect — please check your connection and try again.');
    }
  }, [projectId]);

  /**
   * Save now.
   * - If a cloud diagram is open (backendDiagramId is set), ALWAYS saves to cloud.
   * - Otherwise falls back to local file save.
   * This covers both the /projects/:uuid route AND the case where a cloud project
   * was opened via the Projects modal from the /projects/local route.
   */
  const handleSaveFile = useCallback(async () => {
    const diagId = backendDiagramIdRef.current;

    // ── Cloud save ─────────────────────────────────────────────────────────
    if (diagId && isLoggedIn()) {
      if (isReadOnlyRef.current) {
        setError('This is a published version and cannot be edited. Use "Check Out to Edit" to create a new draft.');
        return;
      }
      setIsSaving(true);
      try {
        const data = buildProjectSnapshot();
        await apiUpdateDiagram(diagId, data);
        setLastSaved(new Date());
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Save failed.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── Local file save (only when no cloud diagram is open) ───────────────
    setIsSaving(true);
    const data = buildProjectSnapshot();
    try {
      if (fileHandle) {
        await writeToHandle(fileHandle, data);
        setLastSaved(new Date());
      } else if (canUseFileSystemAPI()) {
        const handle = await pickSaveAndWrite(data);
        if (handle) {
          setFileHandle(handle);
          setLastSaved(new Date());
        }
      } else {
        downloadProjectFile(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [fileHandle, buildProjectSnapshot]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleAuthSuccess = useCallback((newUser: UserProfile) => {
    setUser(newUser);
    setShowAuthModal(false);
    // After signing in, show projects immediately
    setShowProjectsModal(true);
    // Keep startup modal open behind the projects modal so user can dismiss it after
  }, []);

  const handleSignOut = useCallback(() => {
    saveEnabledRef.current = false;
    clearTokens();
    clearLocalMode();
    const fresh = makeInitialLayers();
    saveAllLayers(fresh);
    setLayers(fresh);
    setNavStack([ROOT_LAYER_ID]);
    setUser(null);
    setBackendDiagramId(null);
    setCurrentProjectName(null);
    router.push('/login');
  }, [router]);

  /** Called when user opens a project from ProjectsModal. */
  const handleOpenCloudProject = useCallback(
    (project: Project, canvasData: ProjectFile, diagramId: string) => {
      loadCanvasFromData(canvasData);
      setBackendDiagramId(diagramId || null);
      setCurrentProjectName(project.name);
      setIsReadOnly(false);
      setShowProjectsModal(false);
      setShowStartupModal(false);
    },
    [loadCanvasFromData],
  );

  /**
   * Called when user creates a new cloud project.
   * Creates a blank diagram in the backend and loads it.
   */
  const handleCreateCloudProject = useCallback(
    async (project: Project) => {
      try {
        const emptyCanvas: ProjectFile = { layers: makeInitialLayers(), navStack: [ROOT_LAYER_ID] };
        const diagram = await apiCreateDiagram(project.id, 'main', emptyCanvas);
        loadCanvasFromData(emptyCanvas);
        setBackendDiagramId(diagram.id);
        setCurrentProjectName(project.name);
        setIsReadOnly(false);
        setShowProjectsModal(false);
        setShowStartupModal(false);
        setShowChatPanel(true);
        setIsChatMinimized(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create cloud project');
      }
    },
    [loadCanvasFromData],
  );

  // ── Publish / checkout handlers ───────────────────────────────────────────

  /** Freeze the current draft as a published version. */
  const handlePublish = useCallback(async (comment: string) => {
    if (!backendDiagramId) return;
    setIsPublishing(true);
    try {
      await apiPublishDiagram(backendDiagramId, comment || undefined);
      setIsReadOnly(true);
      setShowPublishModal(false);
      setPublishedVersionCount((n) => n + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  }, [backendDiagramId]);

  /** Create a new draft from the current published version (from within the editor). */
  const handleCheckoutFromEditor = useCallback(async () => {
    if (!backendDiagramId || projectId === 'local') return;
    try {
      const newDraft = await apiCheckoutVersion(projectId, backendDiagramId);
      loadCanvasFromData(newDraft.canvasData as ProjectFile);
      setBackendDiagramId(newDraft.id);
      setIsReadOnly(false);
    } catch (e) {
      if (e instanceof DraftExistsError) {
        const confirmed = window.confirm('A draft already exists for this project. Open it?');
        if (confirmed) {
          const existing = await apiGetProjectDraft(projectId);
          if (existing) {
            loadCanvasFromData(existing.canvasData as ProjectFile);
            setBackendDiagramId(existing.id);
            setIsReadOnly(false);
          }
        }
      } else {
        setError(e instanceof Error ? e.message : 'Checkout failed');
      }
    }
  }, [backendDiagramId, projectId, loadCanvasFromData]);

  // ── Startup modal handlers ────────────────────────────────────────────────

  const handleStartupOpen = useCallback(async () => {
    if (!canUseFileSystemAPI()) {
      setError('File opening requires Chrome or Edge. Use File → Import Project instead.');
      setShowStartupModal(false);
      return;
    }
    setStartupLoading(true);
    try {
      const result = await pickAndReadFile();
      if (!result) return; // user cancelled — keep modal open
      const { handle, data } = result;
      setFileHandle(handle);
      setLayers(data.layers);
      saveAllLayers(data.layers);
      setNavStack(data.navStack?.length ? data.navStack : [ROOT_LAYER_ID]);
      setSelectedNode(null);
      setSelectedEdge(null);
      setLastSaved(null);
      setShowStartupModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open file.');
    } finally {
      setStartupLoading(false);
    }
  }, []);

  const handleStartupNew = useCallback(async () => {
    const emptyProject: ProjectFile = { layers: makeInitialLayers(), navStack: [ROOT_LAYER_ID] };
    if (!canUseFileSystemAPI()) {
      // No File API (Safari): start fresh without a save location
      setLayers(emptyProject.layers);
      saveAllLayers(emptyProject.layers);
      setNavStack(emptyProject.navStack);
      setShowStartupModal(false);
      setShowChatPanel(true);
      setIsChatMinimized(false);
      return;
    }
    setStartupLoading(true);
    try {
      const handle = await pickSaveAndWrite(emptyProject, 'untitled-project.json');
      if (!handle) return; // user cancelled — keep modal open
      setFileHandle(handle);
      setLayers(emptyProject.layers);
      saveAllLayers(emptyProject.layers);
      setNavStack(emptyProject.navStack);
      setLastSaved(new Date());
      setShowStartupModal(false);
      setShowChatPanel(true);
      setIsChatMinimized(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setStartupLoading(false);
    }
  }, []);

  const handleStartupContinue = useCallback(() => {
    setShowStartupModal(false);
    setShowChatPanel(true);
    setIsChatMinimized(false);
  }, []);

  // ── Diagram evaluation (streaming) ────────────────────────────────────────

  const handleEvaluate = useCallback(
    async (onChunk: (chunk: string) => void) => {
      const nodes = (rfInstanceRef.current as ReactFlowInstance | null)?.getNodes() ?? [];
      const edges = (rfInstanceRef.current as ReactFlowInstance | null)?.getEdges() ?? [];
      const layerName = layers[currentLayerId]?.name ?? 'Diagram';
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, layerName }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
        throw new Error(errBody.error ?? 'Evaluation failed');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }
    },
    [currentLayerId, layers],
  );

  // ── Layer navigation ──────────────────────────────────────────────────────

  const navigateTo = useCallback(
    (targetLayerId: string) => {
      const snapshot = captureCanvas(rfInstanceRef);
      setLayers((prev) => {
        const updated = flushCurrentLayer(prev, currentLayerId, snapshot);
        saveAllLayers(updated);
        return updated;
      });
      setNavStack((stack) => {
        const idx = stack.indexOf(targetLayerId);
        if (idx !== -1) return stack.slice(0, idx + 1);
        return [...stack, targetLayerId];
      });
      setSelectedNode(null);
      setSelectedEdge(null);
      setContextMenu(null);
    },
    [currentLayerId, flushCurrentLayer],
  );

  const handleBack = useCallback(() => {
    if (navStack.length <= 1) return;
    const snapshot = captureCanvas(rfInstanceRef);
    setLayers((prev) => {
      const updated = flushCurrentLayer(prev, currentLayerId, snapshot);
      saveAllLayers(updated);
      return updated;
    });
    setNavStack((stack) => stack.slice(0, -1));
    setSelectedNode(null);
    setSelectedEdge(null);
    setContextMenu(null);
  }, [navStack.length, currentLayerId, flushCurrentLayer]);

  // ── Layer update (rename / description) ───────────────────────────────────

  const handleUpdateLayer = useCallback(
    (layerId: string, updates: { name?: string; description?: string }) => {
      setLayers((prev) => {
        const updated = updateLayer(prev, layerId, updates);
        saveAllLayers(updated);
        return updated;
      });
    },
    [],
  );

  // ── Layer delete ──────────────────────────────────────────────────────────

  const handleDeleteLayer = useCallback((layerId: string) => {
    if (!layerId) return; // guard against malformed layers with empty/missing ID
    setDeleteLayerTarget(layerId);
  }, []);

  const handleDeleteLayerConfirm = useCallback(() => {
    if (!deleteLayerTarget) return;

    const deletedIds = collectDescendantIds(layers, deleteLayerTarget);
    const deletedLayer = layers[deleteLayerTarget];
    const snapshot = captureCanvas(rfInstanceRef);

    setLayers((prev) => {
      const flushed = flushCurrentLayer(prev, currentLayerId, snapshot);
      const updated = deleteLayerCascade(flushed, deleteLayerTarget);
      saveAllLayers(updated);
      return updated;
    });

    // If we are currently inside the deleted layer (or a descendant), pop navStack to safety
    if (deletedIds.has(currentLayerId)) {
      setNavStack((stack) => {
        const safe = stack.filter((id) => !deletedIds.has(id));
        return safe.length > 0 ? safe : [ROOT_LAYER_ID];
      });
      setSelectedNode(null);
      setSelectedEdge(null);
    }

    // Clear badge on the parent node in the live canvas (only if parent is current layer)
    if (deletedLayer?.parentLayerId === currentLayerId && deletedLayer.parentNodeId) {
      rfInstanceRef.current?.updateNodeData(deletedLayer.parentNodeId, { _childLayerId: undefined });
    }

    // Persist to cloud
    const diagId = backendDiagramIdRef.current;
    if (diagId) {
      setTimeout(() => {
        const projectData = buildProjectSnapshotRef.current();
        apiUpdateDiagram(diagId, projectData)
          .then(() => setLastSaved(new Date()))
          .catch((err) => console.error('[Delete layer cloud save] Failed:', err));
      }, 200);
    }

    setDeleteLayerTarget(null);
  }, [deleteLayerTarget, layers, currentLayerId, flushCurrentLayer]);

  // ── Assign orphaned layer ─────────────────────────────────────────────────

  const handleAssignLayer = useCallback(() => {
    const node = contextMenu?.node;
    if (!node) return;
    const orphans = getOrphanedLayers(layers);
    if (orphans.length === 0) return;
    setAssignLayerTarget({ nodeId: node.id, nodeLabel: node.data.label, orphans });
    setContextMenu(null);
  }, [contextMenu, layers]);

  const handleAssignLayerConfirm = useCallback(
    (layerId: string) => {
      if (!assignLayerTarget) return;
      const { nodeId } = assignLayerTarget;

      const snapshot = captureCanvas(rfInstanceRef);
      setLayers((prev) => {
        const flushed = flushCurrentLayer(prev, currentLayerId, snapshot);
        const parentLayer = flushed[currentLayerId];
        if (!parentLayer) return prev;
        const updated: LayerMap = {
          ...flushed,
          [layerId]: { ...flushed[layerId], parentLayerId: currentLayerId, parentNodeId: nodeId },
          [currentLayerId]: {
            ...parentLayer,
            nodes: parentLayer.nodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, _childLayerId: layerId } } : n,
            ),
          },
        };
        saveAllLayers(updated);
        return updated;
      });

      // Update live canvas badge immediately
      rfInstanceRef.current?.updateNodeData(nodeId, { _childLayerId: layerId });

      // Persist to cloud
      const diagId = backendDiagramIdRef.current;
      if (diagId) {
        setTimeout(() => {
          const projectData = buildProjectSnapshotRef.current();
          apiUpdateDiagram(diagId, projectData)
            .then(() => setLastSaved(new Date()))
            .catch((err) => console.error('[Assign layer cloud save] Failed:', err));
        }, 200);
      }

      setAssignLayerTarget(null);
      setSelectedNode(null);
    },
    [assignLayerTarget, currentLayerId, flushCurrentLayer],
  );

  // ── Context menu ──────────────────────────────────────────────────────────

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      const sel = (rfInstanceRef.current?.getNodes() ?? []).filter(
        (n) => n.selected,
      ) as Node<NodeData>[];

      // Determine if reassign option should be offered:
      // node must have a child layer AND there must be sibling shapes without one
      let hasReassignableTargets = false;
      const childLayer = findChildLayer(layers, currentLayerId, node.id);
      if (childLayer && !LINE_NODE_TYPES.has(node.type as string)) {
        const nodesWithLayers = new Set(
          Object.values(layers)
            .filter((l) => l.parentLayerId === currentLayerId && l.parentNodeId !== null)
            .map((l) => l.parentNodeId as string),
        );
        const allNodes = (rfInstanceRef.current?.getNodes() ?? []) as Node<NodeData>[];
        hasReassignableTargets = allNodes.some(
          (n) =>
            n.id !== node.id &&
            !LINE_NODE_TYPES.has(n.type as string) &&
            !nodesWithLayers.has(n.id),
        );
      }

      // Determine if "Assign Layer" option should be offered:
      // node must NOT have a child layer, must not be a line type, AND there are orphaned layers
      let hasAssignableOrphans = false;
      if (!childLayer && !LINE_NODE_TYPES.has(node.type as string)) {
        hasAssignableOrphans = getOrphanedLayers(layers).length > 0;
      }

      setContextMenu({ x: event.clientX, y: event.clientY, node, selectedNodes: sel, hasReassignableTargets, hasAssignableOrphans });
    },
    [layers, currentLayerId],
  );

  const handleDrillDown = useCallback(() => {
    const node = contextMenu?.node;
    if (!node) return;
    setContextMenu(null);
    const existing = findChildLayer(layers, currentLayerId, node.id);
    if (existing) {
      navigateTo(existing.id);
    } else {
      setDrillTarget(node);
    }
  }, [contextMenu, layers, currentLayerId, navigateTo]);

  const handleDrillDownConfirm = useCallback(
    (layerName: string) => {
      if (!drillTarget) return;
      const snapshot = captureCanvas(rfInstanceRef);
      // Create the new layer BEFORE setLayers so updater is pure (no side-effects inside)
      const newLayer = createChildLayer(currentLayerId, drillTarget.id, layerName);
      const drillTargetId = drillTarget.id;
      setLayers((prev) => {
        const withCurrentSaved = flushCurrentLayer(prev, currentLayerId, snapshot);
        const parentLayer = withCurrentSaved[currentLayerId];
        const updatedNodes = parentLayer.nodes.map((n) =>
          n.id === drillTargetId
            ? { ...n, data: { ...(n.data as NodeData), _childLayerId: newLayer.id } }
            : n,
        );
        const updated: LayerMap = {
          ...withCurrentSaved,
          [currentLayerId]: { ...parentLayer, nodes: updatedNodes },
          [newLayer.id]: newLayer,
        };
        saveAllLayers(updated);
        return updated;
      });
      // All other state mutations outside the updater to avoid double-invocation in Strict Mode
      setNavStack((stack) => [...stack, newLayer.id]);
      setDrillTarget(null);
      setSelectedNode(null);
    },
    [drillTarget, currentLayerId, flushCurrentLayer],
  );

  const handleReassignLayer = useCallback(() => {
    const node = contextMenu?.node;
    if (!node) return;
    const childLayer = findChildLayer(layers, currentLayerId, node.id);
    if (!childLayer) return;

    const nodesWithLayers = new Set(
      Object.values(layers)
        .filter((l) => l.parentLayerId === currentLayerId && l.parentNodeId !== null)
        .map((l) => l.parentNodeId as string),
    );
    const allNodes = (rfInstanceRef.current?.getNodes() ?? []) as Node<NodeData>[];
    const candidates = allNodes.filter(
      (n) =>
        n.id !== node.id &&
        !LINE_NODE_TYPES.has(n.type as string) &&
        !nodesWithLayers.has(n.id),
    );

    setReassignTarget({
      sourceNodeId: node.id,
      layerId: childLayer.id,
      layerName: childLayer.name,
      targetCandidates: candidates,
    });
    setContextMenu(null);
  }, [contextMenu, layers, currentLayerId]);

  const handleReassignLayerConfirm = useCallback(
    (targetNodeId: string) => {
      if (!reassignTarget) return;
      const { sourceNodeId, layerId } = reassignTarget;

      const snapshot = captureCanvas(rfInstanceRef);
      setLayers((prev) => {
        const flushed = flushCurrentLayer(prev, currentLayerId, snapshot);
        const parentLayer = flushed[currentLayerId];
        if (!parentLayer) return prev;

        // Remove _childLayerId from old owner, add to new owner
        const updatedNodes = parentLayer.nodes.map((n) => {
          if (n.id === sourceNodeId) {
            const { _childLayerId: _removed, ...restData } = n.data as NodeData;
            return { ...n, data: restData };
          }
          if (n.id === targetNodeId) {
            return { ...n, data: { ...n.data, _childLayerId: layerId } };
          }
          return n;
        });

        const updated: LayerMap = {
          ...flushed,
          [currentLayerId]: { ...parentLayer, nodes: updatedNodes },
          [layerId]: { ...flushed[layerId], parentNodeId: targetNodeId },
        };
        saveAllLayers(updated);
        return updated;
      });

      // Also update the live ReactFlow canvas so the badge moves immediately
      rfInstanceRef.current?.updateNodeData(sourceNodeId, { _childLayerId: undefined });
      rfInstanceRef.current?.updateNodeData(targetNodeId, { _childLayerId: layerId });

      setReassignTarget(null);
      setSelectedNode(null);
    },
    [reassignTarget, currentLayerId, flushCurrentLayer],
  );

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    rfInstanceRef.current?.deleteNode(contextMenu.node.id);
    if (selectedNode?.id === contextMenu.node.id) setSelectedNode(null);
    setContextMenu(null);
  }, [contextMenu, selectedNode]);

  const handleBringToFront = useCallback(() => {
    if (!contextMenu) return;
    rfInstanceRef.current?.bringToFront(contextMenu.node.id);
    setContextMenu(null);
  }, [contextMenu]);

  const handleSendToBack = useCallback(() => {
    if (!contextMenu) return;
    rfInstanceRef.current?.sendToBack(contextMenu.node.id);
    setContextMenu(null);
  }, [contextMenu]);

  const handleGroup = useCallback(() => {
    if (!contextMenu) return;
    const ids = contextMenu.selectedNodes.map((n) => n.id);
    rfInstanceRef.current?.groupNodes(ids);
    setContextMenu(null);
    setSelectedNode(null);
  }, [contextMenu]);

  const handleUngroup = useCallback(() => {
    if (!contextMenu) return;
    rfInstanceRef.current?.ungroupNode(contextMenu.node.id);
    setContextMenu(null);
    setSelectedNode(null);
  }, [contextMenu]);

  // ── Palette drag ──────────────────────────────────────────────────────────

  const onPaletteDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  // ── AI generation ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setError(null);
    setGeneratingStatus('Thinking...');
    try {
      // Route through the backend — persists to ai_interactions and uses auth
      const result = await apiGenerateDiagram(
        prompt,
        backendDiagramIdRef.current ?? undefined,
      );
      setGeneratingStatus('Rendering diagram...');
      const diagram = result.data as GenerateResponse;
      rfInstanceRef.current?.loadDiagram(diagram);
      setTimeout(() => {
        (rfInstanceRef.current as ReactFlowInstance | null)?.fitView({ padding: 0.15 });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram');
      throw err;
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  }, []);

  // ── Generate on a new standalone layer ────────────────────────────────────

  const handleGenerateNewLayer = useCallback(
    async (prompt: string, layerName: string) => {
      const newLayer = createStandaloneLayer(layerName);

      const snapshot = captureCanvas(rfInstanceRef);
      setLayers((prev) => {
        const flushed = flushCurrentLayer(prev, currentLayerId, snapshot);
        const updated = { ...flushed, [newLayer.id]: newLayer };
        saveAllLayers(updated);
        return updated;
      });
      setNavStack((stack) => [...stack, newLayer.id]);
      setSelectedNode(null);
      setSelectedEdge(null);

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      await handleGenerate(prompt);
    },
    [currentLayerId, flushCurrentLayer, handleGenerate],
  );

  // ── Canvas operations ─────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    rfInstanceRef.current?.clearDiagram();
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleNew = useCallback(() => {
    handleClear();
    setShowChatPanel(true);
    setIsChatMinimized(false);
  }, [handleClear]);

  const handleExportJson = useCallback(() => {
    const instance = rfInstanceRef.current as ReactFlowInstance | null;
    if (!instance) return;
    downloadJson(instance.toObject(), `${currentLayer?.name ?? 'diagram'}.json`);
  }, [currentLayer?.name]);

  const handleExportPng = useCallback(async () => {
    const el = canvasRef.current;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${currentLayer?.name ?? 'diagram'}.png`;
      a.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    }
  }, [currentLayer?.name]);

  const handleImportJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          rfInstanceRef.current?.loadDiagram(data);
          setTimeout(() => {
            (rfInstanceRef.current as ReactFlowInstance | null)?.fitView({ padding: 0.15 });
          }, 100);
        } else {
          setError('Invalid diagram file — missing nodes or edges arrays.');
        }
      } catch {
        setError('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Project export / import (all layers) ──────────────────────────────────

  const handleExportProject = useCallback(() => {
    const snapshot = captureCanvas(rfInstanceRef);
    setLayers((prev) => {
      const updated = flushCurrentLayer(prev, currentLayerId, snapshot);
      saveAllLayers(updated);
      downloadJson({ layers: updated, navStack }, 'drafter-project.json');
      return updated;
    });
  }, [currentLayerId, flushCurrentLayer, navStack]);

  const handleImportProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const importedLayers: LayerMap =
          data.layers && typeof data.layers === 'object' ? data.layers : data;
        if (
          typeof importedLayers === 'object' &&
          importedLayers !== null &&
          Object.keys(importedLayers).length > 0
        ) {
          saveAllLayers(importedLayers);
          setLayers(importedLayers);
          setNavStack([ROOT_LAYER_ID]);
          setSelectedNode(null);
          setSelectedEdge(null);
          setContextMenu(null);
        } else {
          setError('Invalid project file.');
        }
      } catch {
        setError('Failed to parse project file.');
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Node operations ───────────────────────────────────────────────────────

  const handleNodeUpdate = useCallback((nodeId: string, data: Partial<NodeData>) => {
    rfInstanceRef.current?.updateNodeData(nodeId, data);
    setSelectedNode((prev) =>
      prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev,
    );
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    rfInstanceRef.current?.deleteNode(nodeId);
    setSelectedNode(null);
  }, []);

  // ── Edge operations ───────────────────────────────────────────────────────

  const handleEdgeSelect = useCallback((edge: Edge | null) => {
    setSelectedEdge(edge);
    if (edge) setSelectedNode(null);
  }, []);

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<Edge>) => {
    rfInstanceRef.current?.updateEdge(edgeId, updates);
    setSelectedEdge((prev) => (prev?.id === edgeId ? { ...prev, ...updates } : prev));
  }, []);

  const handleEdgeDelete = useCallback((edgeId: string) => {
    rfInstanceRef.current?.deleteEdge(edgeId);
    setSelectedEdge(null);
  }, []);

  // ── Node select ───────────────────────────────────────────────────────────

  const handleNodeSelect = useCallback((node: Node<NodeData> | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  // ── Inline label editing ──────────────────────────────────────────────────

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editInitialChar, setEditInitialChar] = useState<string | null>(null);

  const startEditing = useCallback((nodeId: string, initialChar?: string) => {
    setEditingNodeId(nodeId);
    setEditInitialChar(initialChar ?? null);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingNodeId(null);
    setEditInitialChar(null);
  }, []);

  // ── Click-to-add from palette ─────────────────────────────────────────────

  const handleAddNode = useCallback((nodeType: NodeType) => {
    rfInstanceRef.current?.addNodeAtCenter(nodeType);
  }, []);

  // ── CanvasContext value ───────────────────────────────────────────────────
  const canvasContextValue = useMemo(
    () => ({
      navigateTo,
      updateNodeData: (nodeId: string, data: Partial<NodeData>) =>
        rfInstanceRef.current?.updateNodeData(nodeId, data),
      editingNodeId,
      editInitialChar,
      startEditing,
      stopEditing,
      pushHistoryNow: () => rfInstanceRef.current?.pushHistoryNow(),
      animateLines: animateEdges,
    }),
    [navigateTo, editingNodeId, editInitialChar, startEditing, stopEditing, animateEdges],
  );

  // ── Right sidebar visibility ──────────────────────────────────────────────
  const showRightSidebar = showLayersPanel || !!selectedNode || (!!selectedEdge && !selectedNode);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CanvasContext.Provider value={canvasContextValue}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          {/* ── Menu bar ────────────────────────────────────────────────── */}
          <MenuBar
            onNew={handleNew}
            onOpenFile={handleOpenFile}
            onSaveFile={handleSaveFile}
            hasFileHandle={!!fileHandle}
            onImportJson={handleImportJson}
            onExportJson={handleExportJson}
            onExportPng={handleExportPng}
            onImportProject={handleImportProject}
            onExportProject={handleExportProject}
            onOpenDiff={() => router.push('/diff')}
            layersVisible={showLayersPanel}
            onToggleLayers={() => setShowLayersPanel((v) => !v)}
            onShowAI={() => {
              setShowChatPanel(true);
              setIsChatMinimized(false);
            }}
            userEmail={user?.email ?? null}
            onSignIn={() => setShowAuthModal(true)}
            onMyProjects={() => router.push('/projects')}
            onSignOut={handleSignOut}
            projectName={currentProjectName}
            isCloudProject={!!backendDiagramId && projectId !== 'local'}
            isReadOnly={isReadOnly}
            onPublish={() => setShowPublishModal(true)}
          />

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <Toolbar
            onClear={handleClear}
            hasFileHandle={!!fileHandle}
            hasCloudProject={!!backendDiagramId || (projectId !== 'local' && isLoggedIn())}
            autoSave={autoSave}
            onToggleAutoSave={() => setAutoSave((v) => !v)}
            onSaveFile={handleSaveFile}
            isSaving={isSaving}
            lastSaved={lastSaved}
            animateEdges={animateEdges}
            onToggleAnimateEdges={() => setAnimateEdges((v) => !v)}
          />

          {/* ── Layer breadcrumb bar ─────────────────────────────────────── */}
          <LayerBar
            layers={layers}
            currentLayerId={currentLayerId}
            canGoBack={navStack.length > 1}
            onBack={handleBack}
            onNavigate={navigateTo}
          />

          {error && (
            <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              <span className="font-medium">Error:</span>
              <span>{error}</span>
              <div className="ml-auto flex items-center gap-2">
                {projectId !== 'local' && (
                  <button
                    onClick={retryAutoLoad}
                    className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/30"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Read-only banner (shown when viewing a published diagram) ──── */}
          {isReadOnly && (
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900 dark:bg-amber-900/20">
              <span className="text-amber-700 dark:text-amber-400">
                This is a published version — read only.
              </span>
              <button
                onClick={handleCheckoutFromEditor}
                className="ml-auto rounded border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
              >
                Check Out to Edit
              </button>
            </div>
          )}

          {/* ── Main content area ────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">
            <NodePalette onDragStart={onPaletteDragStart} onAddNode={handleAddNode} />

            <DiagramCanvas
              key={`${currentLayerId}_${canvasLoadKey}`}
              initialNodes={(currentLayer?.nodes ?? []) as Node<NodeData>[]}
              initialEdges={currentLayer?.edges ?? []}
              onLayerSave={handleLayerSave}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              rfInstanceRef={rfInstanceRef}
              canvasRef={canvasRef}
              clipboardRef={clipboardRef}
              onRequestEdit={startEditing}
              animateEdges={animateEdges}
              readOnly={isReadOnly}
            />

            {/* ── Right sidebar ─────────────────────────────────────────── */}
            {showRightSidebar && (
              <div className="flex h-full flex-shrink-0">
                {showLayersPanel && (
                  <LayersPanel
                    docked
                    layers={layers}
                    currentLayerId={currentLayerId}
                    onClose={() => setShowLayersPanel(false)}
                    onNavigate={navigateTo}
                    onUpdateLayer={handleUpdateLayer}
                    onDeleteLayer={handleDeleteLayer}
                  />
                )}
                {selectedNode && (
                  <PropertiesPanel
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onUpdate={handleNodeUpdate}
                    onDelete={handleNodeDelete}
                  />
                )}
                {selectedEdge && !selectedNode && (
                  <EdgePropertiesPanel
                    edge={selectedEdge}
                    onClose={() => setSelectedEdge(null)}
                    onUpdate={handleEdgeUpdate}
                    onDelete={handleEdgeDelete}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Context menu ────────────────────────────────────────────────── */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeLabel={contextMenu.node.data.label}
            hasChildLayer={!!findChildLayer(layers, currentLayerId, contextMenu.node.id)}
            isLine={LINE_NODE_TYPES.has(contextMenu.node.type as string)}
            isGroup={contextMenu.node.type === 'group'}
            selectedCount={contextMenu.selectedNodes.length}
            onDrillDown={handleDrillDown}
            onDelete={handleContextMenuDelete}
            onClose={() => setContextMenu(null)}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            hasReassignableTargets={contextMenu.hasReassignableTargets}
            onReassignLayer={handleReassignLayer}
            hasAssignableOrphans={contextMenu.hasAssignableOrphans}
            onAssignLayer={handleAssignLayer}
          />
        )}

        {/* ── Drill-down naming modal ──────────────────────────────────────── */}
        {drillTarget && (
          <DrillDownModal
            defaultName={`${drillTarget.data.label} Layer`}
            onConfirm={handleDrillDownConfirm}
            onCancel={() => setDrillTarget(null)}
          />
        )}

        {/* ── Reassign layer modal ─────────────────────────────────────────── */}
        {reassignTarget && (
          <ReassignLayerModal
            layerName={reassignTarget.layerName}
            targetCandidates={reassignTarget.targetCandidates}
            onConfirm={handleReassignLayerConfirm}
            onCancel={() => setReassignTarget(null)}
          />
        )}

        {/* ── Delete layer confirmation modal ─────────────────────────────────── */}
        {deleteLayerTarget != null && layers[deleteLayerTarget] != null && (
          <DeleteLayerModal
            layerName={layers[deleteLayerTarget].name || 'Untitled Layer'}
            descendantCount={collectDescendantIds(layers, deleteLayerTarget).size - 1}
            onConfirm={handleDeleteLayerConfirm}
            onCancel={() => setDeleteLayerTarget(null)}
          />
        )}

        {/* ── Assign orphaned layer modal ───────────────────────────────────────── */}
        {assignLayerTarget && (
          <AssignLayerModal
            shapeLabel={assignLayerTarget.nodeLabel}
            orphanedLayers={assignLayerTarget.orphans}
            onConfirm={handleAssignLayerConfirm}
            onCancel={() => setAssignLayerTarget(null)}
          />
        )}

        {/* ── File-load prompt (shown when URL layer not found locally) ──────── */}
        {showFileLoadPrompt && (
          <FileLoadPrompt
            targetLayerId={showFileLoadPrompt}
            onOpenFile={() => handleOpenFileForURL(showFileLoadPrompt)}
            onDismiss={() => setShowFileLoadPrompt(null)}
            isLoading={fileLoadPending}
          />
        )}

        {/* ── Startup modal ────────────────────────────────────────────────── */}
        {showStartupModal && !showFileLoadPrompt && (
          <StartupModal
            onOpen={handleStartupOpen}
            onNew={handleStartupNew}
            onContinue={handleStartupContinue}
            isLoading={startupLoading}
            existingLayerCount={Object.keys(layers).length - 1}
            userEmail={user?.email ?? null}
            onSignIn={() => setShowAuthModal(true)}
            onMyProjects={() => router.push('/projects')}
          />
        )}

        {/* ── Auth modal ───────────────────────────────────────────────────── */}
        {showAuthModal && (
          <AuthModal
            onSuccess={handleAuthSuccess}
            onClose={() => setShowAuthModal(false)}
          />
        )}

        {/* ── Projects modal ───────────────────────────────────────────────── */}
        {showProjectsModal && (
          <ProjectsModal
            onOpen={handleOpenCloudProject}
            onCreate={handleCreateCloudProject}
            onClose={() => setShowProjectsModal(false)}
          />
        )}

        {/* ── Publish modal ────────────────────────────────────────────────── */}
        {showPublishModal && (
          <PublishModal
            nextVersionNumber={publishedVersionCount + 1}
            isPublishing={isPublishing}
            onPublish={handlePublish}
            onCancel={() => setShowPublishModal(false)}
          />
        )}

        {/* ── AI chat panel — only shown when user is signed in ───────────── */}
        {showChatPanel && !!user && (
          <AIChatPanel
            onGenerate={handleGenerate}
            onGenerateNewLayer={handleGenerateNewLayer}
            onEvaluate={handleEvaluate}
            isLoading={isGenerating}
            status={generatingStatus}
            isMinimized={isChatMinimized}
            onMinimize={() => setIsChatMinimized(true)}
            onExpand={() => setIsChatMinimized(false)}
            onClose={() => setShowChatPanel(false)}
            hasNodes={hasNodes}
          />
        )}
      </ReactFlowProvider>
    </CanvasContext.Provider>
  );
}
