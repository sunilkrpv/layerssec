'use client';

import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';

interface ToolbarProps {
  onClear: () => void;
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

export default function Toolbar({ onClear }: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flex h-10 flex-shrink-0 items-center border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5">
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
        <ToolBtn onClick={onClear} title="Clear canvas" danger>
          <Trash2 size={16} />
        </ToolBtn>
      </div>
    </div>
  );
}
