import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { MindMapNode, ThemeConfig, Priority, Status, CustomStatus } from '../types';
import { getVisibleNodeIdsInFocusMode, shouldNodeBeVisible, isNodeInFocusCriteria } from '../utils/focus';
import { ZoomIn, ZoomOut, Maximize2, MousePointer, HelpCircle, EyeOff, Eye, Plus, Lock, Unlock, ChevronDown, ChevronUp, ChevronsUp, Calendar, Link, X } from 'lucide-react';
import { isNodeLocked, getDependencyProgress, wouldCauseCircularDependency } from '../utils/dependencies';
import { isStatusDone } from '../utils/lockLogic';
import { isDone, lockProgress, isManagerNode, getManagerStatus, ManagerStatusPill, isNodeDone } from '../utils/lockHelpers';
import FloatingActionMenu from './FloatingActionMenu';

interface MindMapNodeCardProps {
  node: MindMapNode;
  nodes: MindMapNode[];
  theme: ThemeConfig;
  customStatuses: CustomStatus[];
  isSelected: boolean;
  isSearchActive: boolean;
  isMatch: boolean;
  isGhost: boolean;
  pos: { x: number; y: number };
  isFadingOut: boolean;
  isLinkingActive: boolean;
  isSourceOfLink: boolean;
  isValidTargetOfLink: boolean;
  onSelectNode: (id: string | null) => void;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onToggleCollapse: (id: string) => void;
  onDeleteNode: (id: string) => void;
  setLinkingSourceNodeId: (id: string | null) => void;
  handleConfirmLink: (sourceId: string, targetId: string) => void;
  handleJumpToNode: (id: string, e?: React.MouseEvent) => void;
  focusNode?: (id: string) => void;
  highlightNodeId?: string | null;
  calculateProgress: (node: MindMapNode) => number;
  hasChildren: boolean;
  isAuraActive: boolean;
  linkingSourceNodeId: string | null;
  isFocusModeActive?: boolean;
  onOpenDependencyModal?: (nodeId: string) => void;
  onOpenLockModal?: (id: string) => void;
  dependencySelectionNodeId?: string | null;
  draftDependencies?: string[];
  onToggleDependency?: (nodeId: string) => void;
}

function easeOutCubicBezier(t: number): number {
  const cx = 3 * 0.2;
  const bx = 3 * (0.2 - 0.2) - cx;
  const ax = 1 - cx - bx;
  
  const cy = 3 * 0.8;
  const by = 3 * (1.0 - 0.8) - cy;
  const ay = 1 - cy - by;
  
  function sampleCurveX(tVal: number) {
    return ((ax * tVal + bx) * tVal + cx) * tVal;
  }
  
  function sampleCurveY(tVal: number) {
    return ((ay * tVal + by) * tVal + cy) * tVal;
  }
  
  function sampleCurveDerivativeX(tVal: number) {
    return (3 * ax * tVal + 2 * bx) * tVal + cx;
  }
  
  let x = t;
  let tSol = x;
  for (let i = 0; i < 8; i++) {
    const xEst = sampleCurveX(tSol) - x;
    if (Math.abs(xEst) < 1e-6) break;
    const dx = sampleCurveDerivativeX(tSol);
    if (Math.abs(dx) < 1e-6) break;
    tSol -= xEst / dx;
  }
  return sampleCurveY(tSol);
}

