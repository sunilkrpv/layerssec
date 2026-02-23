'use client';

import { useCallback, useRef } from 'react';
import { useNodeId, useReactFlow, useStore } from 'reactflow';
import type { Node } from 'reactflow';
import type { NodeData } from '@/lib/types';
import { useCanvasContext } from '@/lib/canvasContext';

const LINE_NODE_TYPES = new Set(['line', 'arrowline', 'dottedline']);
const SNAP_RADIUS = 50;

interface LineEndpointHandleProps {
  visible: boolean;
  /** 'left' = line's left end; 'right' = line's right end */
  side: 'left' | 'right';
}

export default function LineEndpointHandle({ visible, side }: LineEndpointHandleProps) {
  const nodeId = useNodeId();
  const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();
  const { pushHistoryNow } = useCanvasContext();
  const nodeInternals = useStore((s) => s.nodeInternals);
  const historyPushedRef = useRef(false);
  // Track hovered snap target for visual feedback
  const snapTargetRef = useRef<string | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      historyPushedRef.current = false;
      snapTargetRef.current = null;

      const onMouseMove = (ev: MouseEvent) => {
        if (!nodeId) return;

        if (!historyPushedRef.current) {
          pushHistoryNow();
          historyPushedRef.current = true;
        }

        const flowPos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const nodeInfo = nodeInternals.get(nodeId);
        if (!nodeInfo) return;

        const nodeH = nodeInfo.height ?? 20;
        const allNodes = getNodes() as Node<NodeData>[];

        // Find best snap target among non-line nodes
        let bestDist = SNAP_RADIUS;
        let snapX = flowPos.x;
        let snapY: number | null = null;
        let attachId: string | undefined;

        for (const n of allNodes.filter(
          (n) => n.id !== nodeId && !LINE_NODE_TYPES.has(n.type ?? ''),
        )) {
          const nW = n.width ?? 150;
          const nH = n.height ?? 80;
          const nCenterY = n.position.y + nH / 2;
          // Left endpoint attaches to node's RIGHT edge; right endpoint to LEFT edge
          const attachX = side === 'left' ? n.position.x + nW : n.position.x;
          const dist = Math.hypot(flowPos.x - attachX, flowPos.y - nCenterY);
          if (dist < bestDist) {
            bestDist = dist;
            snapX = attachX;
            snapY = nCenterY - nodeH / 2;
            attachId = n.id;
          }
        }

        snapTargetRef.current = attachId ?? null;

        setNodes((nds) =>
          (nds as Node<NodeData>[]).map((n) => {
            if (n.id !== nodeId) return n;
            const nW = n.width ?? 150;
            const finalY = snapY ?? n.position.y;

            if (side === 'left') {
              // Moving left end: keep right end fixed, update position.x + width
              const rightEnd = n.position.x + nW;
              const newX = snapX;
              const newWidth = Math.max(20, rightEnd - newX);
              return {
                ...n,
                position: { x: newX, y: finalY },
                style: { ...n.style, width: newWidth },
                data: { ...n.data, attachedSource: attachId },
              };
            } else {
              // Moving right end: keep left end fixed, update width
              const newWidth = Math.max(20, snapX - n.position.x);
              return {
                ...n,
                position: { ...n.position, y: finalY },
                style: { ...n.style, width: newWidth },
                data: { ...n.data, attachedTarget: attachId },
              };
            }
          }),
        );
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [nodeId, getNodes, setNodes, screenToFlowPosition, nodeInternals, side, pushHistoryNow],
  );

  if (!visible) return null;

  return (
    <div
      className="nodrag absolute top-1/2 z-20 -translate-y-1/2 cursor-crosshair"
      style={{ [side === 'left' ? 'left' : 'right']: -6 }}
      onMouseDown={onMouseDown}
      title={`Drag to connect ${side} endpoint to a node`}
    >
      <div className="h-3 w-3 rounded-full border-2 border-white bg-blue-400 shadow-sm transition-transform hover:scale-125 hover:bg-blue-500" />
    </div>
  );
}
