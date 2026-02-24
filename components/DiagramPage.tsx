'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
import AIChatPanel from '@/components/AIChatPanel';
import FileLoadPrompt from '@/components/FileLoadPrompt';

import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';
import {
  loadAllLayers,
  saveAllLayers,
  createChildLayer,
  createStandaloneLayer,
  findChildLayer,
  getLayerPath,
  updateLayer,
  ROOT_LAYER_ID,
  type LayerMap,
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
}

export default function DiagramPage({ projectId }: DiagramPageProps) {
  const rfInstanceRef = useRef<ExtendedRFInstance | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

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

  // Refs so auto-save interval can access latest state without stale closures
  const layersRef = useRef(layers);
  const navStackRef = useRef(navStack);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { navStackRef.current = navStack; }, [navStack]);
  useEffect(() => { fileHandleRef.current = fileHandle; }, [fileHandle]);

  // ── URL file-load prompt — shown when currLayer param exists but not found locally ──
  const [showFileLoadPrompt, setShowFileLoadPrompt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const param = readCurrLayerParam();
    if (!param) return null;
    const allLayers = loadAllLayers();
    return allLayers[param] ? null : param;
  });
  const [fileLoadPending, setFileLoadPending] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  // AI chat panel — open on initial load
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: Node<NodeData>;
    selectedNodes: Node<NodeData>[];
  } | null>(null);

  // Drill-down naming modal
  const [drillTarget, setDrillTarget] = useState<Node<NodeData> | null>(null);

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

  // ── Auto-save interval (every 60 s when ON + file handle is set) ─────────
  useEffect(() => {
    if (!autoSave) return;
    const id = setInterval(async () => {
      const handle = fileHandleRef.current;
      if (!handle) return;
      try {
        const projectData: ProjectFile = {
          layers: layersRef.current,
          navStack: navStackRef.current,
        };
        await writeToHandle(handle, projectData);
        setLastSaved(new Date());
      } catch (err) {
        console.error('[Auto-save] Failed:', err);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [autoSave]);

  // ── Persist helpers ───────────────────────────────────────────────────────

  const flushCurrentLayer = useCallback(
    (prev: LayerMap, layerId: string): LayerMap => {
      const snapshot = captureCanvas(rfInstanceRef);
      if (!snapshot) return prev;
      return {
        ...prev,
        [layerId]: { ...prev[layerId], nodes: snapshot.nodes, edges: snapshot.edges },
      };
    },
    [],
  );

  const handleLayerSave = useCallback(
    (nodes: Node<NodeData>[], edges: Edge[]) => {
      setLayers((prev) => {
        const updated = {
          ...prev,
          [currentLayerId]: { ...prev[currentLayerId], nodes, edges },
        };
        saveAllLayers(updated); // localStorage cache
        return updated;
      });
    },
    [currentLayerId],
  );

  // ── File operations ───────────────────────────────────────────────────────

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

  /** Save to the current file handle (or open Save-As picker if none). */
  const handleSaveFile = useCallback(async () => {
    const data = buildProjectSnapshot();
    if (fileHandle) {
      try {
        await writeToHandle(fileHandle, data);
        setLastSaved(new Date());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Save failed.');
      }
    } else if (canUseFileSystemAPI()) {
      try {
        const handle = await pickSaveAndWrite(data);
        if (handle) {
          setFileHandle(handle);
          setLastSaved(new Date());
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Save failed.');
      }
    } else {
      // Fallback: browser download
      downloadProjectFile(data);
    }
  }, [fileHandle, buildProjectSnapshot]);

  // ── Layer navigation ──────────────────────────────────────────────────────

  const navigateTo = useCallback(
    (targetLayerId: string) => {
      setLayers((prev) => {
        const updated = flushCurrentLayer(prev, currentLayerId);
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
    setLayers((prev) => {
      const updated = flushCurrentLayer(prev, currentLayerId);
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

  // ── Context menu ──────────────────────────────────────────────────────────

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      const sel = (rfInstanceRef.current?.getNodes() ?? []).filter(
        (n) => n.selected,
      ) as Node<NodeData>[];
      setContextMenu({ x: event.clientX, y: event.clientY, node, selectedNodes: sel });
    },
    [],
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
      setLayers((prev) => {
        const withCurrentSaved = flushCurrentLayer(prev, currentLayerId);
        const newLayer = createChildLayer(currentLayerId, drillTarget.id, layerName);
        const parentLayer = withCurrentSaved[currentLayerId];
        const updatedNodes = parentLayer.nodes.map((n) =>
          n.id === drillTarget.id
            ? { ...n, data: { ...(n.data as NodeData), _childLayerId: newLayer.id } }
            : n,
        );
        const updated: LayerMap = {
          ...withCurrentSaved,
          [currentLayerId]: { ...parentLayer, nodes: updatedNodes },
          [newLayer.id]: newLayer,
        };
        saveAllLayers(updated);
        setNavStack((stack) => [...stack, newLayer.id]);
        setDrillTarget(null);
        setSelectedNode(null);
        return updated;
      });
    },
    [drillTarget, currentLayerId, flushCurrentLayer],
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
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      setGeneratingStatus('Rendering diagram...');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
        }
      } else {
        accumulated = await res.text();
      }
      const diagram: GenerateResponse = JSON.parse(accumulated);
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

      setLayers((prev) => {
        const flushed = flushCurrentLayer(prev, currentLayerId);
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
    setLayers((prev) => {
      const updated = flushCurrentLayer(prev, currentLayerId);
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
    }),
    [navigateTo, editingNodeId, editInitialChar, startEditing, stopEditing],
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
            layersVisible={showLayersPanel}
            onToggleLayers={() => setShowLayersPanel((v) => !v)}
            onShowAI={() => {
              setShowChatPanel(true);
              setIsChatMinimized(false);
            }}
          />

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <Toolbar
            onClear={handleClear}
            hasFileHandle={!!fileHandle}
            autoSave={autoSave}
            onToggleAutoSave={() => setAutoSave((v) => !v)}
            onSaveFile={handleSaveFile}
            lastSaved={lastSaved}
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
            <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              <span className="font-medium">Error:</span>
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ── Main content area ────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">
            <NodePalette onDragStart={onPaletteDragStart} onAddNode={handleAddNode} />

            <DiagramCanvas
              key={currentLayerId}
              initialNodes={(currentLayer?.nodes ?? []) as Node<NodeData>[]}
              initialEdges={currentLayer?.edges ?? []}
              onLayerSave={handleLayerSave}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              rfInstanceRef={rfInstanceRef}
              canvasRef={canvasRef}
              onRequestEdit={startEditing}
            />

            {/* ── Right sidebar ─────────────────────────────────────────── */}
            {showRightSidebar && (
              <div className="relative flex h-full flex-shrink-0 flex-col">
                {showLayersPanel && (
                  <LayersPanel
                    docked
                    layers={layers}
                    currentLayerId={currentLayerId}
                    onClose={() => setShowLayersPanel(false)}
                    onNavigate={navigateTo}
                    onUpdateLayer={handleUpdateLayer}
                  />
                )}
                {selectedNode && (
                  <div className={showLayersPanel ? 'absolute inset-0 z-10' : 'relative'}>
                    <PropertiesPanel
                      node={selectedNode}
                      onClose={() => setSelectedNode(null)}
                      onUpdate={handleNodeUpdate}
                      onDelete={handleNodeDelete}
                    />
                  </div>
                )}
                {selectedEdge && !selectedNode && (
                  <div className={showLayersPanel ? 'absolute inset-0 z-10' : 'relative'}>
                    <EdgePropertiesPanel
                      edge={selectedEdge}
                      onClose={() => setSelectedEdge(null)}
                      onUpdate={handleEdgeUpdate}
                      onDelete={handleEdgeDelete}
                    />
                  </div>
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

        {/* ── File-load prompt (shown when URL layer not found locally) ──────── */}
        {showFileLoadPrompt && (
          <FileLoadPrompt
            targetLayerId={showFileLoadPrompt}
            onOpenFile={() => handleOpenFileForURL(showFileLoadPrompt)}
            onDismiss={() => setShowFileLoadPrompt(null)}
            isLoading={fileLoadPending}
          />
        )}

        {/* ── AI chat panel ───────────────────────────────────────────────── */}
        {showChatPanel && (
          <AIChatPanel
            onGenerate={handleGenerate}
            onGenerateNewLayer={handleGenerateNewLayer}
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
