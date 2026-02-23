'use client';

import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { ReactFlowProvider, type Node, type Edge, type ReactFlowInstance } from 'reactflow';
import { toPng } from 'html-to-image';

import DiagramCanvas, { type ExtendedRFInstance } from '@/components/DiagramCanvas';
import NodePalette from '@/components/NodePalette';
import PromptBar from '@/components/PromptBar';
import PropertiesPanel from '@/components/PropertiesPanel';
import Toolbar from '@/components/Toolbar';
import LayerBar from '@/components/LayerBar';
import LayersPanel from '@/components/LayersPanel';
import NodeContextMenu from '@/components/NodeContextMenu';
import DrillDownModal from '@/components/DrillDownModal';

import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';
import {
  loadAllLayers,
  saveAllLayers,
  createChildLayer,
  findChildLayer,
  updateLayer,
  ROOT_LAYER_ID,
  type LayerMap,
} from '@/lib/layerStore';
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

export default function Home() {
  const rfInstanceRef = useRef<ExtendedRFInstance | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // ── Layer state (lazy-init from localStorage) ─────────────────────────────
  const [layers, setLayers] = useState<LayerMap>(() => loadAllLayers());
  // Navigation stack: array of layer IDs, last = current
  const [navStack, setNavStack] = useState<string[]>([ROOT_LAYER_ID]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: Node<NodeData>;
  } | null>(null);

  // Drill-down naming modal
  const [drillTarget, setDrillTarget] = useState<Node<NodeData> | null>(null);

  // ── Derived values ────────────────────────────────────────────────────────
  const currentLayerId = navStack[navStack.length - 1];
  const currentLayer = layers[currentLayerId];

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
        saveAllLayers(updated);
        return updated;
      });
    },
    [currentLayerId],
  );

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
      setContextMenu({ x: event.clientX, y: event.clientY, node });
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

        // Mark the drilled-into node with _childLayerId
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
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  }, []);

  // ── Canvas operations ─────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    rfInstanceRef.current?.clearDiagram();
    setSelectedNode(null);
  }, []);

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
    // Flush current canvas first so the exported project is up-to-date
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
        // Accept either { layers, navStack } (full project) or a bare LayerMap
        const importedLayers: LayerMap =
          data.layers && typeof data.layers === 'object' ? data.layers : data;

        if (
          typeof importedLayers === 'object' &&
          importedLayers !== null &&
          Object.keys(importedLayers).length > 0
        ) {
          saveAllLayers(importedLayers);
          setLayers(importedLayers);
          // Always start navigation at root when importing a project
          setNavStack([ROOT_LAYER_ID]);
          setSelectedNode(null);
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

  // ── Node operations (via PropertiesPanel) ─────────────────────────────────

  const handleNodeUpdate = useCallback((nodeId: string, data: Partial<NodeData>) => {
    rfInstanceRef.current?.updateNodeData(nodeId, data);
    setSelectedNode((prev) =>
      prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev,
    );
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    rfInstanceRef.current?.deleteNode(nodeId);
  }, []);

  // ── Inline label editing ───────────────────────────────────────────────────

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

  // ── Click-to-add from palette ──────────────────────────────────────────────

  const handleAddNode = useCallback((nodeType: NodeType) => {
    rfInstanceRef.current?.addNodeAtCenter(nodeType);
  }, []);

  // ── CanvasContext value ────────────────────────────────────────────────────
  const canvasContextValue = useMemo(
    () => ({
      navigateTo,
      updateNodeData: (nodeId: string, data: Partial<NodeData>) =>
        rfInstanceRef.current?.updateNodeData(nodeId, data),
      editingNodeId,
      editInitialChar,
      startEditing,
      stopEditing,
    }),
    [navigateTo, editingNodeId, editInitialChar, startEditing, stopEditing],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CanvasContext.Provider value={canvasContextValue}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <Toolbar
            onClear={handleClear}
            onExportJson={handleExportJson}
            onExportPng={handleExportPng}
            onImportJson={handleImportJson}
            onExportProject={handleExportProject}
            onImportProject={handleImportProject}
            onShowLayers={() => setShowLayersPanel(true)}
          />

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
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                Dismiss
              </button>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            <NodePalette onDragStart={onPaletteDragStart} onAddNode={handleAddNode} />

            {/* key={currentLayerId} forces a remount when switching layers */}
            <DiagramCanvas
              key={currentLayerId}
              initialNodes={(currentLayer?.nodes ?? []) as Node<NodeData>[]}
              initialEdges={currentLayer?.edges ?? []}
              onLayerSave={handleLayerSave}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeSelect={setSelectedNode}
              rfInstanceRef={rfInstanceRef}
              canvasRef={canvasRef}
              onRequestEdit={startEditing}
            />

            {selectedNode && (
              <PropertiesPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdate={handleNodeUpdate}
                onDelete={handleNodeDelete}
              />
            )}
          </div>

          <PromptBar
            onGenerate={handleGenerate}
            isLoading={isGenerating}
            status={generatingStatus}
          />
        </div>

        {/* Context menu — rendered outside canvas div so z-index works cleanly */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeLabel={contextMenu.node.data.label}
            hasChildLayer={!!findChildLayer(layers, currentLayerId, contextMenu.node.id)}
            isLine={LINE_NODE_TYPES.has(contextMenu.node.type as string)}
            onDrillDown={handleDrillDown}
            onDelete={handleContextMenuDelete}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Drill-down naming modal */}
        {drillTarget && (
          <DrillDownModal
            defaultName={`${drillTarget.data.label} Layer`}
            onConfirm={handleDrillDownConfirm}
            onCancel={() => setDrillTarget(null)}
          />
        )}

        {/* Layers manager modal */}
        {showLayersPanel && (
          <LayersPanel
            layers={layers}
            currentLayerId={currentLayerId}
            onClose={() => setShowLayersPanel(false)}
            onNavigate={navigateTo}
            onUpdateLayer={handleUpdateLayer}
          />
        )}
      </ReactFlowProvider>
    </CanvasContext.Provider>
  );
}
