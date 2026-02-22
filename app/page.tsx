'use client';

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { ReactFlowProvider, type Node, type ReactFlowInstance } from 'reactflow';
import DiagramCanvas, { type ExtendedRFInstance } from '@/components/DiagramCanvas';
import NodePalette from '@/components/NodePalette';
import PromptBar from '@/components/PromptBar';
import PropertiesPanel from '@/components/PropertiesPanel';
import Toolbar from '@/components/Toolbar';
import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';

export default function Home() {
  const rfInstanceRef = useRef<ExtendedRFInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPaletteDragStart = useCallback((event: DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setError(null);
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

      const diagram: GenerateResponse = await res.json();
      rfInstanceRef.current?.loadDiagram(diagram);

      setTimeout(() => {
        (rfInstanceRef.current as ReactFlowInstance | null)?.fitView({ padding: 0.15 });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    rfInstanceRef.current?.clearDiagram();
    setSelectedNode(null);
  }, []);

  const handleExportJson = useCallback(() => {
    const instance = rfInstanceRef.current as ReactFlowInstance | null;
    if (!instance) return;
    const data = instance.toObject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, data: Partial<NodeData>) => {
    rfInstanceRef.current?.updateNodeData(nodeId, data);
    setSelectedNode((prev) =>
      prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
    );
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Toolbar onClear={handleClear} onExportJson={handleExportJson} />

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

        <div className="flex flex-1 overflow-hidden">
          <NodePalette onDragStart={onPaletteDragStart} />
          <DiagramCanvas onNodeSelect={setSelectedNode} rfInstanceRef={rfInstanceRef} />
          {selectedNode && (
            <PropertiesPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleNodeUpdate}
            />
          )}
        </div>

        <PromptBar onGenerate={handleGenerate} isLoading={isGenerating} />
      </div>
    </ReactFlowProvider>
  );
}
