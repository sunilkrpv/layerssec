'use client';

import { useState, useRef, type DragEvent } from 'react';
import {
  PanelLeftClose, PanelLeftOpen,
  Cloud, Square, NotebookPenIcon, ShieldAlert, ShieldCheck, LayoutDashboard,
} from 'lucide-react';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';
import type { NodeType } from '@/lib/types';
import { SearchGridPalette } from '@/components/ui/SearchGridPalette';
import type { PaletteItem as UIPaletteItem, PaletteCategory } from '@/components/ui/SearchGridPalette';

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

const UI_CATEGORIES: PaletteCategory[] = [
  { id: 'cloud',  label: 'Cloud'  },
  { id: 'shape',  label: 'Shape'  },
  { id: 'threat', label: 'Threat' },
];

function toUICategory(type: NodeType, group: 'cloud' | 'shape' | 'c4'): 'cloud' | 'shape' | 'threat' {
  if (type === 'trustboundary') return 'threat';
  if (group === 'cloud') return 'cloud';
  return 'shape';
}

const NODE_ITEMS: UIPaletteItem[] = PALETTE_ITEMS.map((p) => ({
  id: p.type,
  name: p.label,
  category: toUICategory(p.type, p.group),
  icon: <p.icon size={18} className={p.color} />,
}));

const THREAT_VIEW_ID = '__threat_view__';
const THREAT_DASHBOARD_ID = '__threat_dashboard__';

export default function NodePalette({ onDragStart, onAddNode, onOpenThreatModel, onOpenThreatDashboard }: NodePaletteProps) {
  const [panelOpen, setPanelOpen]     = useState(true);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [popoverTop, setPopoverTop]   = useState(0);
  const sectionBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Components</h2>
          <p className="text-[10px] text-slate-400">Click or drag to add</p>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          title="Collapse panel"
          aria-label="Collapse components panel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <SearchGridPalette
          categories={UI_CATEGORIES}
          items={[
            ...NODE_ITEMS,
            ...(onOpenThreatModel ? [{
              id: THREAT_VIEW_ID,
              name: 'Threat Model View',
              category: 'threat',
              icon: <ShieldCheck size={18} className="text-red-500" />,
            }] : []),
            ...(onOpenThreatDashboard ? [{
              id: THREAT_DASHBOARD_ID,
              name: 'Threat Dashboard',
              category: 'threat',
              icon: <LayoutDashboard size={18} className="text-red-500" />,
            }] : []),
          ]}
          onSelect={(id) => {
            if (id === THREAT_VIEW_ID) return onOpenThreatModel?.();
            if (id === THREAT_DASHBOARD_ID) return onOpenThreatDashboard?.();
            onAddNode(id as NodeType);
          }}
          renderItem={(item, defaultProps) => {
            const isAction = item.id.startsWith('__');
            return (
              <div
                draggable={!isAction}
                onClick={defaultProps.onClick}
                onDragStart={isAction ? undefined : (e) => onDragStart(e as unknown as DragEvent<HTMLDivElement>, item.id as NodeType)}
                role="button"
                tabIndex={defaultProps.tabIndex}
                aria-label={defaultProps['aria-label']}
                data-palette-item
                title={item.name}
                className={`${defaultProps.className} cursor-pointer select-none`}
              >
                {item.icon}
                <span className="w-full truncate px-1 text-center">{item.name}</span>
              </div>
            );
          }}
        />
      </div>
    </aside>
  );
}
