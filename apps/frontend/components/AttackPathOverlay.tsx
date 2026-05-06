'use client';

import { NodeToolbar, Position } from 'reactflow';
import { Sword } from 'lucide-react';

export interface AttackHighlightMap {
  /** node ID → list of step numbers that pass through it */
  [nodeId: string]: number[];
}

interface AttackPathOverlayProps {
  highlightMap: AttackHighlightMap;
}

/**
 * Renders NodeToolbar badges on any canvas node that is part of the currently
 * hovered attack path step. Uses React Flow's NodeToolbar to position the
 * badge relative to the node without needing to touch node components.
 */
export default function AttackPathOverlay({ highlightMap }: AttackPathOverlayProps) {
  return (
    <>
      {Object.entries(highlightMap).map(([nodeId, steps]) => (
        <NodeToolbar
          key={nodeId}
          nodeId={nodeId}
          isVisible
          position={Position.Top}
          offset={4}
        >
          <div className="flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 shadow-md ring-1 ring-red-300">
            <Sword size={9} className="text-white" />
            {steps.map((s) => (
              <span key={s} className="text-[10px] font-bold text-white">
                {s}
              </span>
            ))}
          </div>
        </NodeToolbar>
      ))}
    </>
  );
}
