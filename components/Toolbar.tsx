'use client';

import { useRef } from 'react';
import { useReactFlow } from 'reactflow';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Download,
  Upload,
  Image,
  Share2,
  FolderDown,
  FolderUp,
  Layers,
} from 'lucide-react';

interface ToolbarProps {
  onClear: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onImportJson: (file: File) => void;
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onShowLayers: () => void;
}

function ToolBtn({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        danger
          ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function Toolbar({
  onClear,
  onExportJson,
  onExportPng,
  onImportJson,
  onExportProject,
  onImportProject,
  onShowLayers,
}: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportProject(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Share2 size={18} className="text-blue-600" />
        <span className="text-sm font-bold text-slate-800">Drafter</span>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
        <ToolBtn onClick={() => zoomIn()} title="Zoom In">
          <ZoomIn size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => zoomOut()} title="Zoom Out">
          <ZoomOut size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => fitView({ padding: 0.15 })} title="Fit View">
          <Maximize2 size={16} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Layers manager */}
        <ToolBtn onClick={onShowLayers} title="Manage layers">
          <Layers size={16} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Current layer import/export */}
        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Import layer JSON">
          <Upload size={16} />
        </ToolBtn>
        <ToolBtn onClick={onExportJson} title="Export layer as JSON">
          <Download size={16} />
        </ToolBtn>
        <ToolBtn onClick={onExportPng} title="Export as PNG">
          <Image size={16} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Full project import/export (all layers) */}
        <ToolBtn onClick={() => projectInputRef.current?.click()} title="Import project (all layers)">
          <FolderUp size={16} />
        </ToolBtn>
        <ToolBtn onClick={onExportProject} title="Export project (all layers)">
          <FolderDown size={16} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolBtn onClick={onClear} title="Clear canvas" danger>
          <Trash2 size={16} />
        </ToolBtn>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleProjectFileChange}
      />
    </div>
  );
}
