'use client';

import { type NodeProps, NodeResizer, Handle, Position } from 'reactflow';
import type { NodeData } from '@/lib/types';
import EditableLabel from './EditableLabel';
import RotateHandle from './RotateHandle';
import ChildLayerBadge from './ChildLayerBadge';

const FONT_FAMILIES: Record<NonNullable<NodeData['fontFamily']>, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, "Cascadia Code", monospace',
};

export default function TextNode({ id, data, selected }: NodeProps<NodeData>) {
  const textStyle: React.CSSProperties = {
    color: data.textColor ?? '#1e293b',
    fontWeight: data.fontWeight ?? 'normal',
    fontStyle: data.fontStyle ?? 'normal',
    textDecoration: data.textDecoration ?? 'none',
    fontSize: data.fontSize ? `${data.fontSize}px` : '15px',
    fontFamily: data.fontFamily ? FONT_FAMILIES[data.fontFamily] : undefined,
    transform: `rotate(${data.rotation ?? 0}deg)`,
    transformOrigin: 'center',
    overflow: 'visible',
  };

  return (
    <div
      className="relative h-full w-full min-h-[24px] min-w-[60px]"
      style={{
        backgroundColor: data.fillColor ?? 'transparent',
        transform: `rotate(${data.rotation ?? 0}deg)`,
        transformOrigin: 'center',
        overflow: 'visible',
      }}
    >
      <NodeResizer
        minWidth={60}
        minHeight={20}
        isVisible={selected}
        lineClassName="border-slate-300"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-300"
      />
      <RotateHandle visible={!!selected} rotation={data.rotation ?? 0} />

      {/* Connection handles (subtle, only visible on hover/select) */}
      <Handle
        type="target"
        position={Position.Left}
        className="opacity-0 group-hover:opacity-100"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="opacity-0 group-hover:opacity-100"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="opacity-0 group-hover:opacity-100"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="opacity-0 group-hover:opacity-100"
      />

      <div className="flex h-full w-full items-center justify-center px-1 py-0.5">
        <EditableLabel
          nodeId={id}
          label={data.label}
          style={{
            ...textStyle,
            // Reset transform on label itself — parent div handles rotation
            transform: 'none',
          }}
          className="w-full text-center leading-snug whitespace-pre-wrap break-words"
        />
      </div>

      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
