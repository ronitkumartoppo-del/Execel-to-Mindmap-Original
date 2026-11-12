import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  ChevronsUp, 
  ChevronUp, 
  Clock, 
  Plus, 
  Trash2,
  FolderOpen,
  FolderClosed,
  CheckCircle,
  Circle,
  Lock
} from 'lucide-react';
import { MindMapNode, ThemeConfig, CustomStatus, Priority } from '../types';
import { isNodeLocked, getDependencyProgress } from '../utils/dependencies';
import { getVisibleNodeIdsInFocusMode, shouldNodeBeVisible, isNodeInFocusCriteria } from '../utils/focus';

interface BoardViewProps {
  nodes: MindMapNode[];
  theme: ThemeConfig;
  customStatuses: CustomStatus[];
  searchQuery: string;
  selectedNodeId: string | null;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onDeleteNode: (id: string) => void;
  onSelectNode: (id: string | null) => void;
  isFocusModeActive?: boolean;
}

export default function BoardView({
  nodes,
  theme,
  customStatuses,
  searchQuery,
  selectedNodeId,
  onUpdateNode,
  onDeleteNode,
  onSelectNode,
  isFocusModeActive = false,
}: BoardViewProps) {
  // Set of node IDs that should be visible in Focus Mode:
  const focusVisibleNodeIds = React.useMemo(() => {
    if (!isFocusModeActive) return new Set<string>();
    return getVisibleNodeIdsInFocusMode(nodes);
  }, [isFocusModeActive, nodes]);

  // Local state for dragging states
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<'TODO' | 'IN PROGRESS' | 'DONE' | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // Local state for expanded/collapsed cards
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Recurse to calculate child task completion progress of a branch
  const calculateNodeProgress = (node: MindMapNode): number => {
    const getLeafs = (id: string): MindMapNode[] => {
      const children = nodes.filter(n => n.parentId === id);
      if (children.length === 0) {
        const selfNode = nodes.find(n => n.id === id);
        return selfNode ? [selfNode] : [];
      }
      return children.flatMap(child => getLeafs(child.id));
    };

    const directChildren = nodes.filter(n => n.parentId === node.id);
    if (directChildren.length === 0) return 0;

    const leafs = getLeafs(node.id);
    const uniqueLeafs = Array.from(new Set(leafs.map(l => l.id)))
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is MindMapNode => !!n);

    if (uniqueLeafs.length === 0) return 0;
    const completed = uniqueLeafs.filter(
      n => String(n.status || '').toUpperCase() === 'DONE'
    ).length;

    return Math.round((completed / uniqueLeafs.length) * 100);
  };

  const toggleCardCollapse = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Drag and Drop Column Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoveredColumn(null);
    setHoveredCardId(null);
  };

  const handleDragOverColumn = (e: React.DragEvent, status: 'TODO' | 'IN PROGRESS' | 'DONE') => {
    e.preventDefault();
    if (hoveredColumn !== status) {
      setHoveredColumn(status);
    }
  };

  const handleDragLeaveColumn = () => {
    setHoveredColumn(null);
  };

  const handleDropOnColumn = (e: React.DragEvent, targetStatus: 'TODO' | 'IN PROGRESS' | 'DONE') => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain') || draggingId;
    if (!draggedId) return;

    const nodeToUpdate = nodes.find(n => n.id === draggedId);
    if (!nodeToUpdate) return;

    // Map uppercase back to proper template casings ('Todo', 'In Progress', 'Done')
    const statusMap: Record<'TODO' | 'IN PROGRESS' | 'DONE', string> = {
      'TODO': 'Todo',
      'IN PROGRESS': 'In Progress',
      'DONE': 'Done'
    };
    const mappedStatus = statusMap[targetStatus];

    if (nodeToUpdate.status !== mappedStatus) {
      onUpdateNode(draggedId, { status: mappedStatus });
    }
    setHoveredColumn(null);
  };

  // Drag and Drop Card Handlers
  const handleDragOverCard = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingId && draggingId !== cardId && hoveredCardId !== cardId) {
      setHoveredCardId(cardId);
    }
  };

  const handleDragLeaveCard = (e: React.DragEvent) => {
    e.preventDefault();
    setHoveredCardId(null);
  };

  const handleDropOnCard = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = e.dataTransfer.getData('text/plain') || draggingId;
    if (!draggedId || draggedId === targetCardId) return;

    // Check circular dependency: is targetCardId a descendant of draggedId?
    const isDescendant = (parentId: string, childId: string): boolean => {
      const child = nodes.find(n => n.id === childId);
      if (!child) return false;
      if (child.parentId === parentId) return true;
      if (child.parentId === null) return false;
      return isDescendant(parentId, child.parentId);
    };

    if (isDescendant(draggedId, targetCardId)) {
      alert("Circular dependency warning: You cannot drop a parent task onto its own subtask!");
      setHoveredCardId(null);
      return;
    }

    onUpdateNode(draggedId, { parentId: targetCardId });
    setHoveredCardId(null);
  };

  // Helper to filter and group top-level column nodes
  const getColumnNodes = (statusType: 'TODO' | 'IN PROGRESS' | 'DONE') => {
    return nodes.filter(n => {
      // Search matching first
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          String(n.label || '').toLowerCase().includes(query) ||
          String(n.notes || '').toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      const s = String(n.status || '').toUpperCase().trim();
      const isMatch = (() => {
        if (statusType === 'TODO') {
          return s === 'TODO' || (s !== 'IN PROGRESS' && s !== 'DONE');
        }
        if (statusType === 'IN PROGRESS') {
          return s === 'IN PROGRESS';
        }
        if (statusType === 'DONE') {
          return s === 'DONE';
        }
        return false;
      })();

      if (!isMatch) return false;

      // If search query is active, display flat list without nested filtering
      if (searchQuery.trim()) return true;

      // Filter to top-level cards in this status: parent doesn't exist or parent is in a different status
      if (!n.parentId) return true;
      const parent = nodes.find(p => p.id === n.parentId);
      if (!parent) return true;

      const parentStatusMatch = (() => {
        const ps = String(parent.status || '').toUpperCase().trim();
        if (statusType === 'TODO') {
          return ps === 'TODO' || (ps !== 'IN PROGRESS' && ps !== 'DONE');
        }
        if (statusType === 'IN PROGRESS') {
          return ps === 'IN PROGRESS';
        }
        if (statusType === 'DONE') {
          return ps === 'DONE';
        }
        return false;
      })();

      return !parentStatusMatch;
    });
  };

  const getColumnTotalCount = (statusType: 'TODO' | 'IN PROGRESS' | 'DONE') => {
    return nodes.filter(n => {
      const s = String(n.status || '').toUpperCase().trim();
      if (statusType === 'TODO') {
        return s === 'TODO' || (s !== 'IN PROGRESS' && s !== 'DONE');
      }
      if (statusType === 'IN PROGRESS') {
        return s === 'IN PROGRESS';
      }
      if (statusType === 'DONE') {
        return s === 'DONE';
      }
      return false;
    }).length;
  };

  // Render a specific card recursively
  const renderCard = (node: MindMapNode, depth: number = 0) => {
    const shouldShow = isFocusModeActive ? (node.priority === 'High') : true;
    console.log("Node:", node.label, "Focus Mode:", isFocusModeActive, "Should Show:", shouldShow);

    const isOverdue = (() => {
      const isDone = String(node.status || '').toUpperCase() === 'DONE';
      if (isDone) return false;
      const due = new Date(node.dueDate || '');
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
    const progressColor = '#06b6d4'; // beautiful cyan
    const hasCountdown = node.dueDate && String(node.status || '').toUpperCase() !== 'DONE';

    const isFocusHigh = isFocusModeActive && (node.priority === 'High' || String(node.priority || '').toUpperCase().trim() === 'HIGH');
    const isNodeFocused = isFocusHigh;

    // Priority glow aura styles
    const glowShadow = (() => {
      if (theme.isSketch) return undefined;
      if (isOverdue) return '0 0 14px 2px rgba(239, 68, 68, 0.45)';
      if (isHighPriority) return '0 0 14px 3px rgba(239, 68, 68, 0.4)';
      return '0 2px 4px 0 rgba(0, 0, 0, 0.05)';
    })();

    // Border color styles (conic-gradient for countdown, or static priority color)
    const cardStyle: React.CSSProperties = isFocusModeActive
      ? {
          opacity: isFocusHigh ? 1 : 0.25,
          filter: isFocusHigh ? 'none' : 'blur(3px) grayscale(80%)',
          border: isFocusHigh ? '2px solid #FF0000' : '1px solid transparent',
          boxShadow: isFocusHigh ? '0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.3)' : 'none',
          zIndex: isFocusHigh ? 10 : 1,
          background: isFocusHigh ? '#FF0000' : 'transparent',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }
      : {
          background: hasCountdown
            ? `conic-gradient(${progressColor} ${progressDeg}, transparent ${progressDeg})`
            : (isHighPriority || isOverdue
              ? '#ef4444'
              : (isMidPriority
                ? '#eab308'
                : (isLowPriority
                  ? '#3b82f6'
                  : (node.borderColor || theme.nodeBorder)))),
          boxShadow: glowShadow,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        };

    // Find children in the mindmap
    const childrenNodesBase = nodes.filter(n => n.parentId === node.id);
    const childrenNodes = childrenNodesBase;
    const hasChildren = childrenNodes.length > 0;
    const isCollapsed = collapsedCards[node.id] ?? false;
    const calculatedProgress = hasChildren ? calculateNodeProgress(node) : 0;

    const isSelected = selectedNodeId === node.id;
    const isLocked = isNodeLocked(node, nodes);
    const depProgress = getDependencyProgress(node, nodes);

    return (
      <div 
        key={node.id} 
        className="w-full select-none"
        style={{ paddingLeft: searchQuery.trim() ? '0px' : `${depth * 10}px` }}
      >
        <div
          id={`board-card-${node.id}`}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOverCard(e, node.id)}
          onDragLeave={handleDragLeaveCard}
          onDrop={(e) => handleDropOnCard(e, node.id)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(node.id);
          }}
          className={`group/card relative transition-all duration-200 cursor-grab active:cursor-grabbing rounded-xl ${
            isFocusModeActive ? 'p-0' : (isNodeFocused ? 'p-1' : 'p-[2px]')
          } ${
            draggingId === node.id ? 'opacity-30 scale-95 rotate-1 shadow-xs' : 'hover:scale-[1.015]'
          } ${
            hoveredCardId === node.id ? 'ring-4 ring-indigo-500/80 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-[1.03] z-10' : ''
          } ${
            isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
          } ${
            isLocked ? 'node-locked opacity-70 grayscale-[50%]' : ''
          }`}
          style={cardStyle}
        >
          <div
            className="flex flex-col justify-between h-full relative p-3.5 transition-colors duration-200"
            style={{
              backgroundColor: node.fillColor || (theme.isDark ? '#111827' : '#ffffff'),
              borderRadius: '10px',
              color: node.textColor || (theme.isDark ? '#f3f4f6' : '#1f2937'),
            }}
          >
            {/* Top header line of the card */}
            <div className="w-full">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5 min-w-0">
                  {/* Nesting Expand/Collapse Toggle */}
                  {hasChildren && !searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={(e) => toggleCardCollapse(e, node.id)}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors border-none bg-transparent cursor-pointer shrink-0 mt-0.5"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  
                  {isLocked && (
                    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" title="Locked by incomplete dependency" />
                  )}

                  <span 
                    className={`text-xs leading-snug font-bold block ${
                      isSelected ? 'text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    {node.label}
                  </span>
                </div>

                {/* Priority / Time badges */}
                <div className="flex items-center gap-1 shrink-0">
                  {isNodeFocused && (
                    <span className="animate-bounce select-none text-xs mr-0.5" title="Urgent Focus Target">🎯</span>
                  )}
                  {isHighPriority && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200/50 dark:border-rose-900/30">
                      High
                    </span>
                  )}
                  {isMidPriority && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200/50 dark:border-amber-900/30">
                      Med
                    </span>
                  )}
                  {isLowPriority && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50 dark:border-emerald-900/30">
                      Low
                    </span>
                  )}
                  {isOverdue && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300">
                      Overdue
                    </span>
                  )}
                  {isDueSoon && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-300 border border-yellow-300">
                      Soon
                    </span>
                  )}

                </div>
              </div>

              {/* Dependency Progress bar */}
              {depProgress.total > 0 && (
                <div className="flex items-center gap-1.5 mt-2 shrink-0 select-none">
                  <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5 shrink-0">
                    <Lock className="w-2.5 h-2.5" /> Dep:
                  </span>
                  <div className="flex-1 h-[4px] bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-[width] duration-300 ease-out rounded-full"
                      style={{ width: `${depProgress.percentage}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-black text-amber-500 font-mono text-right shrink-0">
                    {depProgress.done}/{depProgress.total}
                  </span>
                </div>
              )}

              {/* Notes block */}
              {node.notes && (
                <p className="text-[10.5px] mt-2 text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                  {node.notes}
                </p>
              )}
            </div>

            {/* Bottom Status metadata bar of the card */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100/40 dark:border-slate-800/40">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono opacity-55 font-black">
                  #{node.id}
                </span>
                
                {node.dueDate && (
                  <span className={`text-[9px] font-semibold select-none flex items-center gap-0.5 ${
                    isOverdue ? 'text-rose-500 font-extrabold' : isDueSoon ? 'text-amber-500 font-extrabold' : 'text-slate-400'
                  }`}>
                    <Calendar className="w-3 h-3" />
                    {node.dueDate}
                  </span>
                )}
              </div>

              {/* Trash/Quick action buttons visible on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete Task #${node.id} and all its subtasks?`)) {
                      onDeleteNode(node.id);
                    }
                  }}
                  className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-600 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                  title="Delete Card"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Bottom branch completion progress bar */}
            {hasChildren && (
              <div className="flex items-center gap-1.5 pt-2.5 mt-2.5 w-full border-t border-slate-100/60 dark:border-slate-800/60 shrink-0 select-none">
                <div className="flex-1 h-[5px] bg-[#E5E7EB] dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-600 transition-[width] duration-300 ease-out rounded-full"
                    style={{ width: `${calculatedProgress}%` }}
                  />
                </div>
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 font-mono w-6 text-right shrink-0">
                  {calculatedProgress}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Nested Indented Child Cards */}
        {hasChildren && !isCollapsed && !searchQuery.trim() && (
          <div className="pl-3 border-l-2 border-slate-200/50 dark:border-slate-800/50 mt-2.5 space-y-2.5">
            {childrenNodes.map(childNode => renderCard(childNode, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const columnsList: ('TODO' | 'IN PROGRESS' | 'DONE')[] = ['TODO', 'IN PROGRESS', 'DONE'];

  return (
    <div className={`w-full h-full grid grid-cols-3 gap-4 p-4 md:p-6 select-none overflow-hidden ${
      isFocusModeActive ? 'focus-mode-active' : ''
    } ${
      theme.isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {columnsList.map(status => {
        const columnCards = getColumnNodes(status);
        const count = getColumnTotalCount(status);
        const isHovered = hoveredColumn === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOverColumn(e, status)}
            onDragLeave={handleDragLeaveColumn}
            onDrop={(e) => handleDropOnColumn(e, status)}
            className={`flex flex-col h-full rounded-2xl border transition-all duration-200 shadow-md min-w-0 overflow-hidden ${
              theme.isDark 
                ? `${isHovered ? 'bg-slate-900/90 border-indigo-500/50 shadow-indigo-950/35' : 'bg-slate-900/40 border-slate-800/60'}` 
                : `${isHovered ? 'bg-slate-100 border-indigo-500/40 shadow-indigo-100/35' : 'bg-slate-100/60 border-slate-200/80'}`
            }`}
          >
            {/* Column Header */}
            <div className={`p-4 flex items-center justify-between border-b ${
              theme.isDark ? 'border-slate-800/40' : 'border-slate-200/60'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  status === 'TODO' 
                    ? 'bg-slate-400' 
                    : status === 'IN PROGRESS' 
                      ? 'bg-cyan-500 animate-pulse' 
                      : 'bg-emerald-500'
                }`} />
                <h3 className={`text-xs font-black tracking-wider uppercase select-none ${
                  theme.isDark ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  {status} ({count})
                </h3>
              </div>
            </div>

            {/* Column Cards Container - scrollable vertical list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 flex flex-col">
              {columnCards.length > 0 ? (
                columnCards.map(node => renderCard(node, 0))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500/60 dark:text-slate-500">
                  <div className="w-8 h-8 rounded-full border border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-center mb-2 shrink-0">
                    <Circle className="w-4 h-4 opacity-40" />
                  </div>
                  <span className="text-xs font-semibold">No tasks</span>
                  <span className="text-[10px] mt-1 opacity-60">Drag cards here to change status</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
