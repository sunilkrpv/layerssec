'use client';

import type { Node } from 'reactflow';
import { X, Info } from 'lucide-react';
import type { NodeData, NodeType } from '@/lib/types';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';

interface PropertiesPanelProps {
  node: Node<NodeData>;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
}

export default function PropertiesPanel({ node, onClose, onUpdate }: PropertiesPanelProps) {
  const palette = PALETTE_ITEMS.find((item) => item.type === (node.type as NodeType));
  const Icon = palette?.icon;

  return (
    <aside className="flex h-full w-64 flex-col border-l border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className={palette?.color ?? 'text-slate-500'} />}
          <h2 className="text-sm font-semibold text-slate-700">Properties</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Type
          </label>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${palette?.bgColor ?? 'bg-slate-100'} ${palette?.color ?? 'text-slate-700'}`}
          >
            {node.type}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Label
          </label>
          <input
            type="text"
            value={node.data.label ?? ''}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Technology
          </label>
          <input
            type="text"
            value={node.data.technology ?? ''}
            placeholder="e.g. Node.js, PostgreSQL"
            onChange={(e) => onUpdate(node.id, { technology: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Description
          </label>
          <textarea
            value={node.data.description ?? ''}
            placeholder="What does this component do?"
            rows={3}
            onChange={(e) => onUpdate(node.id, { description: e.target.value })}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Node ID
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
            {node.id}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Position
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
            x: {Math.round(node.position.x)}, y: {Math.round(node.position.y)}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span>Drag handles to connect nodes. Backspace to delete selected node.</span>
        </div>
      </div>
    </aside>
  );
}
