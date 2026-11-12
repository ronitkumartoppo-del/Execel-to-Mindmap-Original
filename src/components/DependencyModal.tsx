import React, { useEffect, useState, useRef } from 'react';
import { X, Lock, Check, AlertCircle, GripHorizontal } from 'lucide-react';
import { MindMapNode, CustomStatus } from '../types';

interface DependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNodeId: string | null;
  allNodes: MindMapNode[];
  customStatuses: CustomStatus[];
  draftDependencies: string[];
  onSave: () => void;
}

export default function DependencyModal({
  isOpen,
  onClose,
  currentNodeId,
  allNodes,
  customStatuses,
  draftDependencies,
  onSave,
}: DependencyModalProps) {
  // Find the current node we are editing
  const currentNode = allNodes.find((n) => n.id === currentNodeId);

  // Draggable window state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Reset position when modal opens or node changes
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, currentNodeId]);

  const handleStartDrag = (clientX: number, clientY: number, target: HTMLElement) => {
    if (target.closest('button') || target.closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    handleStartDrag(e.clientX, e.clientY, e.target as HTMLElement);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStartDrag(e.touches[0].clientX, e.touches[0].clientY, e.target as HTMLElement);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - dragStartRef.current.mouseX;
        const dy = e.touches[0].clientY - dragStartRef.current.mouseY;
        setPosition({
          x: dragStartRef.current.startX + dx,
          y: dragStartRef.current.startY + dy,
        });
      }
    };

    const handleEndDrag = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEndDrag);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEndDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, [isDragging]);

  // Esc & Enter key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSave]);

  if (!isOpen || !currentNode) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-start justify-center pt-6 px-4">
      {/* Floating Draggable Card */}
      <div
        className={`pointer-events-auto w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-500/30 dark:border-blue-500/20 p-5 flex flex-col gap-4 animate-in slide-in-from-top-6 duration-300 text-slate-900 dark:text-slate-100 ${
          isDragging ? 'shadow-blue-500/20 scale-[1.01]' : ''
        }`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px)`,
          transition: isDragging ? 'none' : 'transform 100ms ease-out',
        }}
      >
        {/* Drag Handle Top Bar */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="flex flex-col items-center cursor-grab active:cursor-grabbing select-none group pt-1 pb-1 -mt-2"
          title="Click and drag to move window"
        >
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-400 rounded-full transition-colors" />
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Drag to Move
          </span>
        </div>

        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="flex items-start justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
          title="Click and drag to move window"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Lock className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black tracking-wider uppercase text-blue-600 dark:text-blue-400">
                  Dependency Selection Mode
                </h4>
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <GripHorizontal className="w-3 h-3 text-slate-400" /> Movable
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mt-0.5">
                Predecessors for: <span className="font-extrabold text-blue-500">"{currentNode.label}"</span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors border-none bg-transparent flex items-center justify-center shrink-0"
            title="Cancel selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Counter & Status Badge */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 shrink-0 font-bold" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {draftDependencies.length} dependencies selected
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
            #{currentNode.id}
          </span>
        </div>

        {/* Hint / Instructions */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-500/10 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            Click pending nodes on the canvas to add them as dependencies. Tasks that are already completed (<span className="text-emerald-600 dark:text-emerald-400 font-bold">DONE</span>) cannot be selected.
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            paddingTop: '12px',
            marginTop: '4px',
            borderTop: '1px solid rgba(226, 232, 240, 0.8)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              padding: '9px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              backgroundColor: '#e2e8f0',
              color: '#334155',
              transition: 'background-color 150ms ease',
            }}
            title="Cancel selection"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={onSave}
            disabled={draftDependencies.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minWidth: '110px',
              flexShrink: 0,
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              cursor: draftDependencies.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: '#ffffff',
              backgroundColor: draftDependencies.length === 0 ? '#94a3b8' : '#2563eb',
              boxShadow: draftDependencies.length === 0 ? 'none' : '0 6px 18px rgba(37,99,235,0.45)',
              opacity: 1,
              visibility: 'visible',
              transition: 'transform 120ms ease, background-color 160ms ease, box-shadow 160ms ease',
            }}
            onMouseDown={(e) => {
              if (draftDependencies.length > 0) e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Done"
          >
            <Check className="w-4 h-4 text-white" />
            Done ({draftDependencies.length} selected)
          </button>
        </div>

      </div>
    </div>
  );
}
