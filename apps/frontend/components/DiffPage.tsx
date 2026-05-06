'use client';

import { useState, useEffect } from 'react';
import { Share2, ArrowLeft, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LayerMap } from '@/lib/layerStore';
import { apiGetDiagram } from '@/lib/api';
import { diffProjects, type ProjectDiff, type NodeDiff, type EdgeDiff } from '@/lib/diffEngine';
import DiffCanvas from './DiffCanvas';
import DiffLayersPanel from './DiffLayersPanel';

function extractLayersFromCanvasData(canvasData: unknown): LayerMap {
  if (canvasData && typeof canvasData === 'object' && 'layers' in canvasData) {
    return (canvasData as { layers: LayerMap }).layers;
  }
  return canvasData as LayerMap;
}

// ─── DiffPage ─────────────────────────────────────────────────────────────────

export default function DiffPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leftLayers, setLeftLayers] = useState<LayerMap | null>(null);
  const [rightLayers, setRightLayers] = useState<LayerMap | null>(null);
  const [leftFilename, setLeftFilename] = useState<string | null>(null);
  const [rightFilename, setRightFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string>('root');
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  const v1Id = searchParams.get('v1');
  const v2Id = searchParams.get('v2');
  const vn1 = searchParams.get('vn1');
  const vn2 = searchParams.get('vn2');
  const pc1 = searchParams.get('pc1'); // publish comment for base version
  const pc2 = searchParams.get('pc2'); // publish comment for compare version

  // Require cloud version params; redirect to projects if missing
  useEffect(() => {
    if (!v1Id || !v2Id) {
      router.replace('/projects');
    }
  }, [v1Id, v2Id, router]);

  useEffect(() => {
    if (!v1Id || !v2Id) return;
    setIsCloudLoading(true);
    setError(null);
    Promise.all([apiGetDiagram(v1Id), apiGetDiagram(v2Id)])
      .then(([d1, d2]) => {
        setLeftLayers(extractLayersFromCanvasData(d1.canvasData));
        setRightLayers(extractLayersFromCanvasData(d2.canvasData));
        setLeftFilename(vn1 ? `Version ${vn1}` : 'Base version');
        setRightFilename(vn2 ? `Version ${vn2}` : 'Compare version');
        setActiveLayerId('root');
      })
      .catch(() => setError('Failed to load diagram versions from server.'))
      .finally(() => setIsCloudLoading(false));
    // Only run when URL params change (component mount in practice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v1Id, v2Id]);

  if (!v1Id || !v2Id) return null;

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

  const bothLoaded = leftLayers !== null && rightLayers !== null;

  // Cloud loading overlay
  if (isCloudLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <span className="text-sm font-medium dark:text-slate-400">Loading diagram versions…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <div className="flex h-9 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={13} />
          Back to projects
        </Link>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <Share2 size={13} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
          <span className="text-sm text-slate-400 dark:text-slate-500">/ Diff</span>
        </div>

        {diff && (
          <div className="ml-auto flex items-center gap-3 text-[11px]">
            {diff.counts.added > 0 && (
              <span className="text-green-600 dark:text-green-400">+{diff.counts.added} layer{diff.counts.added !== 1 ? 's' : ''} added</span>
            )}
            {diff.counts.removed > 0 && (
              <span className="text-red-600 dark:text-red-400">−{diff.counts.removed} layer{diff.counts.removed !== 1 ? 's' : ''} removed</span>
            )}
            {diff.counts.modified > 0 && (
              <span className="text-amber-600 dark:text-amber-400">~{diff.counts.modified} changed</span>
            )}
            {diff.counts.total === 0 && (
              <span className="text-slate-400 dark:text-slate-500">No differences found</span>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200">
            <X size={14} />
          </button>
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
            <div className="flex flex-1 overflow-hidden border-r border-slate-200 dark:border-slate-700">
              <DiffCanvas
                nodeDiffs={nodeDiffs}
                edgeDiffs={edgeDiffs}
                side="left"
                title={activeLayerDiff?.leftName ?? 'Base'}
                filename={leftFilename ?? ''}
                versionInfo={vn1 ? { number: vn1, comment: pc1 } : null}
              />
            </div>
            <div className="flex flex-1 overflow-hidden">
              <DiffCanvas
                nodeDiffs={nodeDiffs}
                edgeDiffs={edgeDiffs}
                side="right"
                title={activeLayerDiff?.rightName ?? 'Modified'}
                filename={rightFilename ?? ''}
                versionInfo={vn2 ? { number: vn2, comment: pc2 } : null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
