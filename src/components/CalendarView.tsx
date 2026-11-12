import React, { useState, useMemo } from 'react';
import { MindMapNode, ThemeConfig, CustomStatus } from '../types';
import { isNodeLocked } from '../utils/dependencies';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  ListTodo,
  X,
  AlertCircle,
  Lock
} from 'lucide-react';

interface CalendarViewProps {
  nodes: MindMapNode[];
  theme: ThemeConfig;
  customStatuses: CustomStatus[];
  searchQuery: string;
  selectedNodeId: string | null;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  isFocusModeActive: boolean;
  onAddNodeWithDate?: (date: string, customFields?: Partial<MindMapNode>) => void;
}

// Helper to parse dates into local components, preventing timezone-offset shifts
function parseToLocalComponents(d: any) {
  if (!d) return null;
  if (d instanceof Date) {
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate()
    };
  }
  
  const dStr = String(d).trim();
  // If it's a YYYY-MM-DD string, parse it directly to avoid timezone shift
  const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10) - 1,
      day: parseInt(match[3], 10)
    };
  }
  
  // Otherwise, fallback to native Date parsing
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return null;
  
  // If it contains 'T', it might be ISO. Let's check if we should extract just the date part.
  if (dStr.includes('T')) {
    const datePart = dStr.split('T')[0];
    const subMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (subMatch) {
      return {
        year: parseInt(subMatch[1], 10),
        month: parseInt(subMatch[2], 10) - 1,
        day: parseInt(subMatch[3], 10)
      };
    }
  }

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
    day: parsed.getDate()
  };
}

function isSameDay(date1: any, date2: any) {
  const c1 = parseToLocalComponents(date1);
  const c2 = parseToLocalComponents(date2);
  if (!c1 || !c2) return false;
  return c1.year === c2.year && c1.month === c2.month && c1.day === c2.day;
}

function isPastDay(date: any) {
  const c = parseToLocalComponents(date);
  if (!c) return false;
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  if (c.year !== todayYear) {
    return c.year < todayYear;
  }
  if (c.month !== todayMonth) {
    return c.month < todayMonth;
  }
  return c.day < todayDay;
}