const MindMapNodeCard = React.memo(({
  node,
  nodes,
  theme,
  customStatuses,
  isSelected,
  isSearchActive,
  isMatch,
  isGhost,
  pos,
  isFadingOut,
  isLinkingActive,
  isSourceOfLink,
  isValidTargetOfLink,
  onSelectNode,
  onUpdateNode,
  onToggleCollapse,
  setLinkingSourceNodeId,
  handleConfirmLink,
  handleJumpToNode,
  calculateProgress,
  hasChildren,
  isAuraActive,
  linkingSourceNodeId,
  isFocusModeActive = false,
  onOpenDependencyModal,
  onOpenLockModal,
  dependencySelectionNodeId,
  draftDependencies,
  onToggleDependency,
  onDeleteNode,
  focusNode,
  highlightNodeId,
}: MindMapNodeCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.label);
  const [isBadgeHovered, setIsBadgeHovered] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const hoverTimerRef = useRef<any>(null);
  const leaveTimerRef = useRef<any>(null);

  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 80;

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(node.label);
  }, [node.label]);

  const handleFinishEdit = () => {
    if (isEditing) {
      onUpdateNode(node.id, { label: editValue.trim() || 'Task' });
      setIsEditing(false);
    }
  };

  const handleBadgeMouseEnter = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsBadgeHovered(true);
    }, 250);
  };

  const handleBadgeMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setIsBadgeHovered(false);
    }, 120);
  };

  const renderDependencyStatus = () => {
    const nodeLocked = isNodeLocked(node, nodes, customStatuses);
    const { done, total, deps } = lockProgress(node, nodes, customStatuses);
    if (total === 0) return null;

    const names = deps.map((d: any) => `${d.label} (#${d.id}) ${isDone(d, customStatuses) ? 'DONE' : 'pending'}`).join('  •  ');

    return (
      <div
        className="relative flex items-center shrink-0 select-none"
        onMouseEnter={handleBadgeMouseEnter}
        onMouseLeave={handleBadgeMouseLeave}
      >
        <div
          title={nodeLocked ? `Waiting on: ${names || '—'}` : `All predecessor tasks completed: ${names || '—'}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 999,
            background: nodeLocked ? '#fef3c7' : '#d1fae5',
            color: nodeLocked ? '#92400e' : '#065f46',
            border: nodeLocked ? '1px solid rgba(217,119,6,0.35)' : '1px solid rgba(16,185,129,0.35)',
            fontSize: 10, fontWeight: 800, letterSpacing: 0.2,
            fontVariantNumeric: 'tabular-nums', cursor: 'help',
            boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset',
          }}
        >
          {nodeLocked ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <span>{done}/{total} done</span>
        </div>

        {/* Hover Tooltip Card */}
        {isBadgeHovered && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              right: 0,
              width: '210px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 12px 28px -4px rgba(0,0,0,0.36)',
              zIndex: 1000,
              transition: 'opacity 140ms ease, transform 140ms ease',
              transform: 'translateY(-4px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', marginBottom: '6px', letterSpacing: '0.05em' }}>
              Waiting on:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
              {deps.map((dep: any) => {
                const done = isDone(dep);

                return (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (focusNode) focusNode(dep.id);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor: done ? '#10b981' : '#94a3b8',
                      }}
                    ></span>
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dep.label}
                    </span>
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8' }}>#{dep.id}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: done ? '#34d399' : '#fbbf24' }}>
                      {done ? 'DONE' : 'pending'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const rotSeed = parseInt(node.id.replace(/\D/g, '')) || 0;
  const rotAngle = theme.isSketch ? (rotSeed % 2 === 0 ? 0.8 : -0.8) : 0;

  const isOverdue = (() => {
    if (!node.dueDate) return false;
    const isDone = String(node.status || '').toUpperCase() === 'DONE';
    if (isDone) return false;
    const due = new Date(node.dueDate);
    if (isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  })();

  const isDueSoon = (() => {
    if (!node.dueDate) return false;
    const isDone = String(node.status || '').toUpperCase() === 'DONE';
    if (isDone) return false;
    if (isOverdue) return false;

    const due = new Date(node.dueDate);
    if (isNaN(due.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 || diffDays === 1;
  })();

  const isHighPriority = node.priority === 'High';
  const isMidPriority = node.priority === 'Medium';
  const isLowPriority = node.priority === 'Low';

  const isHighOverdue = isOverdue && isHighPriority;
  const isMediumOverdue = isOverdue && isMidPriority;

  const baseOpacity = isGhost
    ? 0.2
    : (isSearchActive ? (isMatch ? 1 : 0.3) : 1);

  const nodeOpacity = isFadingOut ? 0 : baseOpacity;

  const daysRemaining = (() => {
    if (!node.dueDate) return 30;
    const due = new Date(node.dueDate);
    if (isNaN(due.getTime())) return 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  })();

  const pct = (() => {
    if (isOverdue) return 100;
    if (daysRemaining <= 0) return 100;

    let windowSize = 30;
    if (daysRemaining > 180) {
      windowSize = Math.max(365, daysRemaining + 10);
    } else if (daysRemaining > 90) {
      windowSize = 180;
    } else if (daysRemaining > 30) {
      windowSize = 90;
    }

    const rawPct = ((windowSize - daysRemaining) / windowSize) * 100;
    return Math.min(100, Math.max(1.5, rawPct));
  })();

  const deg = (pct / 100) * 360;
  const progressDeg = isOverdue ? '360deg' : `${deg}deg`;
  const progressColor = isOverdue ? '#ef4444' : (isDueSoon ? '#f59e0b' : '#3b82f6');
  const hasCountdown = node.dueDate && String(node.status || '').toUpperCase() !== 'DONE';

  const glowColor = (() => {
    if (isAuraActive) return 'rgba(99, 102, 241, 0.85)';
    if (isOverdue) return 'rgba(239, 68, 68, 0.4)';
    if (isHighPriority) return 'rgba(239, 68, 68, 0.4)';
    return 'rgba(0, 0, 0, 0)';
  })();

  const isFocusHigh = isFocusModeActive && (node.priority === 'High' || String(node.priority || '').toUpperCase().trim() === 'HIGH');
  const isNodeFocused = isFocusHigh;

  const glowShadow = theme.isSketch
    ? undefined
    : (isNodeFocused
      ? `0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.3)`
      : (isAuraActive
        ? `0 0 35px 12px rgba(99, 102, 241, 0.85), 0 0 15px 4px rgba(255, 255, 255, 0.65)`
        : (isSelected
          ? `0 0 20px 6px ${glowColor}`
          : (isHighPriority || isOverdue
            ? `0 0 10px 2px ${glowColor}`
            : undefined))));

  const nodeIsDone = isNodeDone(node, nodes);
  const isDependencyModeActive = !!dependencySelectionNodeId;
  const isEditingSelf = isDependencyModeActive && node.id === dependencySelectionNodeId;
  const isCircular = isDependencyModeActive && !isEditingSelf && wouldCauseCircularDependency(node.id, dependencySelectionNodeId!, nodes);
  const isDraftSelected = isDependencyModeActive && (draftDependencies?.includes(node.id) || false);
  const isUnselectableDone = isDependencyModeActive && !isEditingSelf && nodeIsDone && !isDraftSelected;

  const focusRingClass = '';

  const ringClasses = isDependencyModeActive
    ? isEditingSelf
      ? 'ring-4 ring-rose-500 ring-offset-4 ring-offset-white dark:ring-offset-slate-900 z-50 scale-[1.05] animate-pulse'
      : isCircular
        ? 'ring-2 ring-rose-500/50 z-10'
        : isUnselectableDone
          ? 'ring-1 ring-slate-300 dark:ring-slate-700 opacity-60 cursor-not-allowed z-10'
          : isDraftSelected
            ? 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 z-30 scale-[1.03]'
            : 'hover:ring-4 hover:ring-blue-500 hover:ring-offset-1 cursor-pointer transition-all hover:scale-[1.02] z-20'
    : isMatch
      ? 'ring-2 ring-amber-400 z-40'
      : isSourceOfLink
        ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 z-30'
        : isValidTargetOfLink
          ? 'ring-4 ring-indigo-500/80 ring-offset-2 ring-offset-slate-950 animate-pulse cursor-crosshair z-30'
          : focusRingClass;

  const translateX = pos.x - (node.x ?? 0);
  const translateY = pos.y - (node.y ?? 0);

  const nodeTransform = (() => {
    let base = `translate(${translateX}px, ${translateY}px) `;
    if (theme.isSketch) {
      base += `rotate(${rotAngle}deg)`;
    }
    if (isFadingOut) {
      base += ' scale(0.95)';
    } else if (isEditingSelf) {
      base += ' scale(1.05)';
    } else if (isSelected) {
      base += ' scale(1.02)';
    } else if (isValidTargetOfLink) {
      base += ' scale(1.03)';
    }
    return base.trim() || undefined;
  })();

  const isLocked = isNodeLocked(node, nodes, customStatuses);

  const nodeTransition = `opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, background-color 0.2s ease`;

  const targetOpacity = isDependencyModeActive
    ? (isEditingSelf ? 1.0 : (isCircular || isUnselectableDone ? 0.35 : 0.95))
    : (isFocusModeActive
      ? (isFocusHigh ? 1 : 0.25)
      : (isLocked ? 0.7 : nodeOpacity));
  const targetFilter = isDependencyModeActive
    ? (isEditingSelf ? 'none' : (isCircular ? 'grayscale(70%) blur(1px)' : (isUnselectableDone ? 'grayscale(60%)' : 'none')))
    : (isFocusModeActive
      ? (isFocusHigh ? 'none' : 'blur(3px) grayscale(80%)')
      : (isLocked ? 'grayscale(50%)' : undefined));
  const targetPointerEvents = isGhost ? 'none' : 'auto';

  const dependencyTargetGlow = '0 0 30px 10px rgba(225, 29, 72, 0.85), 0 0 60px 20px rgba(225, 29, 72, 0.4)';
  const dependencyDraftGlow = '0 0 20px 6px rgba(16, 185, 129, 0.7)';

  return (
    <motion.div
      className={`absolute canvas-node-interactive animate-node-fade-in ${
        theme.isSketch
          ? isSelected
            ? 'z-20 shadow-sm'
            : 'hover:scale-101 hover:z-10'
          : isSelected
          ? 'rounded-xl z-20'
          : 'rounded-xl hover:scale-[1.01] hover:z-10'
      } ${ringClasses} priority-${node.priority?.toLowerCase() || 'none'} ${
        isLocked ? 'node-locked' : ''
      }`}
      style={{
        left: node.x ?? 0,
        top: node.y ?? 0,
        width: NODE_WIDTH,
        height: node.parentId === null ? 94 : NODE_HEIGHT,
        padding: isFocusModeActive ? '0px' : (isNodeFocused ? '4px' : '2px'),
        background: isFocusModeActive
          ? (isFocusHigh ? '#FF0000' : 'transparent')
          : (hasCountdown
            ? 'conic-gradient(var(--progress-color) var(--progress-deg), transparent var(--progress-deg))'
            : (isMatch
              ? '#FFD700'
              : (isLocked
                ? '#ef4444'
                : (isHighPriority || isOverdue
                  ? '#ef4444'
                  : (isMidPriority
                    ? '#eab308'
                    : (isLowPriority
                      ? '#3b82f6'
                      : (node.borderColor || theme.nodeBorder))))))),
        border: isFocusModeActive
          ? (isFocusHigh ? '2px solid #FF0000' : '1px solid transparent')
          : undefined,
        borderRadius: theme.isSketch ? '4px' : '10px',
        opacity: targetOpacity,
        filter: targetFilter,
        boxShadow: isDependencyModeActive
          ? (isEditingSelf ? dependencyTargetGlow : (isDraftSelected ? dependencyDraftGlow : glowShadow))
          : (isFocusModeActive
            ? (isFocusHigh ? '0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.3)' : 'none')
            : (isMatch
              ? '0 0 12px #FFD700'
              : (theme.isSketch
                ? (isSelected
                  ? `5px 5px 0px 0px ${theme.accentColor}`
                  : '4px 4px 0px 0px rgba(28,25,23,0.95)')
                : glowShadow))),
        zIndex: isFocusModeActive
          ? (isFocusHigh ? 10 : 1)
          : undefined,
        transition: nodeTransition,
        transform: nodeTransform,
        fontFamily: theme.isSketch ? '"Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive, sans-serif' : undefined,
        pointerEvents: targetPointerEvents,
        ...({
          '--progress-deg': progressDeg,
          '--progress-color': progressColor,
        } as React.CSSProperties),
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (isDependencyModeActive) {
          if (isEditingSelf || isCircular) return;
          if (nodeIsDone && !isDraftSelected) {
            // DONE tasks cannot be selected as dependencies
            return;
          }
          onToggleDependency?.(node.id);
          return;
        }
        if (isLinkingActive) {
          console.log(`[MindMapNodeCard] Target node clicked: "${node.label}" (ID: ${node.id}). Source node of link is (ID: ${linkingSourceNodeId}).`);
          if (isSourceOfLink) {
            console.log(`[MindMapNodeCard] Clicked source node itself. Canceling linking mode.`);
            setLinkingSourceNodeId(null);
            return;
          }
          console.log(`[MindMapNodeCard] Calling handleConfirmLink with sourceId: ${linkingSourceNodeId}, targetId: ${node.id}`);
          handleConfirmLink(linkingSourceNodeId!, node.id);
          return;
        }
        onSelectNode(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isLinkingActive || isDependencyModeActive) return;
        if (isLocked) return; // Prevent editing when node is locked
        setIsEditing(true);
        setEditValue(node.label);
      }}
      id={`node-card-${node.id}`}
    >
      <div 
        className="flex flex-col justify-between h-full relative p-3"
        style={{
          backgroundColor: node.fillColor || theme.nodeBg,
          borderRadius: theme.isSketch ? '2px' : '8px',
          color: node.textColor || theme.nodeText,
        }}
      >
        {/* Ping Rings */}
        {highlightNodeId === String(node.id) && [0, 1].map((k) => (
          <motion.span key={`${highlightNodeId}-${k}`}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 1.3, delay: k * 0.12, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: -4, borderRadius: 16,
              border: '2px solid #f59e0b', pointerEvents: 'none', zIndex: 50 }} />
        ))}

        {isEditingSelf && (
          <div 
            className="absolute -top-3.5 -right-3 bg-rose-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1 text-[9px] font-black tracking-wider uppercase shadow-2xl border-2 border-white dark:border-slate-900 z-50 animate-bounce"
            title="Target task currently being configured"
          >
            <Lock className="w-3 h-3 text-white shrink-0" />
            TARGET TASK
          </div>
        )}
        {isDraftSelected && (
          <div 
            className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg border-2 border-white dark:border-slate-900 font-bold z-30 animate-in zoom-in duration-200"
            title="Selected dependency"
          >
            ✓
          </div>
        )}
        {isCircular && (
          <div 
            className="absolute -top-2.5 -right-2.5 bg-rose-500 text-white px-2 py-0.5 rounded-full flex items-center justify-center text-[8px] font-black tracking-wider uppercase shadow-md border border-white dark:border-slate-900 z-30 animate-in fade-in duration-200"
            title="Circular Dependency Risk: Cannot select this node"
          >
            Circular Risk
          </div>
        )}
        {isUnselectableDone && (
          <div 
            className="absolute -top-2.5 -right-2.5 bg-slate-500 text-white px-2 py-0.5 rounded-full flex items-center justify-center text-[8px] font-black tracking-wider uppercase shadow-md border border-white dark:border-slate-900 z-30 animate-in fade-in duration-200 cursor-not-allowed"
            title="Completed task (DONE): Cannot be selected as a dependency"
          >
            DONE
          </div>
        )}
        {isNodeFocused && (
          <div className="absolute -top-1.5 -right-1.5 bg-cyan-400 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md border border-white font-bold select-none z-30 animate-bounce" title="Urgent Focus Target">
            🎯
          </div>
        )}
        <div className="w-full">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEdit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-full text-xs font-bold px-1 py-0.5 rounded outline-none text-slate-900 border border-blue-500 bg-white"
            />
          ) : (
            <div className="flex items-start justify-between gap-1">
              <span 
                className="text-xs leading-tight select-none flex items-center gap-1 min-w-0" 
                title={node.label}
                style={{ fontWeight: 'bold' }}
              >
                <span className="truncate max-w-[130px]">{node.label}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {node.priority === 'High' && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-600 shadow-3xs shrink-0 select-none" title="High Priority">
                    <ChevronsUp className="w-3 h-3 text-rose-600" />
                    <span className="text-[8px] font-black tracking-wider uppercase text-rose-700">High</span>
                  </div>
                )}
                {node.priority === 'Medium' && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-600 shadow-3xs shrink-0 select-none" title="Medium Priority">
                    <ChevronUp className="w-3 h-3 text-yellow-600" />
                    <span className="text-[8px] font-black tracking-wider uppercase text-yellow-700">Med</span>
                  </div>
                )}
                {node.priority === 'Low' && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-3xs shrink-0 select-none" title="Low Priority">
                    <ChevronDown className="w-3 h-3 text-emerald-600" />
                    <span className="text-[8px] font-black tracking-wider uppercase text-emerald-700">Low</span>
                  </div>
                )}
                {isMediumOverdue && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-100 border border-orange-300 text-orange-700 shadow-3xs shrink-0 select-none" title="Task is overdue!">
                    <span className="text-[7.5px] font-extrabold tracking-wider uppercase">Overdue</span>
                  </div>
                )}
                {isDueSoon && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-700 shadow-3xs shrink-0 select-none" title="Task is due soon!">
                    <span className="text-[7.5px] font-extrabold tracking-wider uppercase">Due Soon</span>
                  </div>
                )}
                {renderDependencyStatus()}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] font-mono opacity-50 font-bold select-none shrink-0">
              #{node.id}
            </span>
            {node.dueDate && (
              <span className={`text-[8.5px] font-mono font-bold select-none truncate flex items-center gap-0.5 ${
                isOverdue ? 'text-rose-600 font-extrabold' : isDueSoon ? 'text-yellow-600 font-extrabold' : 'text-slate-400'
              }`} title={`Due: ${node.dueDate}`}>
                <Calendar className="w-2.5 h-2.5" />
                {node.dueDate.slice(5)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(() => {
              const validLinkedNodes = (node.linkedNodeIds || [])
                .map(id => nodes.find(n => n.id === id))
                .filter((n): n is MindMapNode => !!n);

              const hasLinks = validLinkedNodes.length > 0;

              if (!hasLinks) return null;

              return (
                <div className="relative group/link flex items-center select-none">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-600 shadow-3xs text-[8.5px] font-bold">
                    <Link className="w-2.5 h-2.5" />
                    <span>{validLinkedNodes.length}</span>
                  </div>

                  <div className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover/link:opacity-100 group-hover/link:visible transition-all duration-200 pointer-events-auto z-50 w-64 p-3 bg-slate-900/95 text-white rounded-xl shadow-xl border border-slate-800 text-left">
                    <span className="text-[9px] uppercase font-bold text-indigo-400 block tracking-wider mb-2">
                      Connected Relations ({validLinkedNodes.length}):
                    </span>
                    
                    <div className="space-y-2 max-h-[160px] overflow-y-auto">
                      {validLinkedNodes.map((target, idx) => (
                        <div key={target.id} className={`${idx > 0 ? 'border-t border-slate-800/80 pt-2 mt-2' : ''} text-[11px]`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-slate-100 truncate">
                              #{target.id} - {target.label}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleJumpToNode(target.id, e)}
                              className="px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 font-extrabold text-[9px] transition-colors cursor-pointer shrink-0 border-none"
                            >
                              Jump
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border ${
                              target.priority === 'High'
                                ? 'bg-rose-950/50 text-rose-300 border-rose-900/50'
                                : target.priority === 'Medium'
                                  ? 'bg-yellow-950/50 text-yellow-300 border-yellow-900/50'
                                  : 'bg-emerald-950/50 text-emerald-300 border-emerald-900/50'
                            }`}>
                              {target.priority}
                            </span>
                            {target.status && (
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-300 bg-slate-800 px-1 py-0.2 rounded border border-slate-700/60">
                                {target.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[8.5px] text-indigo-400 font-semibold mt-2 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
                      <span>Hover & click Jump</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {isManagerNode(node, nodes) ? (
              <ManagerStatusPill status={getManagerStatus(node, nodes)} />
            ) : (
              node.status && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none shrink-0 inline-flex items-center gap-1"
                  style={(() => {
                    const sLower = String(node.status).toLowerCase();
                    if (sLower === 'blocked') {
                      return {
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        border: '1px solid #EF4444'
                      };
                    }
                    if (sLower === 'done' || sLower === 'complete' || sLower === 'completed') {
                      return {
                        backgroundColor: '#DCFCE7',
                        color: '#166534',
                        border: '1px solid #166534'
                      };
                    }
                    if (sLower === 'in progress') {
                      return {
                        backgroundColor: '#DBEAFE',
                        color: '#1E40AF',
                        border: '1px solid #2563EB'
                      };
                    }
                    if (sLower === 'stand by') {
                      return {
                        backgroundColor: '#F8FAFC',
                        color: '#64748B',
                        border: '1px solid #E2E8F0'
                      };
                    }
                    const curSt = customStatuses.find(s => s.name === node.status) || 
                                  customStatuses.find(s => s.id === node.status);
                    return {
                      backgroundColor: curSt ? curSt.colorBg : '#f1f5f9',
                      color: curSt ? curSt.colorText : '#475569',
                      border: curSt ? `1px solid ${curSt.colorBorder}` : '1px solid #cbd5e1'
                    };
                  })()}
                >
                  {String(node.status).toLowerCase() === 'blocked' && (
                    <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                  )}
                  {node.status}
                </span>
              )
            )}
          </div>
        </div>

        {node.parentId === null && (() => {
          const calculatedPct = calculateProgress(node);
          return (
            <div className="flex items-center gap-1.5 pt-1.5 mt-1.5 w-full border-t border-slate-100/60 shrink-0 select-none">
              <div className="flex-1 h-[6px] bg-[#E5E7EB] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#3B82F6] transition-[width] duration-300 ease-out rounded-full"
                  style={{ width: `${calculatedPct}%` }}
                />
              </div>
              <span className="text-[9.5px] font-bold text-slate-500 font-mono shrink-0">
                {calculatedPct}%
              </span>
            </div>
          );
        })()}

        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-5.5 h-5.5 rounded-full border shadow-sm flex items-center justify-center cursor-pointer transition-all ${
              node.collapsed
                ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-500'
                : 'bg-white border-slate-250 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
            title={node.collapsed ? 'Expand branch (Spacebar)' : 'Collapse branch (Spacebar)'}
          >
            <span className="text-[10px] font-extrabold leading-none select-none">
              {node.collapsed ? `+` : `−`}
            </span>
          </button>
         )}
       </div>

       {/* Floating iPhone-style Smooth Action Menu */}
       {isSelected && !isEditing && !dependencySelectionNodeId && (
         <FloatingActionMenu
           node={node}
           allNodes={nodes}
           focusNode={focusNode}
           onFocusNode={focusNode}
           onForceUnlock={(nodeId) => {
             onUpdateNode(nodeId, { isLocked: false, lockDependencies: [], blockedBy: [], lockedAt: undefined });
           }}
           onStartLockSelection={() => {
             onOpenLockModal?.(node.id);
           }}
           onOpenDependencyModal={() => {
             onOpenDependencyModal?.(node.id);
           }}
           onStartLinking={() => {
             setLinkingSourceNodeId(node.id);
           }}
           onStartEdit={() => {
             setIsEditing(true);
           }}
           onDelete={() => {
             onDeleteNode(node.id);
           }}
         />
       )}
     </motion.div>
  );
});

