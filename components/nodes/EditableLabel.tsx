'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvasContext } from '@/lib/canvasContext';

interface EditableLabelProps {
  nodeId: string;
  label: string;
  className?: string;
}

export default function EditableLabel({ nodeId, label, className }: EditableLabelProps) {
  const { editingNodeId, editInitialChar, updateNodeData, startEditing, stopEditing } =
    useCanvasContext();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Activate editing when this node's ID is set as the editing target
  useEffect(() => {
    if (editingNodeId === nodeId) {
      setValue(editInitialChar ?? label);
      setEditing(true);
    } else {
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNodeId, nodeId]);

  // Keep value in sync when label changes externally (e.g. from properties panel)
  useEffect(() => {
    if (!editing) setValue(label);
  }, [label, editing]);

  const commit = () => {
    const trimmed = value.trim() || label;
    updateNodeData(nodeId, { label: trimmed });
    setValue(trimmed);
    stopEditing();
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            setValue(label);
            stopEditing();
            setEditing(false);
          }
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        className="nodrag nowheel w-full rounded border border-blue-300 bg-blue-50 px-1 text-center text-sm font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing(nodeId);
      }}
      title="Double-click to edit label"
      className={`cursor-text select-none ${className ?? ''}`}
    >
      {label}
    </span>
  );
}
