'use client';

import { useState, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Cloud, Square, NotebookPenIcon } from 'lucide-react';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';
import type { NodeType } from '@/lib/types';

interface NodePaletteProps {
  onDragStart: (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => void;
  onAddNode: (nodeType: NodeType) => void;
}

const cloudItems = PALETTE_ITEMS.filter((i) => i.group === 'cloud');
const shapeItems = PALETTE_ITEMS.filter((i) => i.group === 'shape');
const c4Items = PALETTE_ITEMS.filter((i) => i.group === 'c4');

const SECTIONS = [
  { key: 'cloud', label: 'Cloud Services', icon: Cloud, items: cloudItems },
  { key: 'shape', label: 'Shapes', icon: Square, items: shapeItems },
  { key: 'c4', label: 'C4 Model - Software Architecture', icon: NotebookPenIcon, items: c4Items },
];

export default function NodePalette({ onDragStart, onAddNode }: NodePaletteProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!panelOpen) {
    return (
      <aside className="flex h-full w-10 flex-col items-center border-r border-slate-200 bg-white pt-2 shadow-sm">
        <button
          onClick={() => { setPanelOpen(true); setOpenSection(null); }}
          title="Expand panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <PanelLeftOpen size={16} />
        </button>

        <div className="mt-2 flex flex-col items-center gap-1">
          {SECTIONS.map(({ key, label, icon: SectionIcon, items }) => (
            <div key={key} className="relative">
              <button
                title={label}
                onClick={() => setOpenSection((p) => (p === key ? null : key))}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  openSection === key
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <SectionIcon size={16} />
              </button>

              {openSection === key && (
                <div className="absolute left-10 top-0 z-50 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl">
                  <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onClick={() => { onAddNode(item.type); setOpenSection(null); }}
                        onDragStart={(e) => { onDragStart(e, item.type); setOpenSection(null); }}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50"
                        title={item.description}
                      >
                        <Icon size={14} className={item.color} />
                        <span className={`text-xs font-medium ${item.color}`}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Components</h2>
          <p className="text-xs text-slate-400">Click or drag to add</p>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          title="Collapse panel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {SECTIONS.map(({ key, label, items }) => {
          const isCollapsed = collapsed.has(key);
          return (
            <div key={key}>
              {/* Section header toggle */}
              <button
                onClick={() => toggle(key)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="text-slate-400">
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </span>
                <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                  {items.length}
                </span>
              </button>

              {/* Items */}
              {!isCollapsed && (
                <div className="mb-2 space-y-1 px-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onClick={() => onAddNode(item.type)}
                        onDragStart={(e) => onDragStart(e, item.type)}
                        className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 transition-all hover:shadow-sm active:scale-95 ${item.bgColor} ${item.borderColor}`}
                        title={`${item.description} - click to add, drag to place`}
                      >
                        <div className={`flex-shrink-0 ${item.color}`}>
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium leading-tight ${item.color}`}>
                            {item.label}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