const MONTH_COLORS: Record<number, string> = {
  0: '#7DD3FC',  // January (Sky Blue)
  1: '#6EE7B7',  // February (Emerald Green)
  2: '#FCD34D',  // March (Amber Yellow)
  3: '#FCA5A5',  // April (Red)
  4: '#C4B5FD',  // May (Violet)
  5: '#5EEAD4',  // June (Teal)
  6: '#FDBA74',  // July (Orange)
  7: '#93C5FD',  // August (Blue)
  8: '#F9A8D4',  // September (Pink)
  9: '#6EE7B7',  // October (Mint)
  10: '#FDE047', // November (Gold)
  11: '#A78BFA', // December (Purple)
};

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CalendarView({
  nodes,
  theme,
  customStatuses,
  searchQuery,
  selectedNodeId,
  onUpdateNode,
  onDeleteNode,
  onSelectNode,
  isFocusModeActive,
  onAddNodeWithDate,
}: CalendarViewProps) {
  // 1. DEBUG THE DATA:
  console.log("=== CALENDAR DEBUG ===");
  console.log("Total nodes:", nodes.length);
  console.log("Nodes with dates:", nodes.filter(n => n.dueDate).length);
  nodes.forEach(node => {
    console.log(`Node: ${node.label}, Due: ${node.dueDate}, Status: ${node.status}`);
  });

  // Initialize current active month
  const initialDate = useMemo(() => {
    const scheduledNodes = nodes.filter(n => n.dueDate);
    if (scheduledNodes.length > 0) {
      for (const n of scheduledNodes) {
        if (n.dueDate && !isNaN(Date.parse(n.dueDate))) {
          return new Date(n.dueDate);
        }
      }
    }
    return new Date();
  }, [nodes]);

  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [isHoveredUnscheduled, setIsHoveredUnscheduled] = useState<boolean>(false);

  // Quick-create task modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedDateForNewTask, setSelectedDateForNewTask] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('Todo');
  const [newTaskNotes, setNewTaskNotes] = useState<string>('');
  const [newTaskParentId, setNewTaskParentId] = useState<string>('');
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');

  // Filter parent nodes based on search query
  const filteredParentNodes = useMemo(() => {
    if (!parentSearchQuery) return nodes;
    return nodes.filter(node =>
      node.label.toLowerCase().includes(parentSearchQuery.toLowerCase())
    );
  }, [nodes, parentSearchQuery]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Check if a node is overdue
  const isOverdueNode = (node: MindMapNode) => {
    if (!node.dueDate) return false;
    const isCompleted = String(node.status || '').toUpperCase().trim() === 'DONE';
    if (isCompleted) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueComponents = parseToLocalComponents(node.dueDate);
    if (!dueComponents) return false;

    const due = new Date(dueComponents.year, dueComponents.month, dueComponents.day);
    return due.getTime() < today.getTime();
  };

  // Get status layout styling
  const getStatusStyle = (statusId: string) => {
    const matched = customStatuses.find((s) => s.id === statusId || s.name === statusId);
    if (matched) {
      return {
        bg: matched.colorBg || '#F1F5F9',
        text: matched.colorText || '#1E293B',
        border: matched.colorBorder || '#E2E8F0'
      };
    }
    // Fallbacks
    const sLower = statusId.toLowerCase().trim();
    if (sLower === 'done' || sLower === 'completed') {
      return { bg: '#DCFCE7', text: '#166534', border: '#22C55E' };
    } else if (sLower === 'in progress' || sLower === 'active') {
      return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
    } else if (sLower === 'blocked' || sLower === 'stuck') {
      return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
    }
    return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
  };

  // Resolve Priority border styling
  const getPriorityBorderClass = (priority: string) => {
    const p = String(priority).toUpperCase().trim();
    if (p === 'HIGH') return 'border-red-500 border-2';
    if (p === 'MEDIUM') return 'border-yellow-500 border-2';
    return 'border-blue-500 border-2';
  };

  const getPriorityDotColor = (priority: string) => {
    const p = String(priority).toUpperCase().trim();
    if (p === 'HIGH') return '#EF4444'; // Red
    if (p === 'MEDIUM') return '#EAB308'; // Yellow
    return '#3B82F6'; // Blue
  };

  // Construct standard calendar grid cells
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; isPrevMonth: boolean; isNextMonth: boolean; dateString: string }[] = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const d = new Date(year, month - 1, day);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({ date: d, isCurrentMonth: false, isPrevMonth: true, isNextMonth: false, dateString });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({ date: d, isCurrentMonth: true, isPrevMonth: false, isNextMonth: false, dateString });
    }

    // Trailing days from next month
    const totalCells = cells.length > 35 ? 42 : 35;
    const trailingDays = totalCells - cells.length;
    for (let i = 1; i <= trailingDays; i++) {
      const d = new Date(year, month + 1, i);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({ date: d, isCurrentMonth: false, isPrevMonth: false, isNextMonth: true, dateString });
    }

    return cells;
  }, [year, month]);

  // Helper to retrieve tasks for a given cell date
  const getTasksForDate = (date: Date) => {
    return nodes.filter(node => {
      if (!node.dueDate) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          node.label.toLowerCase().includes(query) ||
          (node.notes || '').toLowerCase().includes(query) ||
          node.status.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      return isSameDay(node.dueDate, date);
    });
  };

  // Retrieve unscheduled tasks (no dueDate)
  const unscheduledTasks = useMemo(() => {
    return nodes.filter(node => {
      if (node.dueDate) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          node.label.toLowerCase().includes(query) ||
          (node.notes || '').toLowerCase().includes(query) ||
          node.status.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [nodes, searchQuery]);

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setHoveredDate(null);
    setIsHoveredUnscheduled(false);
  };

  const handleDragOverCell = (e: React.DragEvent, dateString: string) => {
    e.preventDefault();
    if (hoveredDate !== dateString) {
      setHoveredDate(dateString);
    }
  };

  const handleDropOnCell = (e: React.DragEvent, dateString: string) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('text/plain') || draggedNodeId;
    if (nodeId) {
      onUpdateNode(nodeId, { dueDate: dateString });
    }
    setHoveredDate(null);
    setDraggedNodeId(null);
  };

  const handleDragOverUnscheduled = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isHoveredUnscheduled) {
      setIsHoveredUnscheduled(true);
    }
  };

  const handleDropOnUnscheduled = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('text/plain') || draggedNodeId;
    if (nodeId) {
      onUpdateNode(nodeId, { dueDate: undefined });
    }
    setIsHoveredUnscheduled(false);
    setDraggedNodeId(null);
  };

  // Create Task trigger
  const handleEmptyCellClick = (dateString: string) => {
    setSelectedDateForNewTask(dateString);
    setNewTaskTitle('');
    setNewTaskPriority('Medium');
    setNewTaskStatus(customStatuses[0]?.name || 'Todo');
    setNewTaskNotes('');
    setNewTaskParentId('');
    setParentSearchQuery('');
    setIsCreateModalOpen(true);
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddNodeWithDate) {
      onAddNodeWithDate(selectedDateForNewTask, {
        label: newTaskTitle.trim() || 'New Task',
        priority: newTaskPriority,
        status: newTaskStatus,
        notes: newTaskNotes.trim(),
        parentId: newTaskParentId ? newTaskParentId : null
      });
    }
    setIsCreateModalOpen(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`w-full h-full flex flex-row overflow-hidden select-none ${
      theme.isDark ? 'bg-[#0f1115] text-slate-100' : 'bg-slate-50 text-slate-900'
    } ${isFocusModeActive ? 'focus-mode-active' : ''}`}>
      
      {/* LEFT AREA: Main Calendar Grid */}
      <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
        
        {/* Calendar Nav & Month Switch Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${theme.isDark ? 'bg-slate-900/80 border border-slate-800' : 'bg-white border border-slate-200'} shadow-xs`}>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                {monthNames[month]} {year}
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Drag tasks to schedule/reschedule. Click empty cells to quick-add.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleToday}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                theme.isDark
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Today
            </button>
            <div className={`flex items-center rounded-lg border p-0.5 ${
              theme.isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous Month"
                className={`p-1.5 rounded-md transition-all border-none cursor-pointer hover:bg-slate-500/10 ${
                  theme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="h-4 w-[1px] bg-slate-300/30 mx-1"></div>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next Month"
                className={`p-1.5 rounded-md transition-all border-none cursor-pointer hover:bg-slate-500/10 ${
                  theme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Monthly Matrix */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Day Headers (Sun - Sat) */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5 shrink-0">
            {daysOfWeek.map(day => (
              <div
                key={day}
                className={`text-center text-[10px] font-black uppercase tracking-wider py-1 rounded-md ${
                  theme.isDark ? 'text-slate-500 bg-slate-900/30' : 'text-slate-400 bg-slate-100/50'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Cells (Adaptive 7-column CSS Grid) */}
          <div className="flex-1 grid grid-cols-7 gap-1.5 min-h-0 overflow-y-auto pr-1">
            {calendarCells.map((cell, idx) => {
              const { date, isCurrentMonth, isPrevMonth, isNextMonth, dateString } = cell;
              const cellTasks = getTasksForDate(date);
              const isToday = new Date().toDateString() === date.toDateString();
              const isPast = isPastDay(date);
              const isDragOver = hoveredDate === dateString && !isPast;

              const monthClass = isCurrentMonth
                ? 'current-month'
                : isPrevMonth
                  ? 'previous-month'
                  : 'next-month';

              const monthIndex = date.getMonth();
              const baseColor = MONTH_COLORS[monthIndex] || '#ffffff';

              // Clean, very light background for readability as requested by user
              let cellBgColor = '#FFFFFF';
              if (theme.isDark) {
                cellBgColor = isCurrentMonth ? '#0b1329' : '#05070f';
              } else {
                cellBgColor = isCurrentMonth ? '#FFFFFF' : '#F8FAFC';
              }

              if (isDragOver) {
                cellBgColor = theme.isDark ? 'rgba(30, 58, 138, 0.45)' : 'rgba(219, 234, 254, 0.85)';
              }

              // Top border color: vibrant for current month, faded (0.45) for other months in the grid
              const topBorderColor = isCurrentMonth ? baseColor : hexToRgba(baseColor, 0.45);

              // Circle background color for the day number
              let circleBgColor = baseColor;
              if (isToday) {
                circleBgColor = '#2563eb';
              } else if (!isCurrentMonth || isPast) {
                circleBgColor = hexToRgba(baseColor, 0.5);
              }

              const interactionClasses = isPast
                ? 'past-date cursor-not-allowed ' + (
                    theme.isDark
                      ? 'border-slate-900/40 text-slate-500'
                      : 'border-slate-200/55 text-[#9CA3AF]'
                  )
                : `cursor-pointer ${monthClass} ` + (
                    isCurrentMonth
                      ? theme.isDark
                        ? 'border-slate-800/80 hover:border-slate-700/80 text-slate-100'
                        : 'border-slate-200 hover:border-slate-300 text-slate-900'
                      : isPrevMonth
                        ? theme.isDark
                          ? 'border-slate-900/40 hover:border-slate-800/60 text-slate-450 opacity-60'
                          : 'border-slate-200/60 hover:border-slate-300 text-slate-500 opacity-70'
                        : theme.isDark // Next month
                          ? 'border-sky-900/20 hover:border-sky-800/50 text-sky-400/80 opacity-60'
                          : 'border-blue-100/80 hover:border-blue-200 text-sky-700 opacity-75'
                  );

              return (
                <div
                  key={`${dateString}-${idx}`}
                  onDragOver={(e) => {
                    if (!isPast) {
                      handleDragOverCell(e, dateString);
                    }
                  }}
                  onDrop={(e) => {
                    if (!isPast) {
                      handleDropOnCell(e, dateString);
                    }
                  }}
                  onClick={() => {
                    if (!isPast) {
                      handleEmptyCellClick(dateString);
                    }
                  }}
                  className={`flex flex-col min-h-[120px] p-1.5 rounded-xl border transition-all relative overflow-hidden group/cell ${interactionClasses} ${
                    isToday
                      ? 'ring-2 ring-blue-500/50 border-blue-500/70 ring-offset-2 ring-offset-slate-950'
                      : ''
                  } ${
                    isDragOver
                      ? 'border-blue-500 shadow-md shadow-blue-500/10'
                      : ''
                  }`}
                  style={{
                    backgroundColor: cellBgColor,
                    borderTop: `4px solid ${topBorderColor}`
                  }}
                >
                  {/* Day Header (Day number + Add trigger / Lock) */}
                  <div className="flex items-center justify-between mb-1.5 shrink-0 select-none">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white select-none shadow-xs"
                      style={{
                        backgroundColor: circleBgColor,
                        filter: isPast && !isToday ? 'grayscale(35%)' : 'none'
                      }}
                    >
                      {date.getDate()}
                    </span>
                    
                    {isPast ? (
                      <span className="text-slate-400/50 dark:text-slate-650" title="This day is in the past (locked)">
                        <Lock className="w-3 h-3" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmptyCellClick(dateString);
                        }}
                        title={`Add task for ${dateString}`}
                        className="opacity-0 group-hover/cell:opacity-100 p-0.5 rounded-md hover:bg-slate-500/20 text-slate-400 hover:text-blue-500 transition-all border-none cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Vertically stacked task blocks inside cells */}
                  <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                    {cellTasks.map(node => {
                      const isHighPriority = node.priority === 'High' || String(node.priority || '').toUpperCase().trim() === 'HIGH';
                      const isFocusHigh = isFocusModeActive && isHighPriority;
                      const isSelected = selectedNodeId === node.id;
                      const statusStyle = getStatusStyle(node.status);
                      const priorityBorderClass = getPriorityBorderClass(node.priority);
                      const pColor = getPriorityDotColor(node.priority);
                      const overdue = isOverdueNode(node);

                      const isLocked = isNodeLocked(node, nodes);

                      // Priority Border with custom backgrounds & optional focus blur styles
                      let customStyle: React.CSSProperties = {
                        backgroundColor: overdue 
                          ? theme.isDark ? '#4c0519' : '#FEE2E2' // Red background for overdue tasks
                          : statusStyle.bg,
                        color: overdue 
                          ? theme.isDark ? '#FDA4AF' : '#991B1B' 
                          : statusStyle.text,
                        borderColor: overdue 
                          ? '#F43F5E' 
                          : isSelected 
                            ? theme.accentColor 
                            : statusStyle.border,
                      };

                      if (isFocusModeActive) {
                        customStyle = {
                          ...customStyle,
                          opacity: isFocusHigh ? 1 : 0.25,
                          filter: isFocusHigh ? 'none' : 'blur(3px) grayscale(80%)',
                          border: isFocusHigh ? '2px solid #FF0000' : '1px solid transparent',
                          boxShadow: isFocusHigh ? '0 0 15px rgba(255, 0, 0, 0.6)' : 'none',
                          zIndex: isFocusHigh ? 10 : 1,
                          background: isFocusHigh ? '#FF0000' : customStyle.backgroundColor,
                          color: isFocusHigh ? '#FFFFFF' : customStyle.color,
                        };
                      }

                      return (
                        <motion.div
                          key={node.id}
                          layoutId={`task-${node.id}`}
                          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, node.id)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(node.id);
                          }}
                          style={customStyle}
                          className={`text-[10px] font-bold p-1 rounded-lg border flex items-center gap-1.5 transition-shadow cursor-grab active:cursor-grabbing hover:scale-[1.02] shadow-3xs shrink-0 select-none ${priorityBorderClass} ${
                            isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900 font-extrabold' : ''
                          } ${overdue ? 'animate-pulse' : ''} ${isLocked ? 'node-locked opacity-70 grayscale-[50%]' : ''}`}
                          title={`${node.label} ${overdue ? '(OVERDUE)' : ''} ${isLocked ? '(LOCKED)' : ''}`}
                        >
                          {/* Colored priority indicator dot */}
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: isFocusHigh ? '#FFFFFF' : pColor }}
                          />

                          {isLocked && (
                            <Lock className="w-3 h-3 text-amber-500 shrink-0" title="Locked by incomplete dependency" />
                          )}
                          
                          {/* Task label */}
                          <span className="flex-1 truncate min-w-0 leading-tight">
                            {node.label || 'Untitled'}
                          </span>

                          {overdue && (
                            <span className="text-[9px] text-red-500 shrink-0" title="Overdue! ⚠️">⚠️</span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Drag and Drop visual helper overlay */}
                  {isDragOver && (
                    <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none border-2 border-dashed border-blue-500 rounded-xl z-20">
                      <span className="text-[10px] font-extrabold text-blue-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md shadow-xs animate-pulse">
                        Drop Here
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: Unscheduled Tasks panel and drag clearing target */}
      <div
        onDragOver={handleDragOverUnscheduled}
        onDrop={handleDropOnUnscheduled}
        className={`w-[28%] min-w-[250px] max-w-[360px] shrink-0 border-l flex flex-col p-4 md:p-6 transition-all duration-300 ${
          theme.isDark
            ? 'bg-slate-950/80 border-slate-800'
            : 'bg-white border-slate-200'
        } ${
          isHoveredUnscheduled
            ? theme.isDark
              ? 'bg-blue-950/40 border-dashed border-2 border-blue-500'
              : 'bg-blue-50 border-dashed border-2 border-blue-500'
            : ''
        }`}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4.5 h-4.5 text-slate-400 animate-pulse" />
            <h3 className="text-sm font-extrabold tracking-tight">Unscheduled Tasks</h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
            theme.isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-600'
          }`}>
            {unscheduledTasks.length} left
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-normal mb-4 font-medium">
          Drag these tasks onto any day cell in the calendar to schedule them, or drag scheduled tasks back here to unschedule them.
        </p>

        {/* Unscheduled list container */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-[180px] no-scrollbar">
          {unscheduledTasks.length === 0 ? (
            <div className={`flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed flex-1 ${
              theme.isDark ? 'border-slate-850 bg-slate-900/10' : 'border-slate-200 bg-slate-50/50'
            }`}>
              <Clock className="w-6 h-6 text-slate-500 mb-2" />
              <p className="text-[10px] text-slate-500 font-bold">No unscheduled tasks</p>
              <p className="text-[9px] text-slate-400 mt-1">All tasks have been scheduled.</p>
            </div>
          ) : (
            unscheduledTasks.map(node => {
              const isHighPriority = node.priority === 'High' || String(node.priority || '').toUpperCase().trim() === 'HIGH';
              const isFocusHigh = isFocusModeActive && isHighPriority;
              const isSelected = selectedNodeId === node.id;
              const statusStyle = getStatusStyle(node.status);
              const priorityBorderClass = getPriorityBorderClass(node.priority);
              const pColor = getPriorityDotColor(node.priority);

              let customStyle: React.CSSProperties = {
                backgroundColor: statusStyle.bg,
                color: statusStyle.text,
                borderColor: isSelected ? theme.accentColor : statusStyle.border,
              };

              if (isFocusModeActive) {
                customStyle = {
                  ...customStyle,
                  opacity: isFocusHigh ? 1 : 0.25,
                  filter: isFocusHigh ? 'none' : 'blur(3px) grayscale(80%)',
                  border: isFocusHigh ? '2px solid #FF0000' : '1px solid transparent',
                  boxShadow: isFocusHigh ? '0 0 15px rgba(255, 0, 0, 0.6)' : 'none',
                  zIndex: isFocusHigh ? 10 : 1,
                  background: isFocusHigh ? '#FF0000' : statusStyle.bg,
                  color: isFocusHigh ? '#FFFFFF' : statusStyle.text,
                };
              }

              return (
                <motion.div
                  key={node.id}
                  layoutId={`task-${node.id}`}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectNode(node.id)}
                  style={customStyle}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-shadow hover:scale-[1.01] shadow-3xs flex items-start gap-2.5 cursor-grab active:cursor-grabbing select-none shrink-0 ${priorityBorderClass} ${
                    isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950 font-extrabold' : ''
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: isFocusHigh ? '#FFFFFF' : pColor }}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold truncate leading-tight">
                      {node.label || 'Untitled Task'}
                    </p>
                    {node.notes && (
                      <p className={`text-[10px] font-medium truncate mt-0.5 opacity-70 ${
                        isFocusHigh ? 'text-white' : 'text-slate-500'
                      }`}>
                        {node.notes}
                      </p>
                    )}
                    <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1.5 ${
                      isFocusHigh ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/5 opacity-75'
                    }`}>
                      {node.status}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* QUICK TASK CREATION MODAL OVERLAY */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl transition-all scale-100 ${
              theme.isDark
                ? 'bg-slate-900 border-slate-800 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-300/20 mb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black tracking-tight">
                  New Task for {selectedDateForNewTask}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-500/15 text-slate-400 hover:text-slate-200 transition-all cursor-pointer border-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              {/* Label */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Marketing Blueprint"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-sm font-bold border transition-all outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme.isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                  autoFocus
                />
              </div>

              {/* Priority & Status Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl text-sm font-bold border outline-none transition-all focus:ring-2 focus:ring-blue-500 ${
                      theme.isDark
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="High">🔴 High Priority</option>
                    <option value="Medium">🟡 Medium Priority</option>
                    <option value="Low">🔵 Low Priority</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-sm font-bold border outline-none transition-all focus:ring-2 focus:ring-blue-500 ${
                      theme.isDark
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {customStatuses.length > 0 ? (
                      customStatuses.map(status => (
                        <option key={status.id} value={status.name}>
                          {status.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Todo">Todo</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Parent Node */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Parent Node
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative w-1/3 min-w-[120px]">
                    <input
                      type="text"
                      placeholder="🔍 Filter..."
                      value={parentSearchQuery}
                      onChange={(e) => setParentSearchQuery(e.target.value)}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-bold border transition-all outline-none focus:ring-2 focus:ring-blue-500 ${
                        theme.isDark
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                    {parentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setParentSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 bg-transparent border-none p-0 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <select
                    value={newTaskParentId}
                    onChange={(e) => setNewTaskParentId(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border outline-none transition-all focus:ring-2 focus:ring-blue-500 ${
                      theme.isDark
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="">None (Root Node)</option>
                    {filteredParentNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  Notes / Description
                </label>
                <textarea
                  placeholder="Task context, instructions, links..."
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-xl text-sm font-bold border transition-all outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                    theme.isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-300/20">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                    theme.isDark
                      ? 'bg-transparent border-slate-800 hover:bg-slate-800 text-slate-300'
                      : 'bg-transparent border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black text-white bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] hover:shadow-lg hover:shadow-blue-500/25 rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
