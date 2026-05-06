'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useNodeId, useReactFlow, useStore } from 'reactflow';
import { RotateCw } from 'lucide-react';
import { useCanvasContext } from '@/lib/canvasContext';

interface RotateHandleProps {
  visible: boolean;
  rotation: number;
}

export default function RotateHandle({ visible, rotation }: RotateHandleProps) {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const { pushHistoryNow } = useCanvasContext();
  const draggingRef = useRef(false);
  const historyPushedRef = useRef(false);

  // Get the node's DOM element position for center calculation
  const nodeInternals = useStore((s) => s.nodeInternals);
  const zoom = useStore((s) => s.transform[2]);
  const vpX = useStore((s) => s.transform[0]);
  const vpY = useStore((s) => s.transform[1]);

  const getNodeCenter = useCallback(() => {
    if (!nodeId) return null;
    const node = nodeInternals.get(nodeId);
    if (!node) return null;
    const w = node.width ?? 150;
    const h = node.height ?? 80;
    // Convert flow coords to screen coords
    const screenX = node.position.x * zoom + vpX + (w * zoom) / 2;
    const screenY = node.position.y * zoom + vpY + (h * zoom) / 2;
    return { x: screenX, y: screenY };
  }, [nodeId, nodeInternals, zoom, vpX, vpY]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      draggingRef.current = true;
      historyPushedRef.current = false;

      const onMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const center = getNodeCenter();
        if (!center) return;

        // Push history only once at the start of the drag
        if (!historyPushedRef.current) {
          pushHistoryNow();
          historyPushedRef.current = true;
        }

        const dx = ev.clientX - center.x;
        const dy = ev.clientY - center.y;
        // atan2 gives angle from positive-x axis; subtract 90deg so "up" = 0deg
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = (angleRad * 180) / Math.PI + 90;
        const snapped = Math.round(angleDeg / 5) * 5; // snap to 5° increments

        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, rotation: snapped } } : n,
          ),
        );
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [getNodeCenter, nodeId, pushHistoryNow, setNodes],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      draggingRef.current = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="nodrag absolute"
      style={{
        top: -28,
        left: '50%',
        transform: 'translateX(-50%)',
        cursor: 'grab',
        zIndex: 10,
      }}
      onMouseDown={onMouseDown}
      title={`Rotate (${rotation}°) — drag to rotate`}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600">
        <RotateCw size={12} className="text-slate-500" />
      </div>
    </div>
  );
}
