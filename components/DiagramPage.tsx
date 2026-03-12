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
import ThreatModelPanel, { type ThreatModelInfo } from '@/components/ThreatModelPanel';
import { Lock, ArrowRight } from 'lucide-react';
import FileLoadPrompt from '@/components/FileLoadPrompt';
import StartupModal from '@/components/StartupModal';
import AuthModal from '@/components/AuthModal';
import ProjectsModal from '@/components/ProjectsModal';
import PublishModal from '@/components/PublishModal';
import type { AssignableLayer } from '@/components/AssignLayerModal';

import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';
import type { UserProfile, Project, ChatMessage, ThreatItem, ThreatModelFull } from '@/lib/api';
import {
  apiUpdateDiagram, apiCreateDiagram, apiGenerateDiagram,
  apiPublishDiagram, apiListProjectVersions, apiGetProjectDraft,
  apiGetDiagram, apiGetProject, apiCheckoutVersion, DraftExistsError,
  apiChatGenerate, apiChatEvaluate, apiGetChatHistory,
  apiRunThreatAnalysis, apiSaveThreatModel,
} from '@/lib/api';
import { getStoredUser, clearTokens, isLoggedIn, isLocalMode, clearLocalMode } from '@/lib/authStore';
import {
  loadAllLayers,
  saveAllLayers,
  clearLayersStorage,
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

interface DiagramPageProps {
  projectId: string;
  /** Diagram ID passed from the Server Component page via ?view=diagramId search param.
   *  When set, load this specific diagram rather than the project draft. */
  viewDiagramId?: string;
}

export default function DiagramPage({ projectId, viewDiagramId }: DiagramPageProps) {
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
  const saveFileRef = useRef<() => Promise<void>>(() => Promise.resolve()); // set after handleSaveFile is declared
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
      // Clear stored diagram data so the next user doesn't see stale layers
      clearLayersStorage();
      const fresh = makeInitialLayers();
      setLayers(fresh);
      setNavStack([ROOT_LAYER_ID]);
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
      } else if (e.key === 'i') {
        e.preventDefault();
        setShowChatPanel((v) => !v);
      } else if (e.key === 'M' && e.shiftKey) {
        // Cmd+Shift+M — Threat Model panel (Cmd+T and Cmd+Shift+T are browser-reserved for tab management)
        e.preventDefault();
        setShowThreatModelPanel((v) => !v);
      } else if (e.key === 'S' && e.shiftKey) {
        // Cmd+Shift+S — Save (Cmd+S triggers browser save dialog)
        e.preventDefault();
        saveFileRef.current();
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

  // AI chat panel — hidden by default; toggle with Cmd+I
  const [showChatPanel, setShowChatPanel] = useState(false);
  // Chat history loaded from backend for cloud projects
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Threat Model panel — hidden by default; toggle with Cmd+T
  const [showThreatModelPanel, setShowThreatModelPanel] = useState(false);
  // Accumulated threats from AI analysis runs, keyed by layerId
  const [threatPanelThreats, setThreatPanelThreats] = useState<ThreatItem[]>([]);
  const [threatModelInfo, setThreatModelInfo] = useState<ThreatModelInfo | null>(null);
  // When user clicks a canvas threat badge → highlights that node in ThreatModelPanel
  const [canvasBadgeTargetId, setCanvasBadgeTargetId] = useState<string | null>(null);

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

  // Assign layer modal — shows orphaned layers + layers owned by sibling shapes
  const [assignLayerTarget, setAssignLayerTarget] = useState<{
    nodeId: string;
    nodeLabel: string;
    availableLayers: AssignableLayer[];
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
  // If viewDiagramId prop is set (from ?view= search param), load that specific diagram.
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (projectId === 'local' || !isLoggedIn() || backendDiagramId || autoLoadedRef.current) return;
    autoLoadedRef.current = true;

    (async () => {
      try {
        // Load project name in background — non-blocking, failure is non-fatal
        apiGetProject(projectId)
          .then((proj) => setCurrentProjectName(proj.name))
          .catch(() => {/* non-fatal */});

        // Load chat history in background — non-blocking
        apiGetChatHistory(projectId)
          .then((msgs) => setChatHistory(msgs))
          .catch(() => {/* non-fatal */});

        // viewDiagramId prop — load a specific diagram by ID (passed from page searchParams)
        if (viewDiagramId) {
          const full = await apiGetDiagram(viewDiagramId);
          loadCanvasFromDataRef.current(full.canvasData as ProjectFile);
          setBackendDiagramId(full.id);
          const isDraft = (full as { status?: string }).status === 'draft';
          setIsReadOnly(!isDraft);
          if (isDraft) {
            // Load version count in background so Publish button shows correct next version
            apiListProjectVersions(projectId)
              .then((v) => setPublishedVersionCount(v.filter((d) => d.status === 'published').length))
              .catch(() => {/* non-fatal */});
          }
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
  }, [projectId, viewDiagramId]);

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
  useEffect(() => { saveFileRef.current = handleSaveFile; }, [handleSaveFile]);

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
    // Remove diagram data entirely so the next user starts clean
    clearLayersStorage();
    setLayers(makeInitialLayers());
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setStartupLoading(false);
    }
  }, []);

  const handleStartupContinue = useCallback(() => {
    setShowStartupModal(false);
    setShowChatPanel(true);
  }, []);

  // ── Diagram evaluation (streaming) ────────────────────────────────────────

  const handleEvaluate = useCallback(
    async (onChunk: (chunk: string) => void, userQuestion?: string) => {
      const nodes = (rfInstanceRef.current as ReactFlowInstance | null)?.getNodes() ?? [];
      const edges = (rfInstanceRef.current as ReactFlowInstance | null)?.getEdges() ?? [];
      const layerName = layers[currentLayerId]?.name ?? 'Diagram';
      const isCloud = projectId !== 'local' && isLoggedIn();
      if (isCloud) {
        // Cloud: route through drafter-rest — saves both messages to chat history server-side
        await apiChatEvaluate(
          { nodes, edges, layerName, userQuestion, projectId, layerId: currentLayerId },
          onChunk,
        );
      } else {
        // Local fallback — Next.js API route, no history
        const response = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, edges, layerName, userQuestion }),
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
      }
    },
    [currentLayerId, layers, projectId],
  );

  // ── STRIDE Threat Analysis ────────────────────────────────────────────────

  const handleThreatAnalysis = useCallback(async (): Promise<ThreatItem[]> => {
    const nodes = (rfInstanceRef.current as ReactFlowInstance | null)?.getNodes() ?? [];
    const edges = (rfInstanceRef.current as ReactFlowInstance | null)?.getEdges() ?? [];
    const layer = layers[currentLayerId];

    // Split trust boundary nodes from regular nodes
    const trustBoundaries = nodes
      .filter((n) => n.type === 'trustboundary')
      .map((n) => ({ id: n.id, label: n.data?.label ?? 'Trust Boundary', trustLevel: n.data?.trustLevel ?? 'custom' }));

    const regularNodes = nodes
      .filter((n) => n.type !== 'trustboundary')
      .map((n) => ({
        id: n.id,
        type: n.type ?? 'unknown',
        label: n.data?.label ?? n.id,
        technology: n.data?.technology,
        description: n.data?.description,
        trustLevel: n.data?.trustLevel,
      }));

    const serializedEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));

    const diagramId = backendDiagramIdRef.current ?? 'local';
    const result = await apiRunThreatAnalysis({
      diagramId,
      layerId: currentLayerId,
      layerName: layer?.name ?? 'Diagram',
      nodes: regularNodes,
      edges: serializedEdges,
      trustBoundaries,
    });

    // Merge new threats for this layer into the panel (replace any prior run for this layer)
    setThreatPanelThreats((prev) => [
      ...prev.filter((t) => t.layerId !== currentLayerId),
      ...result.threats,
    ]);
    setThreatModelInfo({ name: 'Current Analysis', isSaved: false });
    setShowThreatModelPanel(true);

    return result.threats;
  }, [currentLayerId, layers]);

  const handleSaveThreatModel = useCallback(
    async (name: string, threats: ThreatItem[]) => {
      if (projectId === 'local' || !backendDiagramIdRef.current) {
        throw new Error('Sign in to save threat models');
      }
      const nodes = (rfInstanceRef.current as ReactFlowInstance | null)?.getNodes() ?? [];
      const edges = (rfInstanceRef.current as ReactFlowInstance | null)?.getEdges() ?? [];
      const layer = layers[currentLayerId];
      const snapshotData = { nodes, edges, layerName: layer?.name };

      await apiSaveThreatModel(projectId, {
        name,
        diagramId: backendDiagramIdRef.current,
        diagramVersion: 1,
        snapshotData,
        threats,
      });
    },
    [currentLayerId, layers, projectId],
  );

  /** Save all current transient threats as a named model (called from ThreatModelPanel) */
  const handleSaveThreatModelFromPanel = useCallback(
    async (name: string) => {
      if (projectId === 'local' || !backendDiagramIdRef.current) {
        throw new Error('Sign in to save threat models');
      }
      const nodes = (rfInstanceRef.current as ReactFlowInstance | null)?.getNodes() ?? [];
      const edges = (rfInstanceRef.current as ReactFlowInstance | null)?.getEdges() ?? [];
      const snapshotData = { nodes, edges };
      const saved = await apiSaveThreatModel(projectId, {
        name,
        diagramId: backendDiagramIdRef.current,
        diagramVersion: 1,
        snapshotData,
        threats: threatPanelThreats,
      });
      setThreatPanelThreats(saved.threats);
      setThreatModelInfo({ name, isSaved: true, threatModelId: saved.id });
    },
    [projectId, threatPanelThreats],
  );

  /** Load a saved threat model into the panel */
  const handleLoadModelToPanel = useCallback((model: ThreatModelFull) => {
    setThreatPanelThreats(model.threats);
    setThreatModelInfo({ name: model.name, version: model.diagramVersion, isSaved: true, threatModelId: model.id });
  }, []);

  /** Highlight a node or edge on the canvas by targetId */
  const handleHighlightThreatTarget = useCallback((targetId: string) => {
    (rfInstanceRef.current as ExtendedRFInstance | null)?.highlightThreatTarget(targetId);
  }, []);

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

    // Orphaned layers (no parentNodeId — standalone/unattached)
    const orphans = getOrphanedLayers(layers);

    // Layers currently owned by OTHER shapes in the same parent layer (1 level deep)
    const allCanvasNodes = (rfInstanceRef.current?.getNodes() ?? []) as Node<NodeData>[];
    const nodeLabel = (id: string) =>
      allCanvasNodes.find((n) => n.id === id)?.data?.label ?? '(unlabelled)';

    const siblingOwned = Object.values(layers).filter(
      (l) => l.parentLayerId === currentLayerId && l.parentNodeId !== null && l.parentNodeId !== node.id,
    );

    const availableLayers: AssignableLayer[] = [
      ...orphans.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        nodeCount: l.nodes.length,
      })),
      ...siblingOwned.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        nodeCount: l.nodes.length,
        currentOwnerLabel: nodeLabel(l.parentNodeId!),
      })),
    ];

    if (availableLayers.length === 0) return;
    setAssignLayerTarget({ nodeId: node.id, nodeLabel: node.data.label, availableLayers });
    setContextMenu(null);
  }, [contextMenu, layers, currentLayerId]);

  const handleAssignLayerConfirm = useCallback(
    (layerId: string) => {
      if (!assignLayerTarget) return;
      const { nodeId } = assignLayerTarget;

      // If this layer was previously owned by another shape, we need to clear that badge
      const previousOwnerNodeId = layers[layerId]?.parentNodeId ?? null;
      const hasPreviousOwner = previousOwnerNodeId !== null && previousOwnerNodeId !== nodeId;

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
            nodes: parentLayer.nodes.map((n) => {
              if (n.id === nodeId) return { ...n, data: { ...n.data, _childLayerId: layerId } };
              // Clear the badge from the previous owner
              if (hasPreviousOwner && n.id === previousOwnerNodeId) {
                const { _childLayerId: _removed, ...restData } = n.data as NodeData;
                return { ...n, data: restData };
              }
              return n;
            }),
          },
        };
        saveAllLayers(updated);
        return updated;
      });

      // Update live canvas badges immediately
      rfInstanceRef.current?.updateNodeData(nodeId, { _childLayerId: layerId });
      if (hasPreviousOwner && previousOwnerNodeId) {
        rfInstanceRef.current?.updateNodeData(previousOwnerNodeId, { _childLayerId: undefined });
      }

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
    [assignLayerTarget, layers, currentLayerId, flushCurrentLayer],
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
      // node must NOT have a child layer, must not be a line type, AND there are layers to assign
      // (either orphaned layers OR layers currently owned by a sibling shape in this parent layer).
      let hasAssignableOrphans = false;
      if (!childLayer && !LINE_NODE_TYPES.has(node.type as string)) {
        const hasSiblingLayers = Object.values(layers).some(
          (l) => l.parentLayerId === currentLayerId && l.parentNodeId !== null && l.parentNodeId !== node.id,
        );
        hasAssignableOrphans = hasSiblingLayers || getOrphanedLayers(layers).length > 0;
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

      // Persist to cloud
      const diagId = backendDiagramIdRef.current;
      if (diagId) {
        setTimeout(() => {
          const projectData = buildProjectSnapshotRef.current();
          apiUpdateDiagram(diagId, projectData)
            .then(() => setLastSaved(new Date()))
            .catch((err) => console.error('[Reassign layer cloud save] Failed:', err));
        }, 200);
      }

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
      let diagram: GenerateResponse;
      const isCloud = projectId !== 'local' && isLoggedIn();
      if (isCloud) {
        // Cloud: use chat-specific endpoint — saves to chat history
        diagram = await apiChatGenerate({
          prompt,
          projectId,
          diagramId: backendDiagramIdRef.current ?? undefined,
          layerId: currentLayerId,
          layerName: layers[currentLayerId]?.name,
        }) as GenerateResponse;
      } else {
        // Local fallback — Next.js API route, no history
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (!response.ok) throw new Error('Generation failed');
        diagram = await response.json() as GenerateResponse;
      }
      setGeneratingStatus('Rendering diagram...');
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
  }, [currentLayerId, layers, projectId]);

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
            onShowAI={() => setShowChatPanel(true)}
            onShowThreatModel={projectId !== 'local' && !!user ? () => setShowThreatModelPanel((v) => !v) : undefined}
            onShowAIHistory={() => {
              if (projectId !== 'local' && isLoggedIn()) {
                router.push(`/projects/${projectId}/ai-history`);
              }
            }}
            userEmail={user?.email ?? null}
            onSignIn={() => setShowAuthModal(true)}
            onSignOut={handleSignOut}
            isCloudProject={!!backendDiagramId && projectId !== 'local'}
            projectId={projectId !== 'local' ? projectId : undefined}
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
            onMyProjects={() => router.push('/projects')}
            onCopy={() => rfInstanceRef.current?.doCopy()}
            onPaste={() => rfInstanceRef.current?.doPaste()}
            isReadOnly={isReadOnly}
          />

          {/* ── Layer breadcrumb bar ─────────────────────────────────────── */}
          <LayerBar
            layers={layers}
            currentLayerId={currentLayerId}
            canGoBack={navStack.length > 1}
            onBack={handleBack}
            onNavigate={navigateTo}
            projectName={currentProjectName}
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

          {/* ── Published read-only banner ───────────────────────────────── */}
          {isReadOnly && (
            <div
              className="relative flex flex-shrink-0 items-center gap-3 overflow-hidden px-4 py-2.5"
              style={{ background: 'linear-gradient(90deg, #1e1b4b 0%, #1e3a8a 60%, #0f172a 100%)' }}
            >
              {/* Subtle mesh glow */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-10 top-0 h-16 w-32 rounded-full bg-indigo-400/10 blur-2xl" />
                <div className="absolute right-32 top-0 h-12 w-24 rounded-full bg-blue-400/8 blur-2xl" />
              </div>
              {/* Lock icon */}
              <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20">
                <Lock size={11} className="text-indigo-300" />
              </div>
              {/* Labels */}
              <div className="relative flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Published version</span>
                {publishedVersionCount > 0 && (
                  <span className="rounded-full bg-indigo-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200 ring-1 ring-indigo-400/30">
                    v{publishedVersionCount}
                  </span>
                )}
                <span className="text-indigo-400/60">·</span>
                <span className="text-xs text-indigo-300/70">Read only</span>
              </div>
              {/* CTA */}
              <button
                onClick={handleCheckoutFromEditor}
                className="relative ml-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/20"
              >
                Check Out to Edit
                <ArrowRight size={11} />
              </button>
            </div>
          )}

          {/* ── Main content area ────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">
            {/* Components palette — collapses smoothly when Threat Model panel opens */}
            {!isReadOnly && (
              <div className={`overflow-hidden transition-[max-width] duration-300 ease-in-out flex-shrink-0 ${showThreatModelPanel ? 'max-w-0' : 'max-w-[240px]'}`}>
                <NodePalette onDragStart={onPaletteDragStart} onAddNode={handleAddNode} />
              </div>
            )}

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
              threatOverlays={showThreatModelPanel ? threatPanelThreats.filter((t) => t.layerId === currentLayerId) : undefined}
              activeThreatTargetId={canvasBadgeTargetId}
              onThreatNodeClick={(targetId) => {
                handleHighlightThreatTarget(targetId);
                setCanvasBadgeTargetId(targetId);
              }}
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

            {/* ── Threat Model panel — docked right, cloud projects only ──────── */}
            {showThreatModelPanel && !!user && projectId !== 'local' && (
              <ThreatModelPanel
                currentLayerId={currentLayerId}
                threats={threatPanelThreats}
                modelInfo={threatModelInfo}
                projectId={projectId}
                onHighlightTarget={handleHighlightThreatTarget}
                externalTargetId={canvasBadgeTargetId}
                onExternalTargetConsumed={() => setCanvasBadgeTargetId(null)}
                onOpenAIAssistant={() => { setShowChatPanel(true); setShowThreatModelPanel(false); }}
                onSave={handleSaveThreatModelFromPanel}
                onLoadModel={handleLoadModelToPanel}
                onThreatsChanged={setThreatPanelThreats}
                onClose={() => setShowThreatModelPanel(false)}
              />
            )}

            {/* ── AI chat panel — docked right, only when signed in ─────────── */}
            {showChatPanel && !!user && (
              <AIChatPanel
                onGenerate={handleGenerate}
                onGenerateNewLayer={handleGenerateNewLayer}
                onEvaluate={handleEvaluate}
                onThreatAnalysis={projectId !== 'local' ? handleThreatAnalysis : undefined}
                onSaveThreatModel={projectId !== 'local' ? handleSaveThreatModel : undefined}
                projectId={projectId !== 'local' ? projectId : undefined}
                isLoading={isGenerating}
                status={generatingStatus}
                onClose={() => setShowChatPanel(false)}
                hasNodes={hasNodes}
                isReadOnly={isReadOnly}
                initialMessages={chatHistory.map((m) => ({ role: m.role, content: m.content }))}
              />
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

        {/* ── Assign layer modal ───────────────────────────────────────── */}
        {assignLayerTarget && (
          <AssignLayerModal
            shapeLabel={assignLayerTarget.nodeLabel}
            availableLayers={assignLayerTarget.availableLayers}
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

      </ReactFlowProvider>
    </CanvasContext.Provider>
  );
}
