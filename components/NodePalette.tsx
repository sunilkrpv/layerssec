'use client';

import type { DragEvent } from 'react';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';
import type { NodeType } from '@/lib/types';

interface NodePaletteProps {
  onDragStart: (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => void;
}

export default function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Components</h2>
        <p className="mt-0.5 text-xs text-slate-400">Drag onto canvas</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className={`flex cursor-grab select-none items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition-all hover:shadow-sm active:cursor-grabbing ${item.bgColor} ${item.borderColor}`}
            >
              <div className={`flex-shrink-0 ${item.color}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${item.color}`}>{item.label}</p>
                <p className="truncate text-xs text-slate-400">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
