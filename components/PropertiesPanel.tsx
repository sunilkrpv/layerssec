'use client';

import { useState } from 'react';
import type { Node } from 'reactflow';
import { X, Info, Trash2, RotateCw, Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import type { NodeData, NodeType } from '@/lib/types';
import { PALETTE_ITEMS, LINE_NODE_TYPES } from '@/lib/nodeConfig';

const COLOR_SWATCHES = [
  { value: '#000000', label: 'Black' },
  { value: '#ffffff', label: 'White' },
  { value: '#f1f5f9', label: 'Light gray' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#22c55e', label: 'Green' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#a855f7', label: 'Purple' },
];

interface ColorRowProps {
  label: string;
  value: string | undefined;
  onChange: (color: string | undefined) => void;
  showTransparent?: boolean;
}

function ColorRow({ label, value, onChange, showTransparent }: ColorRowProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
        {value && (
          <button
            onClick={() => onChange(undefined)}
            title="Reset to default"
            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕ reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {showTransparent && (
          <button
            title="No fill (transparent)"
            onClick={() => onChange('transparent')}
            className={`relative h-5 w-5 flex-shrink-0 rounded-full border-2 border-dashed bg-white transition-all hover:scale-110 ${
              value === 'transparent'
                ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[9px] leading-none text-slate-400">
              ∅
            </span>
          </button>
        )}
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            title={swatch.label}
            onClick={() => onChange(swatch.value)}
            className={`h-5 w-5 flex-shrink-0 rounded-full border transition-all hover:scale-110 ${
              value === swatch.value
                ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            style={{ backgroundColor: swatch.value }}
          />
        ))}
      </div>
    </div>
  );
}

interface PropertiesPanelProps {
  node: Node<NodeData>;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
  onDelete: (nodeId: string) => void;
}

const FONT_SIZE_PRESETS = [
  { label: 'XS', value: 11 },
  { label: 'S', value: 13 },
  { label: 'M', value: 15 },
  { label: 'L', value: 20 },
  { label: 'XL', value: 28 },
  { label: '2XL', value: 40 },
];

const FONT_FAMILIES = [
  { label: 'Sans', value: 'sans' as const },
  { label: 'Serif', value: 'serif' as const },
  { label: 'Mono', value: 'mono' as const },
];

export default function PropertiesPanel({ node, onClose, onUpdate, onDelete }: PropertiesPanelProps) {
  const palette = PALETTE_ITEMS.find((item) => item.type === (node.type as NodeType));
  const Icon = palette?.icon;
  const isLine = LINE_NODE_TYPES.has(node.type as string);
  const isText = node.type === 'text';
  const isTrustBoundary = node.type === 'trustboundary';
  const [rotateByInput, setRotateByInput] = useState('');

  return (
    <aside className="flex h-full w-64 flex-col border-l border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className={palette?.color ?? 'text-slate-500'} />}
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Properties</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Type
          </label>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${palette?.bgColor ?? 'bg-slate-100'} ${palette?.color ?? 'text-slate-700'}`}
          >
            {node.type}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Label
          </label>
          <input
            type="text"
            value={node.data.label ?? ''}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900/30"
          />
        </div>

        {!isLine && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Technology
            </label>
            <input
              type="text"
              value={node.data.technology ?? ''}
              placeholder="e.g. Node.js, PostgreSQL"
              onChange={(e) => onUpdate(node.id, { technology: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Description
          </label>
          <textarea
            value={node.data.description ?? ''}
            placeholder="What does this component do?"
            rows={3}
            onChange={(e) => onUpdate(node.id, { description: e.target.value })}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
          />
        </div>

        {/* Trust Level (trustboundary nodes only) */}
        {isTrustBoundary && (
          <div className="space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Trust Level</p>
            <select
              value={node.data.trustLevel ?? 'internal'}
              onChange={(e) =>
                onUpdate(node.id, {
                  trustLevel: e.target.value as 'internal' | 'dmz' | 'external' | 'internet' | 'custom',
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="internal">Internal</option>
              <option value="dmz">DMZ</option>
              <option value="external">External</option>
              <option value="internet">Internet</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        )}

        {/* Colors */}
        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Colors</p>
          <ColorRow
            label="Border"
            value={node.data.borderColor}
            onChange={(c) => onUpdate(node.id, { borderColor: c })}
          />
          {!isLine && (
            <>
              <ColorRow
                label="Fill"
                value={node.data.fillColor}
                onChange={(c) => onUpdate(node.id, { fillColor: c })}
                showTransparent
              />
              <ColorRow
                label="Text"
                value={node.data.textColor}
                onChange={(c) => onUpdate(node.id, { textColor: c })}
              />
            </>
          )}
        </div>

        {/* Text Formatting (text nodes only) */}
        {isText && (
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Text Formatting</p>

            {/* Style toggles: B I U S */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Style</p>
              <div className="flex gap-1.5">
                {[
                  { icon: Bold, field: 'fontWeight' as const, onVal: 'bold' as const, title: 'Bold' },
                  { icon: Italic, field: 'fontStyle' as const, onVal: 'italic' as const, title: 'Italic' },
                ].map(({ icon: Icon, field, onVal, title }) => {
                  const active = node.data[field] === onVal;
                  return (
                    <button
                      key={title}
                      title={title}
                      onClick={() => onUpdate(node.id, { [field]: active ? undefined : onVal })}
                      className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-bold transition-colors ${
                        active
                          ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600'
                      }`}
                    >
                      <Icon size={13} />
                    </button>
                  );
                })}
                {[
                  { icon: Underline, deco: 'underline', title: 'Underline' },
                  { icon: Strikethrough, deco: 'line-through', title: 'Strikethrough' },
                ].map(({ icon: Icon, deco, title }) => {
                  const current = node.data.textDecoration ?? '';
                  const active = current.includes(deco);
                  const toggle = () => {
                    const parts = current.split(' ').filter(Boolean);
                    const next = active ? parts.filter((p) => p !== deco) : [...parts, deco];
                    onUpdate(node.id, { textDecoration: next.join(' ') || undefined });
                  };
                  return (
                    <button
                      key={title}
                      title={title}
                      onClick={toggle}
                      className={`flex h-7 w-7 items-center justify-center rounded border text-xs transition-colors ${
                        active
                          ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600'
                      }`}
                    >
                      <Icon size={13} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font size */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Size</p>
              <div className="flex flex-wrap gap-1">
                {FONT_SIZE_PRESETS.map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => onUpdate(node.id, { fontSize: value })}
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                      (node.data.fontSize ?? 15) === value
                        ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font family */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Font</p>
              <div className="flex gap-1.5">
                {FONT_FAMILIES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => onUpdate(node.id, { fontFamily: value })}
                    className={`flex-1 rounded border py-1 text-xs font-medium transition-colors ${
                      (node.data.fontFamily ?? 'sans') === value
                        ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rotation */}
        {!isLine && (
          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rotation</p>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.round(node.data.rotation ?? 0)}°
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={rotateByInput}
                onChange={(e) => setRotateByInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const delta = parseFloat(rotateByInput);
                    if (!isNaN(delta)) {
                      const current = node.data.rotation ?? 0;
                      onUpdate(node.id, { rotation: current + delta });
                      setRotateByInput('');
                    }
                  }
                }}
                placeholder="e.g. 45"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
              />
              <button
                onClick={() => {
                  const delta = parseFloat(rotateByInput);
                  if (!isNaN(delta)) {
                    const current = node.data.rotation ?? 0;
                    onUpdate(node.id, { rotation: current + delta });
                    setRotateByInput('');
                  }
                }}
                title="Apply clockwise rotation"
                className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
              >
                <RotateCw size={12} />
                CW
              </button>
            </div>
            {(node.data.rotation ?? 0) !== 0 && (
              <button
                onClick={() => onUpdate(node.id, { rotation: 0 })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
              >
                Reset rotation
              </button>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Node ID
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            {node.id}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Position
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            x: {Math.round(node.position.x)}, y: {Math.round(node.position.y)}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
        <button
          onClick={() => { onDelete(node.id); onClose(); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <Trash2 size={14} />
          Delete node
        </button>
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span>Drag handles to connect nodes. Backspace to delete selected node.</span>
        </div>
      </div>
    </aside>
  );
}
