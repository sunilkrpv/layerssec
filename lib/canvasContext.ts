import { createContext, useContext } from 'react';
import type { NodeData } from './types';

interface CanvasContextValue {
  navigateTo: (layerId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  editingNodeId: string | null;
  /** The character key that triggered editing (to replace label); null = keep existing label */
  editInitialChar: string | null;
  startEditing: (nodeId: string, initialChar?: string) => void;
  stopEditing: () => void;
  /** Push the current diagram state onto the undo stack (call before a rotation drag begins) */
  pushHistoryNow: () => void;
}

export const CanvasContext = createContext<CanvasContextValue>({
  navigateTo: () => {},
  updateNodeData: () => {},
  editingNodeId: null,
  editInitialChar: null,
  startEditing: () => {},
  stopEditing: () => {},
  pushHistoryNow: () => {},
});

export function useCanvasContext(): CanvasContextValue {
  return useContext(CanvasContext);
}
