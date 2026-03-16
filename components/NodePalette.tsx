'use client';

import { useState, useRef, type DragEvent } from 'react';
import {
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Cloud, Square, NotebookPenIcon, Layers, ShieldAlert, ShieldCheck, LayoutDashboard,
} from 'lucide-react';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';
import type { NodeType } from '@/lib/types';

interface NodePaletteProps {
  onDragStart: (event: DragEvent<HTMLDivElement>, nodeType: NodeType) => void;
  onAddNode: (nodeType: NodeType) => void;
  onOpenThreatModel?: () => void;
  onOpenThreatDashboard?: () => void;
}

const cloudItems = PALETTE_ITEMS.filter((i) => i.group === 'cloud');
const shapeItems = PALETTE_ITEMS.filter((i) => i.group === 'shape');
const c4Items    = PALETTE_ITEMS.filter((i) => i.group === 'c4');

const DIAGRAM_SECTIONS = [
  { key: 'cloud', label: 'Cloud Services',                   icon: Cloud,           items: cloudItems },
  { key: 'shape', label: 'Shapes',                           icon: Square,          items: shapeItems },
  { key: 'c4',    label: 'C4 Model - Software Architecture',  icon: NotebookPenIcon, items: c4Items    },
];

export default function NodePalette({ onDragStart, onAddNode, onOpenThreatModel, onOpenThreatDashboard }: NodePaletteProps) {
  const [panelOpen, setPanelOpen]     = useState(true);
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());
  const [groupOpen, setGroupOpen]     = useState<Set<string>>(new Set(['diagramming']));
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [popoverTop, setPopoverTop]   = useState(0);
  const sectionBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleGroup = (key: string) =>
    setGroupOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // ── Collapsed icon-rail mode ──────────────────────────────────────────────
  if (!panelOpen) {
    return (
      <aside className="flex h-full w-10 flex-col items-center border-r border-slate-200 bg-white pt-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <button
          onClick={() => { setPanelOpen(true); setOpenSection(null); }}
          title="Expand panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <PanelLeftOpen size={16} />
        </button>

        <div className="mt-2 flex flex-col items-center gap-1">
          {DIAGRAM_SECTIONS.map(({ key, label, icon: SectionIcon }) => (
            <button
              key={key}
              ref={(el) => { sectionBtnRefs.current[key] = el; }}
              title={label}
              onClick={() => {
                const btn = sectionBtnRefs.current[key];
                if (btn) setPopoverTop(btn.getBoundingClientRect().top);
                setOpenSection((p) => (p === key ? null : key));
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                openSection === key
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <SectionIcon size={16} />
            </button>
          ))}

          {(onOpenThreatModel || onOpenThreatDashboard) && (
            <>
              <div className="my-1 w-5 border-t border-slate-200 dark:border-slate-700" />
              <button
                ref={(el) => { sectionBtnRefs.current['threat'] = el; }}
                title="Threat Model"
                onClick={() => {
                  const btn = sectionBtnRefs.current['threat'];
                  if (btn) setPopoverTop(btn.getBoundingClientRect().top);
                  setOpenSection((p) => (p === 'threat' ? null : 'threat'));
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  openSection === 'threat'
                    ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <ShieldAlert size={16} />
              </button>
            </>
          )}
        </div>

        {/* Diagram section popovers */}
        {openSection && openSection !== 'threat' && (() => {
          const section = DIAGRAM_SECTIONS.find((s) => s.key === openSection);
          if (!section) return null;
          return (
            <div
              className="fixed z-[9999] w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
              style={{ left: 40, top: popoverTop }}
            >
              <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    draggable
                    onClick={() => { onAddNode(item.type); setOpenSection(null); }}
                    onDragStart={(e) => { onDragStart(e, item.type); setOpenSection(null); }}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
                    title={item.description}
                  >
                    <Icon size={14} className={item.color} />
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Threat Model popover */}
        {openSection === 'threat' && (
          <div
            className="fixed z-[9999] w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
            style={{ left: 40, top: popoverTop }}
          >
            <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700">
              Threat Model
            </div>
            {onOpenThreatModel && (
              <button
                onClick={() => { onOpenThreatModel(); setOpenSection(null); }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ShieldCheck size={14} className="text-red-500" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">View</span>
              </button>
            )}
            {onOpenThreatDashboard && (
              <button
                onClick={() => { onOpenThreatDashboard(); setOpenSection(null); }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <LayoutDashboard size={14} className="text-red-500" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Dashboard</span>
              </button>
            )}
          </div>
        )}
      </aside>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Components</h2>
          <p className="text-xs text-slate-400">Click or drag to add</p>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          title="Collapse panel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">

        {/* ── Diagramming group ──────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => toggleGroup('diagramming')}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <Layers size={13} className="flex-shrink-0 text-blue-500" />
            <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Diagramming
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              {groupOpen.has('diagramming') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </button>

          {groupOpen.has('diagramming') && (
            <div className="pb-1 pl-2">
              {DIAGRAM_SECTIONS.map(({ key, label, items }) => {
                const isCollapsed = collapsed.has(key);
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleSection(key)}
                      className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <span className="text-slate-400 dark:text-slate-500">
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </span>
                      <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                        {items.length}
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="mb-1 space-y-1 px-1">
                        {items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.type}
                              draggable
                              onClick={() => onAddNode(item.type)}
                              onDragStart={(e) => onDragStart(e, item.type)}
                              className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 transition-all hover:shadow-sm active:scale-95 ${item.bgColor} ${item.borderColor} dark:bg-slate-700/50 dark:border-slate-600`}
                              title={`${item.description} - click to add, drag to place`}
                            >
                              <div className={`flex-shrink-0 ${item.color}`}>
                                <Icon size={15} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-medium leading-tight ${item.color} dark:text-slate-200`}>
                                  {item.label}
                                </p>
                                <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{item.description}</p>
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
          )}
        </div>

        {/* ── Threat Model group ─────────────────────────────────────────── */}
        {(onOpenThreatModel || onOpenThreatDashboard) && (
          <>
            <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700" />
            <div>
              <button
                onClick={() => toggleGroup('threat')}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <ShieldAlert size={13} className="flex-shrink-0 text-red-500" />
                <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Threat Model
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  {groupOpen.has('threat') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </button>

              {groupOpen.has('threat') && (
                <div className="mb-2 space-y-1 px-3 pl-5">
                  {onOpenThreatModel && (
                    <button
                      onClick={onOpenThreatModel}
                      className="flex w-full items-center gap-2.5 rounded-lg border-2 border-red-100 bg-red-50/60 px-2.5 py-2 text-left transition-all hover:shadow-sm active:scale-95 dark:border-red-900/30 dark:bg-red-900/10"
                    >
                      <ShieldCheck size={14} className="flex-shrink-0 text-red-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-tight text-red-700 dark:text-red-400">View</p>
                        <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">Threat overlay panel</p>
                      </div>
                    </button>
                  )}
                  {onOpenThreatDashboard && (
                    <button
                      onClick={onOpenThreatDashboard}
                      className="flex w-full items-center gap-2.5 rounded-lg border-2 border-red-100 bg-red-50/60 px-2.5 py-2 text-left transition-all hover:shadow-sm active:scale-95 dark:border-red-900/30 dark:bg-red-900/10"
                    >
                      <LayoutDashboard size={14} className="flex-shrink-0 text-red-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-tight text-red-700 dark:text-red-400">Dashboard</p>
                        <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">Full threat management</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
