'use client';

import { useRef, useState } from 'react';
import { Share2, Upload, FileJson, ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import type { ProjectFile } from '@/lib/fileStore';
import type { LayerMap } from '@/lib/layerStore';
import { diffProjects, type ProjectDiff, type NodeDiff, type EdgeDiff } from '@/lib/diffEngine';
import DiffCanvas from './DiffCanvas';
import DiffLayersPanel from './DiffLayersPanel';

// ─── File loading helpers ─────────────────────────────────────────────────────

function parseProjectFile(text: string): LayerMap {
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === 'object' && 'layers' in parsed && !Array.isArray(parsed.layers)) {
    return (parsed as ProjectFile).layers;
  }
  return parsed as LayerMap;
}

// ─── File drop zone ───────────────────────────────────────────────────────────

interface DropZoneProps {
  side: 'left' | 'right';
  filename: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

function DropZone({ side, filename, onFile, onClear }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const label = side === 'left' ? 'Base project' : 'Modified project';
  const badge = side === 'left' ? 'BASE' : 'MODIFIED';
  const badgeCls =
    side === 'left' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700';

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-colors ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <span className={`rounded px-2 py-0.5 text-xs font-bold ${badgeCls}`}>{badge}</span>

      {filename ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2">
            <FileJson size={16} className="text-slate-500" />
            <span className="max-w-[200px] truncate text-sm font-medium text-slate-700">{filename}</span>
            <button
              onClick={onClear}
              className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-blue-600 hover:underline"
          >
            Change file
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Upload size={22} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">{label}</p>
            <p className="mt-1 text-xs text-slate-400">Drop a .json project file or click to browse</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Browse…
          </button>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { onFile(f); e.target.value = ''; }
        }}
      />
    </div>
  );
}

// ─── DiffPage ─────────────────────────────────────────────────────────────────

export default function DiffPage() {
  const [leftLayers, setLeftLayers] = useState<LayerMap | null>(null);
  const [rightLayers, setRightLayers] = useState<LayerMap | null>(null);
  const [leftFilename, setLeftFilename] = useState<string | null>(null);
  const [rightFilename, setRightFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string>('root');

  const diff: ProjectDiff | null =
    leftLayers && rightLayers ? diffProjects(leftLayers, rightLayers) : null;

  // Make sure activeLayerId is valid when diff changes
  const validActiveId =
    diff && diff.layers.some((l) => l.layerId === activeLayerId)
      ? activeLayerId
      : diff?.layers[0]?.layerId ?? 'root';

  const activeLayerDiff = diff?.layers.find((l) => l.layerId === validActiveId) ?? null;

  const nodeDiffs: NodeDiff[] = activeLayerDiff?.nodeDiffs ?? [];
  const edgeDiffs: EdgeDiff[] = activeLayerDiff?.edgeDiffs ?? [];

  function loadFile(file: File, side: 'left' | 'right') {
    setError(null);
    file.text().then((text) => {
      try {
        const layers = parseProjectFile(text);
        if (side === 'left') {
          setLeftLayers(layers);
          setLeftFilename(file.name);
        } else {
          setRightLayers(layers);
          setRightFilename(file.name);
        }
        // Reset to root when a new file is loaded
        setActiveLayerId('root');
      } catch {
        setError(`Failed to parse ${file.name}. Make sure it is a valid Drafter project JSON.`);
      }
    });
  }

  const bothLoaded = leftLayers !== null && rightLayers !== null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <div className="flex h-9 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Link
          href="/projects/local"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={13} />
          Back to editor
        </Link>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <Share2 size={13} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800">Drafter</span>
          <span className="text-sm text-slate-400">/ Diff</span>
        </div>

        {diff && (
          <div className="ml-auto flex items-center gap-3 text-[11px]">
            {diff.counts.added > 0 && (
              <span className="text-green-600">+{diff.counts.added} layer{diff.counts.added !== 1 ? 's' : ''} added</span>
            )}
            {diff.counts.removed > 0 && (
              <span className="text-red-600">−{diff.counts.removed} layer{diff.counts.removed !== 1 ? 's' : ''} removed</span>
            )}
            {diff.counts.modified > 0 && (
              <span className="text-amber-600">~{diff.counts.modified} changed</span>
            )}
            {diff.counts.total === 0 && (
              <span className="text-slate-400">No differences found</span>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Load screen */}
      {!bothLoaded && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800">Compare two project files</h1>
            <p className="mt-1 text-sm text-slate-500">
              Load a base and a modified project JSON to see what changed
            </p>
          </div>
          <div className="flex w-full max-w-2xl gap-4">
            <DropZone
              side="left"
              filename={leftFilename}
              onFile={(f) => loadFile(f, 'left')}
              onClear={() => { setLeftLayers(null); setLeftFilename(null); }}
            />
            <DropZone
              side="right"
              filename={rightFilename}
              onFile={(f) => loadFile(f, 'right')}
              onClear={() => { setRightLayers(null); setRightFilename(null); }}
            />
          </div>
          {(leftLayers || rightLayers) && (
            <p className="text-xs text-slate-400">
              {leftLayers ? '✓ Base loaded' : 'Load base file'} ·{' '}
              {rightLayers ? '✓ Modified loaded' : 'Load modified file'}
            </p>
          )}
        </div>
      )}

      {/* Diff view */}
      {bothLoaded && diff && (
        <div className="flex flex-1 overflow-hidden">
          {/* Layers panel */}
          <DiffLayersPanel
            diff={diff}
            activeLayerId={validActiveId}
            onSelectLayer={(id) => setActiveLayerId(id)}
          />

          {/* Split canvases */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 overflow-hidden border-r border-slate-200">
              <DiffCanvas
                nodeDiffs={nodeDiffs}
                edgeDiffs={edgeDiffs}
                side="left"
                title={activeLayerDiff?.leftName ?? 'Base'}
                filename={leftFilename ?? ''}
              />
            </div>
            <div className="flex flex-1 overflow-hidden">
              <DiffCanvas
                nodeDiffs={nodeDiffs}
                edgeDiffs={edgeDiffs}
                side="right"
                title={activeLayerDiff?.rightName ?? 'Modified'}
                filename={rightFilename ?? ''}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