interface MindMapCanvasProps {
  nodes: MindMapNode[];
  selectedNodeId: string | null;
  theme: ThemeConfig;
  customStatuses: CustomStatus[];
  onSelectNode: (id: string | null) => void;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onBatchUpdateNodes?: (updates: { id: string; updates: Partial<MindMapNode> }[]) => void;
  onAddSibling: (baseNodeId: string) => void;
  onAddChild: (baseNodeId: string) => void;
  onToggleCollapse: (id: string) => void;
  onDeleteNode: (id: string) => void;
  layoutGeometry?: string;
  searchQuery?: string;
  isGhostModeActive?: boolean;
  isFocusModeActive?: boolean;
  onOpenDependencyModal?: (nodeId: string) => void;
  onOpenLockModal?: (id: string) => void;
  dependencySelectionNodeId?: string | null;
  draftDependencies?: string[];
  onToggleDependency?: (nodeId: string) => void;
  highlightNodeId?: string | null;
  onFocusNode?: (id: string) => void;
}

export default function MindMapCanvas({
  nodes,
  selectedNodeId,
  theme,
  customStatuses,
  onSelectNode,
  onUpdateNode,
  onBatchUpdateNodes,
  onAddSibling,
  onAddChild,
  onToggleCollapse,
  onDeleteNode,
  layoutGeometry = 'right-sided',
  searchQuery = '',
  isGhostModeActive = false,
  isFocusModeActive = false,
  onOpenDependencyModal,
  onOpenLockModal,
  dependencySelectionNodeId,
  draftDependencies,
  onToggleDependency,
  highlightNodeId,
  onFocusNode,
}: MindMapCanvasProps) {
  // Canvas Viewport Pan & Zoom States
  const [pan, setPan] = useState({ x: 50, y: 120 });
  const [zoom, setZoom] = useState(0.95);
  const [isRecentering, setIsRecentering] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [internalHighlightNodeId, setInternalHighlightNodeId] = useState<string | null>(null);
  const highlightTimerRef = useRef<any>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const activeHighlightId = highlightNodeId !== undefined && highlightNodeId !== null ? highlightNodeId : internalHighlightNodeId;

  const focusNode = (id: string) => {
    const targetNode = nodes.find((n) => n.id === id);
    if (targetNode) {
      let currentParentId = targetNode.parentId;
      while (currentParentId) {
        const parentNode = nodes.find((n) => n.id === currentParentId);
        if (parentNode && parentNode.collapsed) {
          onToggleCollapse(parentNode.id);
        }
        currentParentId = parentNode ? parentNode.parentId : null;
      }

      const viewportWidth = viewportRef.current ? viewportRef.current.clientWidth : 800;
      const viewportHeight = viewportRef.current ? viewportRef.current.clientHeight : 600;

      const nx = (targetNode.x || 0) + 110;
      const ny = (targetNode.y || 0) + (targetNode.parentId === null ? 47 : 40);

      const targetPanX = viewportWidth / 2 - nx * zoom;
      const targetPanY = viewportHeight / 2 - ny * zoom;

      setPan({ x: targetPanX, y: targetPanY });
      onSelectNode(id);
    }

    if (onFocusNode) {
      onFocusNode(id);
    }
    setInternalHighlightNodeId(id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setInternalHighlightNodeId(null);
    }, 1300);
  };

  useEffect(() => {
    if (highlightNodeId) {
      focusNode(highlightNodeId);
    }
  }, [highlightNodeId]);

  const jumpTimerRef = useRef<any>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isClickRef = useRef(true);

  // Clear jump timer when selection changes or is cleared
  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) {
        clearTimeout(jumpTimerRef.current);
      }
    };
  }, [selectedNodeId]);

  // Visual Linking Mode states
  const [linkingSourceNodeId, setLinkingSourceNodeId] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [connectionAuraIds, setConnectionAuraIds] = useState<string[]>([]);
  
  // Inherit Properties Prompt state
  const [inheritPrompt, setInheritPrompt] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);

  // Escape key listener when modal is open
  useEffect(() => {
    if (!inheritPrompt) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLinkingSourceNodeId(null);
        setInheritPrompt(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inheritPrompt]);

  // Rendered node positions tracking for smooth Cross-Fade and Slide transition
  const [renderedPositions, setRenderedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [fadingOutIds, setFadingOutIds] = useState<Set<string>>(new Set());

  // Keep track of target positions to detect changes
  const targetPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  // Keep track of active animations
  const activeAnimationsRef = useRef<Record<string, {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    startTime: number;
  }>>({});
  // Animation frame request ID
  const rafIdRef = useRef<number | null>(null);

  // Sync renderedPositions to a ref to prevent stale closures inside the nodes useEffect
  const renderedPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    renderedPositionsRef.current = renderedPositions;
  }, [renderedPositions]);

  // Clean up RAF on unmount only
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let hasChanges = false;
    const now = performance.now();
    const newAnimations: Record<string, typeof activeAnimationsRef.current[string]> = {};
    const nextRenderedPositions: Record<string, { x: number; y: number }> = { ...renderedPositionsRef.current };

    nodes.forEach((node) => {
      const nx = node.x ?? 0;
      const ny = node.y ?? 0;
      const prevTarget = targetPositionsRef.current[node.id];

      if (!prevTarget) {
        // New node, set target and rendered position immediately
        targetPositionsRef.current[node.id] = { x: nx, y: ny };
        nextRenderedPositions[node.id] = { x: nx, y: ny };
      } else if (Math.abs(prevTarget.x - nx) > 1 || Math.abs(prevTarget.y - ny) > 1) {
        // Target changed! Create animation starting from CURRENT visual position
        const currentVisual = renderedPositionsRef.current[node.id] || prevTarget;
        newAnimations[node.id] = {
          startX: currentVisual.x,
          startY: currentVisual.y,
          targetX: nx,
          targetY: ny,
          startTime: now,
        };
        targetPositionsRef.current[node.id] = { x: nx, y: ny };
        hasChanges = true;
      }
    });

    // Clean up deleted nodes
    Object.keys(targetPositionsRef.current).forEach((id) => {
      if (!nodes.some((n) => n.id === id)) {
        delete targetPositionsRef.current[id];
        delete nextRenderedPositions[id];
        delete activeAnimationsRef.current[id];
      }
    });

    // Update state synchronously for the new/deleted nodes
    setRenderedPositions(nextRenderedPositions);

    if (hasChanges) {
      console.log(`[MindMapCanvas] Animation started for nodes:`, Object.keys(newAnimations));
      activeAnimationsRef.current = {
        ...activeAnimationsRef.current,
        ...newAnimations,
      };

      if (!rafIdRef.current) {
        const tick = () => {
          const nowTick = performance.now();
          const activeKeys = Object.keys(activeAnimationsRef.current);

          if (activeKeys.length === 0) {
            console.log("[MindMapCanvas] Animation complete: all nodes reached targets");
            rafIdRef.current = null;
            return;
          }

          setRenderedPositions((prev) => {
            const next = { ...prev };
            activeKeys.forEach((id) => {
              const anim = activeAnimationsRef.current[id];
              if (!anim) return;

              const elapsed = nowTick - anim.startTime;
              const duration = 400; // 0.4 seconds

              if (elapsed >= duration) {
                next[id] = { x: anim.targetX, y: anim.targetY };
                delete activeAnimationsRef.current[id];
              } else {
                const progress = elapsed / duration;
                const ease = easeOutCubicBezier(progress);
                next[id] = {
                  x: anim.startX + (anim.targetX - anim.startX) * ease,
                  y: anim.startY + (anim.targetY - anim.startY) * ease,
                };
              }
            });
            return next;
          });

          rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
      }
    }
  }, [nodes]);

  // Handle final node link and reparenting
  const handleConfirmLink = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      alert("⚠️ Cannot link: A node cannot be linked to itself!");
      setLinkingSourceNodeId(null);
      return;
    }

    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) return;

    console.log(`[MindMapCanvas] Target node Y clicked: "${targetNode.label}" (ID: ${targetId}). Source node X is: "${sourceNode.label}" (ID: ${sourceId}).`);

    // Check for direct cycles: cannot set targetNode (parent) as a child of sourceNode (child)
    // If targetNode is already a child/descendant of sourceNode, setting sourceNode's parent to targetNode causes a cycle.
    let isCycle = false;
    let currentParentId = targetNode.parentId;
    while (currentParentId) {
      if (currentParentId === sourceId) {
        isCycle = true;
        break;
      }
      const parent = nodes.find(n => n.id === currentParentId);
      currentParentId = parent ? parent.parentId : null;
    }

    if (isCycle) {
      alert("⚠️ Cannot link: Connecting this node would create an infinite cyclical tree hierarchy!");
      setLinkingSourceNodeId(null);
      return;
    }

    // Open the Inherit Properties prompt modal!
    setInheritPrompt({ sourceId, targetId });
  };

  const executeLink = (sourceId: string, targetId: string, inherit: boolean) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) {
      setInheritPrompt(null);
      return;
    }

    console.log(`[MindMapCanvas] Moving node X: "${sourceNode.label}" (ID: ${sourceId}) under node Y: "${targetNode.label}" (ID: ${targetId}). Inherit properties from parent: ${inherit}`);

    // Double-check cycles
    let isCycle = false;
    let currentParentId = targetNode.parentId;
    while (currentParentId) {
      if (currentParentId === sourceId) {
        isCycle = true;
        break;
      }
      const parent = nodes.find(n => n.id === currentParentId);
      currentParentId = parent ? parent.parentId : null;
    }

    if (isCycle) {
      alert("⚠️ Cannot link: Connecting this node would create an infinite cyclical tree hierarchy!");
      setLinkingSourceNodeId(null);
      setInheritPrompt(null);
      return;
    }

    // Prepare child updates (sourceNode is the child)
    const childUpdates: Partial<MindMapNode> = { parentId: targetId };
    if (inherit) {
      childUpdates.priority = targetNode.priority;
      childUpdates.status = targetNode.status;
      childUpdates.fillColor = targetNode.fillColor;
      childUpdates.textColor = targetNode.textColor;
      childUpdates.borderColor = targetNode.borderColor;
      childUpdates.borderStyle = targetNode.borderStyle;
    }

    // Update parent's linkedNodeIds list (targetNode is the parent)
    const currentLinks = targetNode.linkedNodeIds || [];
    const updatedParentLinks = [...currentLinks.filter(id => id !== sourceId), sourceId];

    // Call batch updater or update individual nodes
    if (onBatchUpdateNodes) {
      onBatchUpdateNodes([
        {
          id: sourceId,
          updates: childUpdates
        },
        {
          id: targetId,
          updates: { linkedNodeIds: updatedParentLinks }
        }
      ]);
    } else {
      onUpdateNode(sourceId, childUpdates);
      onUpdateNode(targetId, { linkedNodeIds: updatedParentLinks });
    }

    // Highlight both nodes with connection aura
    setConnectionAuraIds([sourceId, targetId]);
    setTimeout(() => {
      setConnectionAuraIds([]);
    }, 2000);

    // Focus viewport / select the child node (which was sourceId)
    onSelectNode(sourceId);

    // Trigger instant progress bar recalculation
    recalculateAllProgressBars();

    // Trigger final progress bar recalculation immediately after the move animation finishes (600ms)
    setTimeout(() => {
      recalculateAllProgressBars();
    }, 600);

    // Exit linking mode and clear prompt
    setLinkingSourceNodeId(null);
    setInheritPrompt(null);
  };



  // Whiteboard tips visibility state
  const [showTips, setShowTips] = useState(() => {
    return localStorage.getItem('hide_whiteboard_tips') !== 'true';
  });

  // Sizing constants
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 80;

  // Track parent-children count for displaying expansion controls
  const childrenCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((n) => {
      if (n.parentId) {
        counts.set(n.parentId, (counts.get(n.parentId) || 0) + 1);
      }
    });
    return counts;
  }, [nodes]);

  // State trigger for force updating progress bars after animations/moves finish
  const [progressTrigger, setProgressTrigger] = useState(0);

  const recalculateAllProgressBars = () => {
    setProgressTrigger((prev) => prev + 1);
  };

  // Live computed property: calculate progress of a specific root node's branch
  const calculateProgress = (rootNode: MindMapNode): number => {
    // Access progressTrigger to establish dynamic reactivity with setProgressTrigger force updates
    const _forceTrigger = progressTrigger;

    // Recursive function to gather all leaf nodes underneath a given nodeId
    const getLeafs = (nodeId: string): MindMapNode[] => {
      const children = nodes.filter((n) => n.parentId === nodeId);
      if (children.length === 0) {
        const selfNode = nodes.find((n) => n.id === nodeId);
        return selfNode ? [selfNode] : [];
      }
      return children.flatMap((child) => getLeafs(child.id));
    };

    // If the root node itself has 0 children, then the branch has no progress (0%)
    const directChildren = nodes.filter((n) => n.parentId === rootNode.id);
    if (directChildren.length === 0) {
      return 0;
    }

    const leafNodes = getLeafs(rootNode.id);

    // Deduplicate the list of leaf nodes to ensure perfect accuracy
    const uniqueLeafIds = Array.from(new Set(leafNodes.map((n) => n.id)));
    const uniqueLeafs = uniqueLeafIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is MindMapNode => !!n);

    const total = uniqueLeafs.length;
    if (total === 0) {
      return 0;
    }

    const completed = uniqueLeafs.filter(
      (n) => isNodeDone(n, nodes)
    ).length;

    return Math.round((completed / total) * 100);
  };

  // Create a map for fast lookup of visible status
  const collapsedAncestors = React.useMemo(() => {
    const collapsedSet = new Set<string>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    nodes.forEach((n) => {
      let current = n;
      const visited = new Set<string>();
      while (current && current.parentId) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        
        const parent = nodeMap.get(current.parentId);
        if (parent && parent.collapsed) {
          collapsedSet.add(n.id);
          break;
        }
        current = parent!;
      }
    });
    return collapsedSet;
  }, [nodes]);



  // Handle keyboard events directly on the window when a node is selected (muscle memory)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (!selectedNodeId) return;

      const targetNode = nodes.find(n => n.id === selectedNodeId);

      if (e.key === 'Tab') {
        e.preventDefault();
        onAddChild(selectedNodeId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onAddSibling(selectedNodeId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (targetNode && targetNode.parentId !== null) {
          e.preventDefault();
          onDeleteNode(selectedNodeId);
          onSelectNode(null);
        }
      } else if (e.key === 'Spacebar' || e.key === ' ') {
        e.preventDefault();
        onToggleCollapse(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedNodeId, nodes, onAddChild, onAddSibling, onDeleteNode, onToggleCollapse, onSelectNode]);

  // Mouse wheel Zoom Support
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const nextZoom = e.deltaY < 0 ? Math.min(zoom * zoomFactor, 2.0) : Math.max(zoom / zoomFactor, 0.4);
    setZoom(nextZoom);
  };

  // Drag interaction for whiteboard panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-node-interactive')) {
      return;
    }
    setIsDraggingCanvas(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isClickRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 4 || dy > 4) {
        isClickRef.current = false;
      }
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
      if (isClickRef.current && e.type === 'mouseup') {
        onSelectNode(null);
        if (linkingSourceNodeId) {
          setLinkingSourceNodeId(null);
        }
      }
    }
  };

  // Touch Support (for mobile screens)
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-node-interactive')) {
      return;
    }
    if (e.touches.length === 1) {
      setIsDraggingCanvas(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingCanvas && e.touches.length === 1) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStart.current.x,
        y: touch.clientY - dragStart.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingCanvas(false);
  };

  const handleJumpToNode = (targetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const targetNode = nodes.find(n => n.id === targetId);
    if (!targetNode) return;

    // Auto-uncollapse parent hierarchy so the node is visible on jump
    let currentParentId = targetNode.parentId;
    while (currentParentId) {
      const parentNode = nodes.find(n => n.id === currentParentId);
      if (parentNode && parentNode.collapsed) {
        onToggleCollapse(parentNode.id);
      }
      currentParentId = parentNode ? parentNode.parentId : null;
    }

    // Calculate centering transformation
    const viewportWidth = viewportRef.current ? viewportRef.current.clientWidth : 800;
    const viewportHeight = viewportRef.current ? viewportRef.current.clientHeight : 600;

    const nx = (targetNode.x || 0) + NODE_WIDTH / 2;
    const ny = (targetNode.y || 0) + (targetNode.parentId === null ? 94 : NODE_HEIGHT) / 2;

    const targetPanX = viewportWidth / 2 - nx * zoom;
    const targetPanY = viewportHeight / 2 - ny * zoom;

    setPan({ x: targetPanX, y: targetPanY });
    onSelectNode(targetId);

    // Reset and trigger selection glow timer for 3 seconds
    if (jumpTimerRef.current) {
      clearTimeout(jumpTimerRef.current);
    }
    jumpTimerRef.current = setTimeout(() => {
      onSelectNode(null);
    }, 3000);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.15, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.15, 0.4));
  const handleFitToScreen = () => {
    setPan({ x: 80, y: 150 });
    setZoom(0.95);
  };

  const recenterCamera = () => {
    // Filter to only nodes with defined coordinate values
    const nodesWithCoords = nodes.filter(
      (n) => n.x !== undefined && n.y !== undefined
    );

    if (nodesWithCoords.length === 0) {
      setIsRecentering(true);
      setPan({ x: 50, y: 120 });
      setZoom(0.95);
      setTimeout(() => {
        setIsRecentering(false);
      }, 500);
      return;
    }

    // Step 1: Calculate bounding box of all nodes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodesWithCoords.forEach((node) => {
      const x = node.x!;
      const y = node.y!;
      const width = NODE_WIDTH;
      // Root node is slightly taller (94px vs 80px)
      const height = node.parentId === null ? 94 : NODE_HEIGHT;

      if (x < minX) minX = x;
      if (x + width > maxX) maxX = x + width;
      if (y < minY) minY = y;
      if (y + height > maxY) maxY = y + height;
    });

    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;

    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const viewportWidth = rect.width || 800;
      const viewportHeight = rect.height || 600;

      // Step 2: Calculate viewport fit scale (zoom) with a padding factor of 0.9
      const padding = 0.9;
      let calculatedScale = Math.min(viewportWidth / mapWidth, viewportHeight / mapHeight) * padding;

      // Cap maximum scale at 1.2 and minimum at 0.4
      calculatedScale = Math.min(Math.max(calculatedScale, 0.4), 1.2);

      // Step 3: Calculate center translation
      const mapCenterX = minX + mapWidth / 2;
      const mapCenterY = minY + mapHeight / 2;

      const targetPanX = viewportWidth / 2 - mapCenterX * calculatedScale;
      const targetPanY = viewportHeight / 2 - mapCenterY * calculatedScale;

      // Step 4: Apply transform with smooth animation
      setIsRecentering(true);
      setPan({ x: targetPanX, y: targetPanY });
      setZoom(calculatedScale);

      setTimeout(() => {
        setIsRecentering(false);
      }, 550);
    } else {
      setIsRecentering(true);
      setPan({ x: 50, y: 120 });
      setZoom(0.95);
      setTimeout(() => {
        setIsRecentering(false);
      }, 500);
    }
  };

  // Auto-recenter when nodes change to length 1 with parentId === null (e.g. Canvas Reset)
  useEffect(() => {
    if (nodes.length === 1 && nodes[0].parentId === null) {
      const timer = setTimeout(() => {
        recenterCamera();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, nodes[0]?.id]);

  // Auto-pan to first search result
  useEffect(() => {
    if (!searchQuery) return;

    // Find the first matching visible node
    const matchedNode = visibleNodes.find(node => 
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (node.notes && node.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (matchedNode && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const viewportWidth = rect.width || 800; // fallback
      const viewportHeight = rect.height || 600; // fallback

      // Calculate pan to center the node
      const targetX = (viewportWidth / 2) - (matchedNode.x + NODE_WIDTH / 2) * zoom;
      const targetY = (viewportHeight / 2) - (matchedNode.y + NODE_HEIGHT / 2) * zoom;

      setPan({ x: targetX, y: targetY });
    }
  }, [searchQuery]);





  // Filter nodes that are child-collapsed (unless ghost mode is active)
  const visibleNodesBase = isGhostModeActive
    ? nodes
    : nodes.filter((n) => !collapsedAncestors.has(n.id));

  // Set of node IDs that should be visible in Focus Mode:
  const focusVisibleNodeIds = React.useMemo(() => {
    if (!isFocusModeActive) return new Set<string>();
    return getVisibleNodeIdsInFocusMode(nodes);
  }, [isFocusModeActive, nodes]);

  // For the Depth of Field focus mode, do not hide any nodes from the screen.
  const visibleNodes = visibleNodesBase;

  // Build connection paths between nodes based on layout types
  const connectionPaths = visibleNodes
    .filter((n) => n.parentId !== null)
    .map((node) => {
      const parent = nodes.find((p) => p.id === node.parentId);
      if (!parent || (!isGhostModeActive && collapsedAncestors.has(parent.id))) return null;

      // In focus mode, only draw connection if the parent is also visible
      const isParentVisible = visibleNodes.some((v) => v.id === parent.id);
      if (!isParentVisible) return null;

      const pPos = renderedPositions[parent.id] || { x: parent.x || 0, y: parent.y || 0 };
      const nPos = renderedPositions[node.id] || { x: node.x || 0, y: node.y || 0 };

      const parentX = pPos.x;
      const parentY = pPos.y;
      const childX = nPos.x;
      const childY = nPos.y;

      // Handle search query highlighting for links
      const isSearchActive = !!searchQuery;
      const isParentMatch = isSearchActive && (
        parent.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (parent.notes && parent.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      const isNodeMatch = isSearchActive && (
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.notes && node.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      const isLinkHighlighted = isSearchActive && (isParentMatch || isNodeMatch);
      const isGhost = collapsedAncestors.has(node.id) || (node.parentId ? collapsedAncestors.has(node.parentId) : false);
      const baseLinkOpacity = isGhost
        ? 0.2
        : (isSearchActive ? (isLinkHighlighted ? 0.9 : 0.15) : 0.9);
      const isFadingNode = fadingOutIds.has(node.id);
      const isFadingParent = fadingOutIds.has(parent.id);
      const nodeOpacityValue = isFadingNode ? 0 : (node.opacity !== undefined ? node.opacity : 1);
      const parentOpacityValue = isFadingParent ? 0 : (parent.opacity !== undefined ? parent.opacity : 1);
      const linkOpacity = baseLinkOpacity * Math.min(nodeOpacityValue, parentOpacityValue);

      const isParentHigh = parent.priority === 'High' || String(parent.priority || '').toUpperCase().trim() === 'HIGH';
      const isNodeHigh = node.priority === 'High' || String(node.priority || '').toUpperCase().trim() === 'HIGH';

      const targetLinkOpacity = isFocusModeActive
        ? (isParentHigh && isNodeHigh ? 0.8 : 0.15)
        : linkOpacity;
      const targetLinkFilter = isFocusModeActive
        ? (isParentHigh && isNodeHigh ? 'none' : 'blur(1.5px)')
        : undefined;

      let dPath = '';

      // Geometrical routing selection
      const straightLayouts = [
        'radial', 'concentric-rings', 'concept-web', 'bubble-matrix', 'cloud-cluster',
        'closed-loop', 'diamond-network', 'quad-matrix', 'venn-diagram', 'hub-spoke',
        'diagonal-step', 'spiral-growth', 'pie-sunburst', 'triple-wing', 'star-topology',
        'kanban-lanes', 'priority-quadrants', 'impact-effort', 'swimlane-flow', 'value-stream',
        'gantt-rows', 'hex-honeycomb', 'dual-track-timeline', 'spine-journal', 'fishbone-lr',
        'fishbone-rl'
      ];

      const topDownLayouts = [
        'top-down', 'pyramid', 'funnel', 'sitemap-outline', 'flowchart-block'
      ];

      if (layoutGeometry === 'block-90') {
        const sideRight = childX >= parentX;
        const px = sideRight ? parentX + NODE_WIDTH : parentX;
        const py = parentY + NODE_HEIGHT / 2;
        const cx = sideRight ? childX : childX + NODE_WIDTH;
        const cy = childY + NODE_HEIGHT / 2;
        const mx = (px + cx) / 2;

        dPath = `M ${px} ${py} L ${mx} ${py} L ${mx} ${cy} L ${cx} ${cy}`;
      } else if (topDownLayouts.includes(layoutGeometry)) {
        const px = parentX + NODE_WIDTH / 2;
        const py = parentY + NODE_HEIGHT;
        const cx = childX + NODE_WIDTH / 2;
        const cy = childY;
        const my = (py + cy) / 2;

        dPath = `M ${px} ${py} L ${px} ${my} L ${cx} ${my} L ${cx} ${cy}`;
      } else if (layoutGeometry === 'bottom-up') {
        const px = parentX + NODE_WIDTH / 2;
        const py = parentY;
        const cx = childX + NODE_WIDTH / 2;
        const cy = childY + NODE_HEIGHT;
        const my = (py + cy) / 2;

        dPath = `M ${px} ${py} L ${px} ${my} L ${cx} ${my} L ${cx} ${cy}`;
      } else if (layoutGeometry === 'vertical-flow') {
        const px = parentX + NODE_WIDTH / 2;
        const py = parentY + NODE_HEIGHT;
        const cx = childX;
        const cy = childY + NODE_HEIGHT / 2;

        dPath = `M ${px} ${py} L ${px} ${cy} L ${cx} ${cy}`;
      } else if (straightLayouts.includes(layoutGeometry)) {
        // Direct radial straight connections
        const px = parentX + NODE_WIDTH / 2;
        const py = parentY + NODE_HEIGHT / 2;
        const cx = childX + NODE_WIDTH / 2;
        const cy = childY + NODE_HEIGHT / 2;

        dPath = `M ${px} ${py} L ${cx} ${cy}`;
      } else {
        // Horizontal side-aware elegant cubic curves (Default / Right, Left, Wings, Brackets, Zigzag, etc.)
        const isChildOnRight = childX >= parentX;
        const px = isChildOnRight ? parentX + NODE_WIDTH : parentX;
        const py = parentY + NODE_HEIGHT / 2;
        const cx = isChildOnRight ? childX : childX + NODE_WIDTH;
        const cy = childY + NODE_HEIGHT / 2;

        const controlDist = Math.abs(cx - px) * 0.45;
        const cp1x = isChildOnRight ? px + controlDist : px - controlDist;
        const cp1y = py;
        const cp2x = isChildOnRight ? cx - controlDist : cx + controlDist;
        const cp2y = cy;

        dPath = `M ${px} ${py} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${cx} ${cy}`;
      }

      if (theme.isSketch) {
        return (
          <g key={`link-sketch-${parent.id}-${node.id}`} style={{ opacity: targetLinkOpacity, filter: targetLinkFilter }} className="transition-opacity duration-300">
            <path
              d={dPath}
              fill="none"
              stroke="#1C1917"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Added sketchy jitter offset path */}
            <path
              d={dPath.replace(/([\d.]+)/g, (match) => String(parseFloat(match) + (Math.random() * 1.5 - 0.7)))}
              fill="none"
              stroke="#1C1917"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        );
      }

      return (
        <path
          key={`link-${parent.id}-${node.id}`}
          d={dPath}
          fill="none"
          stroke={theme.connectorColor}
          strokeWidth="3.2"
          strokeLinecap="round"
          style={{ opacity: targetLinkOpacity, filter: targetLinkFilter }}
          className="transition-[opacity,stroke-width] duration-300 hover:opacity-100 hover:stroke-[4.5px]"
        />
      );
    });

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      id="whiteboard-canvas-viewport"
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${
        isFocusModeActive ? 'focus-mode-active' : ''
      } ${
        linkingSourceNodeId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{ backgroundColor: theme.canvasBg }}
    >
      {/* Floating Interactive Linking Mode Banner */}
      {linkingSourceNodeId && (() => {
        const sourceNode = nodes.find(n => n.id === linkingSourceNodeId);
        return (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-900/95 border border-indigo-500/35 text-white shadow-2xl animate-bounce backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <div className="text-xs font-bold tracking-tight">
              Select target node to connect under <span className="text-indigo-300 font-extrabold">"{sourceNode?.label}"</span>
            </div>
            <button
              onClick={() => setLinkingSourceNodeId(null)}
              className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
              title="Cancel Linking Mode"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

      {/* Inherit parent node properties confirmation modal */}
      {inheritPrompt && (() => {
        const sourceNode = nodes.find(n => n.id === inheritPrompt.sourceId);
        const targetNode = nodes.find(n => n.id === inheritPrompt.targetId);
        return (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={() => {
              setLinkingSourceNodeId(null);
              setInheritPrompt(null);
            }}
          >
            <div 
              className="relative w-full max-w-sm p-6 bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-800 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close "X" Button in the Top-Right Corner */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLinkingSourceNodeId(null);
                  setInheritPrompt(null);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Link className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1.5 min-w-0 flex-1 pr-6">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                    Inherit Properties?
                  </h3>
                  <p className="text-[11.5px] text-slate-500 leading-relaxed">
                    Should child node <span className="font-bold text-indigo-600">"{sourceNode?.label}"</span> inherit its parent node's <span className="font-bold text-slate-800">"{targetNode?.label}"</span> properties (Priority, Status, Color)?
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-center mt-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    executeLink(inheritPrompt.sourceId, inheritPrompt.targetId, true);
                  }}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-black hover:bg-neutral-900 border-none rounded-md cursor-pointer shadow-md transition-all active:scale-95 text-center flex-1"
                >
                  Yes, Inherit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    executeLink(inheritPrompt.sourceId, inheritPrompt.targetId, false);
                  }}
                  className="px-5 py-2.5 text-xs font-normal text-black bg-white hover:bg-neutral-50 border border-black rounded-md cursor-pointer transition-all active:scale-95 text-center flex-1"
                >
                  No, Keep Original
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dynamic Grid Background Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{
          backgroundImage: theme.isSketch
            ? `radial-gradient(rgba(28, 25, 23, 0.08) 1.5px, transparent 1.5px)`
            : `radial-gradient(${theme.gridLineColor} 1.8px, transparent 1.8px)`,
          backgroundSize: '24px 24px',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Main Scaled & Panned Interactive Layer */}
      <div
        className={`absolute origin-top-left ${
          isRecentering
            ? 'transition-transform duration-500 ease-in-out'
            : 'transition-transform duration-75 ease-out'
        }`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Connection Curves SVG */}
        <svg
          className="absolute pointer-events-none overflow-visible"
          style={{ left: 0, top: 0, width: '10000px', height: '10000px' }}
        >
          {connectionPaths}
        </svg>

        {/* Nodes Layer */}
        {visibleNodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const hasChildren = (childrenCounts.get(node.id) || 0) > 0;
          const isSearchActive = !!searchQuery;
          const isMatch = isSearchActive && (
            node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (node.notes && node.notes.toLowerCase().includes(searchQuery.toLowerCase()))
          );
          const isGhost = collapsedAncestors.has(node.id);
          const isSourceOfLink = linkingSourceNodeId === node.id;
          const isLinkingActive = linkingSourceNodeId !== null;
          const isValidTargetOfLink = isLinkingActive && !isSourceOfLink;
          const isAuraActive = connectionAuraIds.includes(node.id);

          const pos = renderedPositions[node.id] || { x: node.x || 0, y: node.y || 0 };
          const isFadingOut = fadingOutIds.has(node.id);

          return (
            <MindMapNodeCard
              key={node.id}
              node={node}
              nodes={nodes}
              theme={theme}
              customStatuses={customStatuses}
              isSelected={isSelected}
              isSearchActive={isSearchActive}
              isMatch={isMatch}
              isGhost={isGhost}
              pos={pos}
              isFadingOut={isFadingOut}
              isLinkingActive={isLinkingActive}
              isSourceOfLink={isSourceOfLink}
              isValidTargetOfLink={isValidTargetOfLink}
              onSelectNode={onSelectNode}
              onUpdateNode={onUpdateNode}
              onToggleCollapse={onToggleCollapse}
              onDeleteNode={onDeleteNode}
              setLinkingSourceNodeId={setLinkingSourceNodeId}
              handleConfirmLink={handleConfirmLink}
              handleJumpToNode={handleJumpToNode}
              calculateProgress={calculateProgress}
              hasChildren={hasChildren}
              isAuraActive={isAuraActive}
              linkingSourceNodeId={linkingSourceNodeId}
              isFocusModeActive={isFocusModeActive}
              onOpenDependencyModal={onOpenDependencyModal}
              onOpenLockModal={onOpenLockModal}
              dependencySelectionNodeId={dependencySelectionNodeId}
              draftDependencies={draftDependencies}
              onToggleDependency={onToggleDependency}
              focusNode={focusNode}
              highlightNodeId={activeHighlightId}
            />
          );
        })}
      </div>

      {/* Persistent Whiteboard Controls overlay (Floating Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl text-white shadow-2xl transition-colors duration-300">
        <button
          onClick={handleZoomIn}
          id="canvas-zoomin-btn"
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          id="canvas-zoomout-btn"
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs px-2 select-none font-mono opacity-80 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleFitToScreen}
          id="canvas-fit-btn"
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors border-l border-slate-800 pl-3"
          title="Fit Canvas"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Recenter Camera Widget */}
      <div className="absolute bottom-6 left-6 z-40 flex items-center gap-2">
        <button
          id="btn-recenter-camera"
          onClick={recenterCamera}
          className="flex items-center gap-2 px-4 py-2 font-bold rounded-full shadow-lg transition-all"
          style={{
            backgroundColor: '#111827',
            color: '#ffffff',
            border: '2px solid #374151',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            visibility: 'visible',
            opacity: 1,
            display: 'flex',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Recenter View
        </button>
      </div>

      {/* Floating Interactive Canvas Guide indicator */}
      {showTips && (
        <div 
          className="absolute top-4 right-4 z-30 flex items-start gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 p-2.5 pr-8 rounded-lg text-[10px] text-slate-300 max-w-[260px] shadow-lg pointer-events-auto"
        >
          <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Whiteboard Tips:</span> Drag empty space to pan. Scroll to zoom. Double-click any node card to edit text.
          </div>
          <button
            id="btn-close-tips"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTips(false);
              localStorage.setItem('hide_whiteboard_tips', 'true');
            }}
            className="absolute top-1 right-1 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent font-bold text-[10px]"
            title="Dismiss Tips"
          >
            ✕
          </button>
        </div>
      )}

      {/* Centered Add Dependency Modal - REMOVED */}

    </div>
  );
}
