import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MindMapNode, ThemeConfig, Priority, CustomStatus } from '../types';
import { isNodeLocked } from '../utils/dependencies';
import { isManagerNode, getManagerStatus, ManagerStatusPill } from '../utils/lockHelpers';
import { getVisibleNodeIdsInFocusMode, shouldNodeBeVisible, isNodeInFocusCriteria } from '../utils/focus';
import { 
  Calendar, 
  ChevronDown, 
  CheckCircle2, 
  Plus, 
  Trash2,
  ListTodo,
  FileText,
  Search,
  Filter,
  Check,
  CalendarRange,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Lock
} from 'lucide-react';

interface TableViewProps {
  nodes: MindMapNode[];
  theme: ThemeConfig;
  customStatuses: CustomStatus[];
  searchQuery: string;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onBatchUpdateNodes?: (batchUpdates: { id: string; updates: Partial<MindMapNode> }[]) => void;
  onDeleteNode: (id: string) => void;
  onAddChild: (id: string) => void;
  onSelectNode: (id: string | null) => void;
  isFocusModeActive?: boolean;
}

export default function TableView({
  nodes,
  theme,
  customStatuses,
  searchQuery,
  onUpdateNode,
  onBatchUpdateNodes,
  onDeleteNode,
  onAddChild,
  onSelectNode,
  isFocusModeActive = false,
}: TableViewProps) {
  // Pro Filters, Search & View Options
  const [localQuery, setLocalQuery] = useState<string>('');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<boolean>(false);
  
  // Track which status names are checked (true = shown, false = hidden)
  const [activeStatuses, setActiveStatuses] = useState<Record<string, boolean>>({});

  // Sorting State
  const [currentSort, setCurrentSort] = useState<{
    column: 'title' | 'status' | 'priority' | 'dueDate' | null;
    direction: 'asc' | 'desc';
  }>({ column: null, direction: 'asc' });

  // Cell editing state for dropdown select
  const [editingCell, setEditingCell] = useState<{ nodeId: string; field: 'status' | 'priority' } | null>(null);

  // Bulk Selection State
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Toggle Sorting column
  const handleSort = (columnName: 'title' | 'status' | 'priority' | 'dueDate') => {
    if (currentSort.column === columnName) {
      setCurrentSort({
        column: columnName,
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setCurrentSort({
        column: columnName,
        direction: 'asc'
      });
    }
  };

  // Check if status is a "completed" or "done" status
  const isCompletedStatus = (statusId: string) => {
    return statusId.toLowerCase() === 'done';
  };

  // Check if a specific status is filtered out / shown
  const isStatusActive = (statusId: string) => {
    if (activeStatuses[statusId] === undefined) {
      return true; // default to shown
    }
    return activeStatuses[statusId];
  };

  // Toggle Hide Completed switch
  const handleToggleHideCompleted = (checked: boolean) => {
    setHideCompleted(checked);
    const updated = { ...activeStatuses };
    if (checked) {
      // Find all completed statuses and uncheck them
      customStatuses.forEach(cs => {
        if (isCompletedStatus(cs.name) || isCompletedStatus(cs.id)) {
          updated[cs.id] = false;
        }
      });
      // Fallback
      updated['Done'] = false;
      updated['DONE'] = false;
      updated['done'] = false;
    } else {
      // Check them back on
      customStatuses.forEach(cs => {
        if (isCompletedStatus(cs.name) || isCompletedStatus(cs.id)) {
          updated[cs.id] = true;
        }
      });
      updated['Done'] = true;
      updated['DONE'] = true;
      updated['done'] = true;
    }
    setActiveStatuses(updated);
  };

  // Parse hierarchy
  const getHierarchicalList = (allNodes: MindMapNode[]) => {
    const childrenMap = new Map<string, MindMapNode[]>();
    const roots: MindMapNode[] = [];

    allNodes.forEach((node) => {
      if (!node.parentId) {
        roots.push(node);
      } else {
        const list = childrenMap.get(node.parentId) || [];
        list.push(node);
        childrenMap.set(node.parentId, list);
      }
    });

    const result: { node: MindMapNode; depth: number }[] = [];

    const traverse = (node: MindMapNode, depth: number) => {
      result.push({ node, depth });
      const children = childrenMap.get(node.id) || [];
      // Sort stable by coordinates or ID
      children.sort((a, b) => (a.y || 0) - (b.y || 0));
      children.forEach((child) => traverse(child, depth + 1));
    };

    roots.sort((a, b) => (a.y || 0) - (b.y || 0));
    roots.forEach((root) => traverse(root, 0));

    // Fallback for disjointed structures
    if (result.length < allNodes.length) {
      const visitedIds = new Set(result.map(r => r.node.id));
      allNodes.forEach(node => {
        if (!visitedIds.has(node.id)) {
          result.push({ node, depth: 0 });
        }
      });
    }

    return result;
  };

  const hierarchicalList = useMemo(() => getHierarchicalList(nodes), [nodes]);

  // Apply Search Query filter (local search overrides or supplements the global search)
  const activeSearchQuery = localQuery || searchQuery;
  const searchedList = useMemo(() => {
    return activeSearchQuery
      ? hierarchicalList.filter(
          (item) =>
            item.node.label.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
            (item.node.notes && item.node.notes.toLowerCase().includes(activeSearchQuery.toLowerCase()))
        )
      : hierarchicalList;
  }, [hierarchicalList, activeSearchQuery]);

  // Set of node IDs that should be visible in Focus Mode:
  const focusVisibleNodeIds = useMemo(() => {
    if (!isFocusModeActive) return new Set<string>();
    return getVisibleNodeIdsInFocusMode(nodes);
  }, [isFocusModeActive, nodes]);

  // Apply Status filters
  const filteredList = useMemo(() => {
    return searchedList.filter((item) => {
      const { node } = item;
      
      // 1. If hideCompleted is ON and node is Done, hide it
      if (hideCompleted && isCompletedStatus(node.status)) {
        return false;
      }
      
      // 2. Check if the status filter checkbox is unchecked for this status
      return isStatusActive(node.status);
    });
  }, [searchedList, hideCompleted, activeStatuses, isFocusModeActive, nodes]);

  // Apply Sorting Logic
  const sortedList = useMemo(() => {
    if (!currentSort.column) {
      return filteredList;
    }

    const list = [...filteredList];
    list.sort((itemA, itemB) => {
      const a = itemA.node;
      const b = itemB.node;

      if (currentSort.column === 'priority') {
        const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
        const valA = priorityOrder[a.priority as string] || 0;
        const valB = priorityOrder[b.priority as string] || 0;
        return valA - valB;
      }
      
      if (currentSort.column === 'dueDate') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        if (dateA === 0 && dateB === 0) return 0;
        if (dateA === 0) return 1; // Put unset dates at the end
        if (dateB === 0) return -1;
        return dateA - dateB;
      }
      
      if (currentSort.column === 'status') {
        const statusOrder: Record<string, number> = { 'TODO': 1, 'IN PROGRESS': 2, 'DONE': 3 };
        const valA = statusOrder[a.status.toUpperCase()] || 0;
        const valB = statusOrder[b.status.toUpperCase()] || 0;
        return valA - valB;
      }

      // Default/Title (label)
      return a.label.localeCompare(b.label);
    });

    if (currentSort.direction === 'desc') {
      list.reverse();
    }

    return list;
  }, [filteredList, currentSort]);

  // Calculations for stats based on the latest nodes array
  const totalTasks = nodes.length;
  const completedTasks = nodes.filter((n) => isCompletedStatus(n.status)).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Custom styling for priority level badges
  const getPriorityStyle = (p: Priority) => {
    switch (p) {
      case 'High':
        return { bg: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400' };
      case 'Medium':
        return { bg: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400' };
      case 'Low':
        return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400' };
      default:
        return { bg: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950/30 dark:border-slate-900/50 dark:text-slate-400' };
    }
  };

  // Custom status style helper
  const getStatusColor = (statusId: string) => {
    const matched = customStatuses.find((s) => s.id === statusId || s.name === statusId);
    if (matched) {
      return {
        bg: matched.colorBg,
        text: matched.colorText,
        border: matched.colorBorder
      };
    }
    // Fallbacks
    if (statusId.toLowerCase() === 'done') {
      return { bg: '#DCFCE7', text: '#166534', border: '#22C55E' };
    } else if (statusId.toLowerCase() === 'in progress') {
      return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
    } else if (statusId.toLowerCase() === 'blocked') {
      return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
    }
    return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
  };

  // Inline custom date picker element with showPicker support
  const DatePickerCell = ({ 
    nodeId, 
    value 
  }: { 
    nodeId: string; 
    value?: string; 
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleContainerClick = () => {
      try {
        inputRef.current?.showPicker();
      } catch {
        inputRef.current?.focus();
      }
    };

    const getFormattedDate = () => {
      if (!value) return 'Set Date';
      const date = new Date(value);
      if (isNaN(date.getTime())) return value;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    const isOverdue = value ? (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(value);
      due.setHours(0, 0, 0, 0);
      return due.getTime() < today.getTime() && !nodes.find(n => n.id === nodeId)?.status.toLowerCase().includes('done');
    })() : false;

    return (
      <div 
        onClick={handleContainerClick}
        className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all active:scale-98 select-none max-w-[155px] ${
          value 
            ? isOverdue
              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-850 dark:text-slate-300'
            : 'bg-transparent border-dashed border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600 dark:border-slate-800 dark:text-slate-500 dark:hover:bg-slate-900/40'
        }`}
      >
        <Calendar className={`w-3.5 h-3.5 ${value ? (isOverdue ? 'text-rose-500 animate-pulse' : 'text-slate-500') : 'text-slate-400'}`} />
        <span className="text-xs font-bold truncate">
          {getFormattedDate()}
        </span>
        <input 
          ref={inputRef}
          type="date"
          value={value || ''}
          onChange={(e) => onUpdateNode(nodeId, { dueDate: e.target.value || undefined })}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />
      </div>
    );
  };

  return (
    <div className={`h-full w-full flex flex-col overflow-hidden ${
      isFocusModeActive ? 'focus-mode-active' : ''
    } ${
      theme.isDark ? 'bg-[#0f1115] text-slate-100' : 'bg-slate-50 text-slate-950'
    }`}>
      {/* Table Analytics Summary Card (Updates instantly on change) */}
      <div className={`p-5 mx-6 mt-6 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition-all ${
        theme.isDark 
          ? 'bg-slate-900/50 border-slate-800' 
          : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
            <ListTodo className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Outline Workspace Progress
            </h2>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-black font-mono">
                {completedTasks}/{totalTasks}
              </span>
              <span className="text-xs font-bold text-slate-400">tasks completed</span>
            </div>
          </div>
        </div>

        {/* Live Computed Progress Bar */}
        <div className="flex-1 max-w-sm flex items-center gap-4">
          <div className="flex-grow bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <span className="text-sm font-black font-mono text-blue-500 shrink-0">
            {completionPercentage}%
          </span>
        </div>
      </div>

      {/* Grid Area with Filters, Header & Body */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className={`flex-1 rounded-2xl border flex flex-col overflow-hidden transition-all ${
          theme.isDark ? 'bg-[#15181e] border-slate-800' : 'bg-white border-slate-200 shadow-md'
        }`}>
          {/* Pro Controls Action Row */}
          <div className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-4 select-none shrink-0 ${
            theme.isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'
          }`}>
            {/* Local Command Center Search input */}
            <div className="relative w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search tasks or notes..."
                value={localQuery}
                onChange={(e) => {
                  setLocalQuery(e.target.value);
                  setSelectedNodeIds([]); // Clear selection when query changes
                }}
                className={`w-full pl-9.5 pr-4 py-2 rounded-xl text-xs font-bold border outline-none transition-all ${
                  theme.isDark 
                    ? 'bg-slate-900/60 border-slate-800 text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-900' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:shadow-xs'
                }`}
              />
            </div>

            {/* Live Filter Count Indicator */}
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold font-mono px-3 py-1 rounded-lg ${
                theme.isDark ? 'bg-slate-800/60 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}>
                Showing {sortedList.length} of {totalTasks} tasks
              </span>

              {hideCompleted && (
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md animate-pulse shrink-0">
                  Focus Mode Active
                </span>
              )}
            </div>
          </div>

          {/* Table Headings */}
          <div className={`grid grid-cols-[40px_2fr_1fr_1fr_0.9fr_1fr_80px] gap-4 px-6 py-4 border-b text-xs font-extrabold uppercase tracking-wider select-none shrink-0 items-center ${
            theme.isDark ? 'bg-slate-900/30 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
          }`}>
            {/* Header Select All Checkbox */}
            <div className="flex items-center justify-center">
              <input 
                type="checkbox"
                checked={sortedList.length > 0 && sortedList.every(item => selectedNodeIds.includes(item.node.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedNodeIds(sortedList.map(item => item.node.id));
                  } else {
                    setSelectedNodeIds([]);
                  }
                }}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5 cursor-pointer"
              />
            </div>

            {/* Task Header with Sort */}
            <button
              type="button"
              onClick={() => handleSort('title')}
              className="flex items-center gap-1.5 hover:text-blue-500 transition-colors font-extrabold cursor-pointer border-none bg-transparent uppercase tracking-wider text-left text-xs group"
            >
              <span>Task</span>
              {currentSort.column === 'title' ? (
                currentSort.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>

            {/* Parent Column Header */}
            <div className="text-left font-extrabold uppercase tracking-wider text-xs">
              Parent
            </div>

            {/* Workflow Status Header with Filter Dropdown & Sort */}
            <div className="relative flex items-center gap-1.5 group/status">
              <button 
                type="button"
                onClick={() => handleSort('status')}
                className="flex items-center gap-1.5 hover:text-blue-500 transition-colors font-extrabold cursor-pointer border-none bg-transparent uppercase tracking-wider text-left text-xs"
              >
                <span>Workflow Status</span>
                {currentSort.column === 'status' ? (
                  currentSort.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover/status:opacity-100 transition-opacity" />
                )}
              </button>

              <button 
                type="button"
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className={`p-1 rounded-md transition-all cursor-pointer border-none bg-transparent flex items-center justify-center ${
                  statusDropdownOpen 
                    ? 'bg-slate-200 dark:bg-slate-800 text-blue-500 shadow-xs' 
                    : 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Filter Statuses"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>

              {/* Status Dropdown Backdrop overlay to catch outside clicks */}
              {statusDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40 bg-transparent cursor-default" 
                  onClick={() => setStatusDropdownOpen(false)}
                />
              )}

              {/* Status Dropdown Menu */}
              <AnimatePresence>
                {statusDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute left-0 top-full mt-2 w-64 p-4 rounded-xl shadow-2xl border z-50 ${
                      theme.isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="text-[10px] font-extrabold uppercase text-slate-400 mb-3 tracking-widest select-none">
                      Filter Workflow Statuses
                    </div>
                    
                    {/* Checkboxes List */}
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto mb-4 pr-1">
                      {customStatuses.map((cs) => {
                        const isChecked = isStatusActive(cs.id);
                        return (
                          <label key={cs.id} className="flex items-center gap-2.5 cursor-pointer text-xs font-bold hover:text-blue-500 select-none py-0.5">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checkVal = e.target.checked;
                                setActiveStatuses(prev => {
                                  const next = { ...prev, [cs.id]: checkVal };
                                  // Automatically turn off hideCompleted if user manually turns DONE back on
                                  if (isCompletedStatus(cs.id) && checkVal) {
                                    setHideCompleted(false);
                                  }
                                  return next;
                                });
                              }}
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="flex items-center gap-1.5 truncate">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: cs.colorBg || '#3B82F6' }}
                              />
                              <span className="truncate">{cs.name}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Pro Toggle: Hide Completed Tasks */}
                    <div className={`border-t pt-3 mb-4.5 flex items-center justify-between ${
                      theme.isDark ? 'border-slate-800' : 'border-slate-100'
                    }`}>
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-slate-500">Hide Completed</span>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">Focus Mode Toggle</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={hideCompleted}
                          onChange={(e) => handleToggleHideCompleted(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className={`w-8 h-4.5 rounded-full relative transition-colors duration-200 focus:outline-none ${
                          theme.isDark 
                            ? 'bg-slate-800 peer-checked:bg-blue-500' 
                            : 'bg-slate-200 peer-checked:bg-blue-600'
                        } after:content-[''] after:absolute after:top-[2.25px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-transform after:duration-200 peer-checked:after:translate-x-3.5 shadow-xs`}></div>
                      </label>
                    </div>

                    {/* Close / Apply Button */}
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen(false)}
                      className="w-full py-2 rounded-lg text-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-xs active:scale-97 transition-all cursor-pointer border-none"
                    >
                      Apply Filters
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Priority Level Header with Sort */}
            <button
              type="button"
              onClick={() => handleSort('priority')}
              className="flex items-center gap-1.5 hover:text-blue-500 transition-colors font-extrabold cursor-pointer border-none bg-transparent uppercase tracking-wider text-left text-xs group"
            >
              <span>Priority Level</span>
              {currentSort.column === 'priority' ? (
                currentSort.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>

            {/* Target Due Date Header with Sort */}
            <button
              type="button"
              onClick={() => handleSort('dueDate')}
              className="flex items-center gap-1.5 hover:text-blue-500 transition-colors font-extrabold cursor-pointer border-none bg-transparent uppercase tracking-wider text-left text-xs group"
            >
              <span>Target Due Date</span>
              {currentSort.column === 'dueDate' ? (
                currentSort.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>

            <div className="text-center">Actions</div>
          </div>

          {/* Table Body */}
          <div className="flex-grow overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
            {sortedList.length === 0 ? (
              <div className="p-16 text-center text-slate-400 font-medium">
                No workspace nodes found matching your command center filters.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {sortedList.map(({ node, depth }) => {
                  const isEditingStatus = editingCell?.nodeId === node.id && editingCell?.field === 'status';
                  const isEditingPriority = editingCell?.nodeId === node.id && editingCell?.field === 'priority';
                  const isEditingAny = isEditingStatus || isEditingPriority;
                  const statusStyles = getStatusColor(node.status);
                  const priorityStyles = getPriorityStyle(node.priority);
                  const isSelected = selectedNodeIds.includes(node.id);
                  const parentNode = node.parentId ? nodes.find(n => n.id === node.parentId) : null;
                  const parentName = parentNode ? parentNode.label : '-';

                  const isHighPriority = node.priority === 'High' || String(node.priority || '').toUpperCase().trim() === 'HIGH';
                  const isFocusHigh = isFocusModeActive && isHighPriority;

                  const rowStyle = isFocusModeActive
                    ? {
                        opacity: isFocusHigh ? 1 : 0.25,
                        filter: isFocusHigh ? 'none' : 'blur(3px) grayscale(80%)',
                        border: isFocusHigh ? '2px solid #FF0000' : '1px solid transparent',
                        borderRadius: '12px',
                        margin: '6px 0',
                        boxShadow: isFocusHigh ? '0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.3)' : 'none',
                        zIndex: isFocusHigh ? 10 : 1,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      }
                    : undefined;

                  const isLocked = isNodeLocked(node, nodes);

                  return (
                    <motion.div 
                      key={node.id} 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.18 }}
                      layout="position"
                      style={rowStyle}
                      className={`grid grid-cols-[40px_2fr_1fr_1fr_0.9fr_1fr_80px] gap-4 px-6 py-3 items-center text-sm transition-all group ${
                        isEditingAny ? 'relative z-30 overflow-visible' : 'relative z-10 overflow-hidden'
                      } ${
                        isLocked ? 'node-locked opacity-70 grayscale-[50%]' : ''
                      } ${
                        isSelected 
                          ? theme.isDark 
                            ? 'bg-blue-500/5 hover:bg-blue-500/10' 
                            : 'bg-blue-50/40 hover:bg-blue-50/60'
                          : theme.isDark 
                            ? 'hover:bg-slate-900/20 text-slate-200' 
                            : 'hover:bg-slate-50/60 text-slate-800'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <div className="flex items-center justify-center">
                        <input 
                           type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNodeIds(prev => [...prev, node.id]);
                            } else {
                              setSelectedNodeIds(prev => prev.filter(id => id !== node.id));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </div>

                      {/* 1. Title Column */}
                      <div 
                        className="flex items-center min-w-0"
                        style={{ paddingLeft: `${Math.max(0, depth) * 20}px` }}
                      >
                        {depth > 0 && (
                          <span className="text-slate-400 mr-2 select-none font-mono font-black shrink-0">
                            └──
                          </span>
                        )}
                        
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-1.5 w-full">
                            {isFocusModeActive && (
                              <span className="text-sm select-none animate-bounce shrink-0" title="Urgent Focus Target">🎯</span>
                            )}
                            {isLocked && (
                              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Locked by incomplete dependency" />
                            )}
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
                              className={`w-full bg-transparent border-b border-transparent font-semibold truncate focus:border-blue-500 focus:outline-none transition-all py-0.5 rounded-sm px-1 ${
                                theme.isDark ? 'text-white' : 'text-slate-900'
                              }`}
                            />
                          </div>
                          {node.notes && (
                            <div className="text-[11px] text-slate-400 font-medium px-1 mt-0.5 truncate flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{node.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parent Column */}
                      <div 
                        className="text-xs font-semibold text-slate-500 dark:text-slate-400/80 truncate select-none pl-2" 
                        title={parentName !== '-' ? parentName : undefined}
                      >
                        {parentName}
                      </div>

                      {/* 2. Status Column */}
                      <div className="relative">
                        {isManagerNode(node, nodes) ? (
                          <div className="flex items-center gap-1.5">
                            <ManagerStatusPill status={getManagerStatus(node, nodes)} />
                            <button
                              type="button"
                              onClick={() => {
                                const isBlocked = node.manualBlocked === true || String(node.status).toUpperCase() === 'BLOCKED';
                                onUpdateNode(node.id, {
                                  manualBlocked: !isBlocked,
                                  status: !isBlocked ? 'Blocked' : 'In Progress'
                                });
                              }}
                              style={{
                                padding: '2px 6px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 9,
                                fontWeight: 700,
                                border: '1px solid ' + (node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? '#047857' : '#b91c1c'),
                                background: node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? '#d1fae5' : '#fee2e2',
                                color: node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? '#047857' : '#b91c1c'
                              }}
                            >
                              {node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        ) : isEditingStatus ? (
                          <select
                            value={node.status}
                            autoFocus
                            onBlur={() => setEditingCell(null)}
                            onChange={(e) => {
                              onUpdateNode(node.id, { status: e.target.value });
                              setEditingCell(null);
                            }}
                            className={`w-full py-1 px-2 rounded-lg text-xs font-bold border-2 shadow-xs outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer ${
                              theme.isDark ? 'bg-slate-850 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-300'
                            }`}
                          >
                            {customStatuses.map((status) => (
                              <option key={status.id} value={status.id}>
                                {status.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCell({ nodeId: node.id, field: 'status' })}
                            className="px-2.5 py-1 rounded-full text-xs font-bold border flex items-center justify-between gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95 text-left shrink-0 max-w-[150px]"
                            style={{
                              backgroundColor: statusStyles.bg,
                              borderColor: statusStyles.border,
                              color: statusStyles.text
                            }}
                            title="Click to edit status"
                          >
                            <span className="truncate">{node.status}</span>
                            <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                          </button>
                        )}
                      </div>

                      {/* 3. Priority Column */}
                      <div>
                        {isEditingPriority ? (
                          <select
                            value={node.priority}
                            autoFocus
                            onBlur={() => setEditingCell(null)}
                            onChange={(e) => {
                              onUpdateNode(node.id, { priority: e.target.value as Priority });
                              setEditingCell(null);
                            }}
                            className={`w-full py-1 px-2 rounded-lg text-xs font-bold border-2 shadow-xs outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer ${
                              theme.isDark ? 'bg-slate-850 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCell({ nodeId: node.id, field: 'priority' })}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center justify-between gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95 text-left shrink-0 max-w-[120px] ${priorityStyles.bg}`}
                            title="Click to edit priority"
                          >
                            <span className="truncate">{node.priority}</span>
                            <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                          </button>
                        )}
                      </div>

                      {/* 4. Due Date Column (Notion-style date badge calendar trigger) */}
                      <div>
                        <DatePickerCell nodeId={node.id} value={node.dueDate} />
                      </div>

                      {/* 5. Row Quick Actions */}
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAddChild(node.id)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                            theme.isDark
                              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-blue-400 text-slate-400'
                              : 'bg-white border-slate-200 hover:bg-slate-100 hover:text-blue-600 text-slate-500'
                          }`}
                          title="Add child task"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNode(node.id)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                            theme.isDark
                              ? 'bg-slate-800 border-slate-700 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900 text-slate-400'
                              : 'bg-white border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500'
                          }`}
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar for Bulk Selection Operations */}
      <AnimatePresence>
        {selectedNodeIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 30, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-8 left-1/2 bg-slate-900/95 dark:bg-slate-950/98 text-white py-3 px-6 rounded-2xl shadow-2xl border border-slate-800/80 flex items-center gap-5 z-50 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-xs font-black font-mono tracking-wider text-slate-300">
                {selectedNodeIds.length} {selectedNodeIds.length === 1 ? 'task' : 'tasks'} selected
              </span>
            </div>
            
            <div className="h-4 w-px bg-slate-800" />
            
            <div className="flex items-center gap-2">
              {/* Mark Done button */}
              <button
                type="button"
                onClick={() => {
                  if (onBatchUpdateNodes) {
                    onBatchUpdateNodes(selectedNodeIds.map(id => ({ id, updates: { status: 'Done' } })));
                  } else {
                    selectedNodeIds.forEach(id => onUpdateNode(id, { status: 'Done' }));
                  }
                  setSelectedNodeIds([]);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border-none"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Done</span>
              </button>

              {/* Mark Todo button */}
              <button
                type="button"
                onClick={() => {
                  if (onBatchUpdateNodes) {
                    onBatchUpdateNodes(selectedNodeIds.map(id => ({ id, updates: { status: 'TODO' } })));
                  } else {
                    selectedNodeIds.forEach(id => onUpdateNode(id, { status: 'TODO' }));
                  }
                  setSelectedNodeIds([]);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border-none"
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Mark Todo</span>
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete these ${selectedNodeIds.length} tasks?`)) {
                    selectedNodeIds.forEach(id => onDeleteNode(id));
                    setSelectedNodeIds([]);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800" />

            <button
              type="button"
              onClick={() => setSelectedNodeIds([])}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



