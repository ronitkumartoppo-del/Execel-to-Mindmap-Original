import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MindMapNode, ThemeConfig, TemplateConfig, Priority, Status, CustomStatus } from './types';
import { PREMIUM_THEMES } from './themes';
import { TEMPLATE_LIST, getTemplateNodes, INDUSTRIES } from './templates';
import { calculateTreeLayout } from './utils/layout';
import { isStatusDone, evaluateUpdatedLocks, evaluateParentStatuses } from './utils/lockLogic';
import { isDone, lockProgress, isManagerNode, getManagerStatus, ManagerStatusPill, isNodeDone } from './utils/lockHelpers';
import { isNodeLocked } from './utils/dependencies';
import MindMapCanvas from './components/MindMapCanvas';
import DependencyModal from './components/DependencyModal';
import DependencyLockModal from './components/DependencyLockModal';
import TableView from './components/TableView';
import BoardView from './components/BoardView';
import CalendarView from './components/CalendarView';
import VibeView from './components/VibeView';
import {
  Download,
  Image as ImageIcon,
  RotateCcw,
  BookOpen,
  Palette,
  Layers,
  Sparkles,
  Info,
  Maximize,
  Grid,
  X,
  Plus,
  Trash2,
  Check,
  Settings,
  Eye,
  EyeOff,
  Search,
  Undo,
  Redo,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Upload,
  FileText,
  Save,
  HelpCircle,
  Calendar,
  AlertTriangle,
  Link,
  Kanban,
  Target,
  Zap
} from 'lucide-react';
import { getVisibleNodeIdsInFocusMode, isNodeInFocusCriteria } from './utils/focus';

// True Undo/Redo State History Engine global arrays
let undoStack: MindMapNode[][] = [];
let redoStack: MindMapNode[][] = [];

const STANDARD_STATUSES: CustomStatus[] = [
  { id: 'Stand By', name: 'Stand By', colorBg: '#F8FAFC', colorText: '#64748B', colorBorder: '#E2E8F0' },
  { id: 'Todo', name: 'Todo', colorBg: '#F1F5F9', colorText: '#475569', colorBorder: '#CBD5E1' },
  { id: 'In Progress', name: 'In Progress', colorBg: '#DBEAFE', colorText: '#1E40AF', colorBorder: '#2563EB' },
  { id: 'Done', name: 'Done', colorBg: '#DCFCE7', colorText: '#166534', colorBorder: '#166534' },
  { id: 'Blocked', name: 'Blocked', colorBg: '#FEE2E2', colorText: '#991B1B', colorBorder: '#EF4444' }
];

const VALID_STATUS_NAMES = new Set(STANDARD_STATUSES.map(s => s.name.toLowerCase()));

const normalizeNodeStatuses = (nodeList: MindMapNode[]): MindMapNode[] => {
  return nodeList.map(n => {
    if (!n.status || !VALID_STATUS_NAMES.has(String(n.status).toLowerCase())) {
      return { ...n, status: 'Todo' };
    }
    const matched = STANDARD_STATUSES.find(s => s.name.toLowerCase() === String(n.status).toLowerCase());
    return matched ? { ...n, status: matched.name } : n;
  });
};

export default function App() {
  // --- 1. State Initialization ---
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'mindmap' | 'table' | 'board' | 'calendar' | 'vibe'>('mindmap');
  const [isFocusModeActive, setIsFocusModeActive] = useState<boolean>(false);
  const [dependencyModalNodeId, setDependencyModalNodeId] = useState<string | null>(null);
  const [draftDependencies, setDraftDependencies] = useState<string[]>([]);
  const [lockModalNodeId, setLockModalNodeId] = useState<string | null>(null);

  const handleOpenDependencySelection = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDependencyModalNodeId(nodeId);
      const raw = Array.from(new Set([...(node.lockDependencies || []), ...(node.blockedBy || [])].map(String)));
      setDraftDependencies(raw);
      setActiveView('mindmap');
    }
  };

  const handleToggleDependencyOnCanvas = (nodeId: string) => {
    setDraftDependencies(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      } else {
        return [...prev, nodeId];
      }
    });
  };
  
  interface UnlockedToast {
    id: string;
    title: string;
  }
  const [unlockedToasts, setUnlockedToasts] = useState<UnlockedToast[]>([]);

  // Overdue Toast Notifications State
  interface OverdueToast {
    id: string;
    nodeId: string;
    nodeLabel: string;
    type: 'urgent';
  }
  const [overdueToasts, setOverdueToasts] = useState<OverdueToast[]>([]);
  const triggeredOverdueNodes = useRef<Set<string>>(new Set());

  // Custom sandbox-safe states for dialogs and warnings
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);

  const handleFocusNode = (id: string) => {
    setSelectedNodeId(id);
    setActiveView('mindmap');
    setHighlightNodeId(id);
    setTimeout(() => {
      setHighlightNodeId(null);
    }, 1300);
  };
  
  // Custom Search Engine state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theme state
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(PREMIUM_THEMES[0]);

  // Ghost Peek Mode state
  const [isGhostModeActive, setIsGhostModeActive] = useState<boolean>(false);

  // Dependencies State Slice - REMOVED
  
  // Active industry and template selector states
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Tech & AI');
  const [activeTemplateId, setActiveTemplateId] = useState<string>('llm-agentic-pipeline');

  // Active layout geometry state
  const [activeLayout, setActiveLayout] = useState<string>(() => {
    return localStorage.getItem('mindmap_active_layout_v2') || 'right-sided';
  });

  // Standard Statuses List
  const [customStatuses] = useState<CustomStatus[]>(STANDARD_STATUSES);

  // Load initial state (from localStorage or default template)
  useEffect(() => {
    const savedNodes = localStorage.getItem('mindmap_nodes_v2');
    const savedThemeId = localStorage.getItem('mindmap_theme_id_v2');
    const savedTemplateId = localStorage.getItem('mindmap_template_id_v2');

    // Always reset stored statuses to standard
    localStorage.setItem('mindmap_statuses_v2', JSON.stringify(STANDARD_STATUSES));

    // 1. Setup Theme
    if (savedThemeId) {
      const matched = PREMIUM_THEMES.find((t) => t.id === savedThemeId);
      if (matched) setActiveTheme(matched);
    }

    // 2. Setup Nodes
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = normalizeNodeStatuses(parsed);
          const evaluated = evaluateParentStatuses(normalized, STANDARD_STATUSES);
          setNodes(calculateTreeLayout(evaluated, activeLayout));
          if (savedTemplateId) {
            setActiveTemplateId(savedTemplateId);
            const templateMeta = TEMPLATE_LIST.find(t => t.id === savedTemplateId);
            if (templateMeta) setSelectedIndustry(templateMeta.industry);
          }
          return;
        }
      } catch (e) {
        console.error('Failed to restore cached mindmap nodes:', e);
      }
    }

    // Default Fallback
    const defaultNodes = getTemplateNodes('llm-agentic-pipeline');
    const normalizedDefault = normalizeNodeStatuses(defaultNodes);
    const evaluatedDefault = evaluateParentStatuses(normalizedDefault, STANDARD_STATUSES);
    setNodes(calculateTreeLayout(evaluatedDefault, activeLayout));
  }, []);

  // Custom Search Keydown Interceptor (Ctrl+F / Cmd+F / Escape)
  useEffect(() => {
    const handleSearchKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('custom-canvas-search-input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === 'Escape') {
        const searchInput = document.getElementById('custom-canvas-search-input') as HTMLInputElement | null;
        if (searchInput) {
          if (document.activeElement === searchInput) {
            searchInput.blur();
          }
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleSearchKeyDown);
    return () => {
      window.removeEventListener('keydown', handleSearchKeyDown);
    };
  }, []);

  // Synchronized state mirroring lengths of global stacks for rendering triggers
  const [undoLength, setUndoLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  // Auto-Save indicator state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSaveIndicator = () => {
    setAutoSaveStatus('saving');
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      setAutoSaveStatus('saved');
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 600);
  };

  // Refs for tracking latest states inside the keydown listener
  const nodesRef = useRef<MindMapNode[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Sync state to localStorage on modification
  const saveState = (updatedNodes: MindMapNode[], bypassUndo = false) => {
    if (!bypassUndo) {
      // Save deep clone of current nodes to global undo stacks BEFORE applying change
      undoStack.push(JSON.parse(JSON.stringify(nodesRef.current)));
      redoStack = []; // Clear redo stack on new action
      setUndoLength(undoStack.length);
      setRedoLength(0);
    }
    setNodes(updatedNodes);
    localStorage.setItem('mindmap_nodes_v2', JSON.stringify(updatedNodes));
    triggerAutoSaveIndicator();
  };

  // True Time-Travel State Undo Handler
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousNodes = undoStack.pop()!;

    redoStack.push(JSON.parse(JSON.stringify(nodesRef.current)));

    setUndoLength(undoStack.length);
    setRedoLength(redoStack.length);

    setNodes(previousNodes);
    localStorage.setItem('mindmap_nodes_v2', JSON.stringify(previousNodes));

    triggerAutoSaveIndicator();
  };

  // True Time-Travel State Redo Handler
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextNodes = redoStack.pop()!;

    undoStack.push(JSON.parse(JSON.stringify(nodesRef.current)));

    setUndoLength(undoStack.length);
    setRedoLength(redoStack.length);

    setNodes(nextNodes);
    localStorage.setItem('mindmap_nodes_v2', JSON.stringify(nextNodes));

    triggerAutoSaveIndicator();
  };

  // Keydown listener for global hotkeys (Ctrl+Z / Cmd+Z and Ctrl+Y / Cmd+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleUndoRedoKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable === true
      );

      // If user is actively typing in inputs, let standard browser behavior take over
      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleUndoRedoKeyDown);
    return () => {
      window.removeEventListener('keydown', handleUndoRedoKeyDown);
    };
  }, []);

  // --- Keyboard Shortcut: 'F' key toggles Focus Mode ---
  useEffect(() => {
    const handleFocusModeShortcut = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable === true
      );

      if (isTyping) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFocusModeActive(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleFocusModeShortcut);
    return () => {
      window.removeEventListener('keydown', handleFocusModeShortcut);
    };
  }, []);

  // Dynamic button event listeners to wire up explicit IDs for "+ Sibling" and "+ Child"
  useEffect(() => {
    const timer = setTimeout(() => {
      const btnSibling = document.getElementById('btn-add-sibling');
      const btnChild = document.getElementById('btn-add-child');

      if (btnSibling) {
        btnSibling.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (selectedNodeId) {
            handleAddSibling(selectedNodeId);
          }
        };
      }
      if (btnChild) {
        btnChild.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (selectedNodeId) {
            handleAddChild(selectedNodeId);
          }
        };
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      const btnSibling = document.getElementById('btn-add-sibling');
      const btnChild = document.getElementById('btn-add-child');
      if (btnSibling) {
        btnSibling.onclick = null;
      }
      if (btnChild) {
        btnChild.onclick = null;
      }
    };
  }, [selectedNodeId, nodes]);

  // --- 2. Node Operations ---

  // Central dependency unlocking & parent status sync logic
  const checkAndUnlockNodes = (currentNodes: MindMapNode[]): MindMapNode[] => {
    const { updatedNodes, unlockedNodeIds } = evaluateUpdatedLocks(currentNodes, customStatuses);

    unlockedNodeIds.forEach((unlockedId) => {
      const node = currentNodes.find((n) => n.id === unlockedId);
      if (node) {
        const toastId = Math.random().toString(36).substring(2, 9);
        const newToast = { id: toastId, title: node.label };
        setUnlockedToasts((prev) => [...prev, newToast]);
        setTimeout(() => {
          setUnlockedToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 4000);
      }
    });

    const withParentStatuses = evaluateParentStatuses(updatedNodes, customStatuses);
    return withParentStatuses;
  };

  const handleStatusUpdate = (nodeId: string, newStatus: string) => {
    handleUpdateNode(nodeId, { status: newStatus });
  };

  // Update specific node properties
  const handleUpdateNode = (id: string, updates: Partial<MindMapNode>) => {
    const updated = nodes.map((n) => {
      if (n.id === id) {
        return { ...n, ...updates };
      }
      return n;
    });

    const finalNodes = checkAndUnlockNodes(updated);
    saveState(calculateTreeLayout(finalNodes, activeLayout));
  };

  // Update multiple nodes simultaneously (batch update)
  const handleBatchUpdateNodes = (batchUpdates: { id: string; updates: Partial<MindMapNode> }[]) => {
    const updated = nodes.map((n) => {
      const match = batchUpdates.find((u) => u.id === n.id);
      if (match) {
        return { ...n, ...match.updates };
      }
      return n;
    });

    const finalNodes = checkAndUnlockNodes(updated);
    saveState(calculateTreeLayout(finalNodes, activeLayout));
  };

  // Resolve an overdue node by marking its status as "Done"
  const handleResolveOverdue = (nodeId: string, toastId: string) => {
    handleUpdateNode(nodeId, { status: 'Done' });
    setOverdueToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  // Trigger modern, minimal toast alerts for high priority overdue nodes
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    nodes.forEach((node) => {
      if (!node.dueDate) {
        triggeredOverdueNodes.current.delete(node.id);
        return;
      }

      const isHigh = node.priority && String(node.priority).toUpperCase() === 'HIGH';
      const isDone = node.status && String(node.status).toUpperCase() === 'DONE';

      const due = new Date(node.dueDate);
      const isPast = !isNaN(due.getTime()) && (() => {
        const d = new Date(due);
        d.setHours(0, 0, 0, 0);
        return d.getTime() < today.getTime();
      })();

      const isOverdue = isPast && !isDone;

      if (isOverdue && isHigh) {
        if (!triggeredOverdueNodes.current.has(node.id)) {
          triggeredOverdueNodes.current.add(node.id);

          const toastId = Math.random().toString(36).substring(2, 9);
          const newToast: OverdueToast = {
            id: toastId,
            nodeId: node.id,
            nodeLabel: node.label || `Node #${node.id}`,
            type: 'urgent'
          };

          setOverdueToasts((prev) => [...prev, newToast]);

          // Auto-dismiss after 4 seconds
          setTimeout(() => {
            setOverdueToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 4000);
        }
      } else {
        triggeredOverdueNodes.current.delete(node.id);
      }
    });
  }, [nodes]);

  // Paint Entire Branch with the styles of the selected node
  const handlePaintBranch = (id: string) => {
    const targetNode = nodes.find(n => n.id === id);
    if (!targetNode) return;

    const { fillColor, textColor, borderColor, borderStyle } = targetNode;

    const descendants = new Set<string>();
    const findDescendants = (nodeId: string) => {
      nodes.forEach((n) => {
        if (n.parentId === nodeId) {
          descendants.add(n.id);
          findDescendants(n.id);
        }
      });
    };
    findDescendants(id);

    const updatedNodes = nodes.map((n) => {
      if (descendants.has(n.id)) {
        return {
          ...n,
          fillColor: fillColor,
          textColor: textColor,
          borderColor: borderColor,
          borderStyle: borderStyle,
        };
      }
      return n;
    });

    saveState(calculateTreeLayout(updatedNodes, activeLayout));
  };

  // Generate unique numeric IDs
  const getNextId = (currentNodes: MindMapNode[]): string => {
    const ids = currentNodes.map((n) => parseInt(n.id, 10)).filter((n) => !isNaN(n));
    if (ids.length === 0) return '1';
    return (Math.max(...ids) + 1).toString();
  };

  // Add Sibling Node (Pressing Enter)
  const handleAddSibling = (baseNodeId: string) => {
    const baseNode = nodes.find((n) => n.id === baseNodeId);
    if (!baseNode) return;

    if (!baseNode.parentId) {
      // If the base node is the root (no parentId), create a new root node instead of a sibling
      handleAddRoot();
      return;
    }

    const newId = getNextId(nodes);
    const newSibling: MindMapNode = {
      id: newId,
      label: 'Task',
      parentId: baseNode.parentId,
      priority: 'Medium',
      status: 'Stand By',
      notes: '',
    };

    const finalNodes = checkAndUnlockNodes([...nodes, newSibling]);
    saveState(calculateTreeLayout(finalNodes, activeLayout));
    setSelectedNodeId(newId);

    // Auto-select & Focus "LABEL TEXT" input in inspector
    setTimeout(() => {
      const inputEl = document.getElementById('inspector-label-input') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 100);
  };

  // Add Child Node (Pressing Tab)
  const handleAddChild = (baseNodeId: string) => {
    const parentNode = nodes.find((n) => n.id === baseNodeId);
    if (!parentNode) return;

    const newId = getNextId(nodes);
    const newChild: MindMapNode = {
      id: newId,
      label: 'Task',
      parentId: parentNode.id,
      priority: 'Medium',
      status: 'Stand By',
      notes: '',
      ...(parentNode.fillColor !== undefined ? { fillColor: parentNode.fillColor } : {}),
      ...(parentNode.textColor !== undefined ? { textColor: parentNode.textColor } : {}),
      ...(parentNode.borderStyle !== undefined ? { borderStyle: parentNode.borderStyle } : {}),
      ...(parentNode.borderColor !== undefined ? { borderColor: parentNode.borderColor } : {}),
    };

    // Auto-expand the parent branch so the child displays immediately
    const updated = nodes.map((n) => {
      if (n.id === parentNode.id) {
        return { ...n, collapsed: false };
      }
      return n;
    });

    const finalNodes = checkAndUnlockNodes([...updated, newChild]);
    saveState(calculateTreeLayout(finalNodes, activeLayout));
    setSelectedNodeId(newId);

    // Auto-select & Focus "LABEL TEXT" input in inspector
    setTimeout(() => {
      const inputEl = document.getElementById('inspector-label-input') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 100);
  };

  // Add new disconnected root node
  const handleAddRoot = () => {
    const newId = getNextId(nodes);
    const newRoot: MindMapNode = {
      id: newId,
      label: 'Parent',
      parentId: null,
      priority: 'High',
      status: 'Stand By',
      notes: '',
    };

    const finalNodes = checkAndUnlockNodes([...nodes, newRoot]);
    saveState(calculateTreeLayout(finalNodes, activeLayout));
    setSelectedNodeId(newId);

    // Auto-select & Focus "LABEL TEXT" input in inspector
    setTimeout(() => {
      const inputEl = document.getElementById('inspector-label-input') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 100);
  };

  // Add new node with a specific due date from Calendar View
  const handleAddNodeWithDate = (date: string, customFields?: Partial<MindMapNode>) => {
    const newId = getNextId(nodes);
    const newNode: MindMapNode = {
      id: newId,
      label: customFields?.label || 'New Task',
      parentId: (customFields && customFields.parentId !== undefined) ? customFields.parentId : (nodes.length > 0 ? nodes[0].id : null),
      priority: customFields?.priority || 'Medium',
      status: customFields?.status || 'Stand By',
      notes: customFields?.notes || '',
      dueDate: date,
    };

    const finalNodes = checkAndUnlockNodes([...nodes, newNode]);
    saveState(calculateTreeLayout(finalNodes, activeLayout));
    setSelectedNodeId(newId);

    // Auto-select & Focus "LABEL TEXT" input in inspector
    setTimeout(() => {
      const inputEl = document.getElementById('inspector-label-input') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 100);
  };

  // Collapse or Expand Node branch
  const handleToggleCollapse = (id: string) => {
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode) return;

    const willCollapse = !targetNode.collapsed;

    if (willCollapse) {
      // 1. When a user clicks [-] to collapse a node, toggle its '.collapsed' property to true.
      // Also recursively collapse all descendants to maintain the folded state.
      const descendants = new Set<string>();
      const findDescendants = (nodeId: string) => {
        nodes.forEach((n) => {
          if (n.parentId === nodeId) {
            descendants.add(n.id);
            findDescendants(n.id);
          }
        });
      };
      findDescendants(id);

      const updated = nodes.map((n) => {
        if (n.id === id || descendants.has(n.id)) {
          return { ...n, collapsed: true };
        }
        return n;
      });
      saveState(calculateTreeLayout(updated, activeLayout));
    } else {
      // 2. CRITICAL FIX: When a user clicks [+] to unhide a node, ONLY flip that specific node's '.collapsed' state to false.
      // Do NOT touch or automatically flip the '.collapsed' states of its children or sub-children.
      const updated = nodes.map((n) => {
        if (n.id === id) {
          return { ...n, collapsed: false };
        }
        return n;
      });
      saveState(calculateTreeLayout(updated, activeLayout));
    }
  };

  // Reset canvas safely and spawn a brand new default Root Node labeled "New Project"
  const resetCanvas = () => {
    const newRoot: MindMapNode = {
      id: '1',
      label: 'New Project',
      parentId: null,
      priority: 'High',
      status: 'Todo',
      notes: '',
      collapsed: false,
    };
    const updated = calculateTreeLayout([newRoot], activeLayout);
    saveState(updated);
    setSelectedNodeId('1');
  };

  // Delete a node and all of its descendants recursively to maintain structural integrity
  const handleDeleteNode = (id: string) => {
    const nodeToDelete = nodes.find(n => n.id === id);
    if (!nodeToDelete) return;

    if (nodeToDelete.isLocked) {
      alert("⚠️ Cannot delete: This node is currently locked by dependency constraints!");
      return;
    }

    if (nodes.length === 1) {
      resetCanvas();
      return;
    }

    const descendants = new Set<string>();

    const findDescendants = (nodeId: string) => {
      nodes.forEach((n) => {
        if (n.parentId === nodeId) {
          descendants.add(n.id);
          findDescendants(n.id);
        }
      });
    };

    findDescendants(id);
    descendants.add(id);

    const hasLockedNode = nodes.some(n => descendants.has(n.id) && n.isLocked);
    if (hasLockedNode) {
      alert("⚠️ Cannot delete: The node or one of its sub-tasks is currently locked!");
      return;
    }

    const updated = nodes
      .filter((n) => !descendants.has(n.id))
      .map((n) => {
        const hadChildrenBefore = nodes.some((c) => c.parentId === n.id);
        const hasChildrenAfter = nodes.some((c) => c.parentId === n.id && !descendants.has(c.id));
        if (hadChildrenBefore && !hasChildrenAfter) {
          return { ...n, status: 'Stand By' };
        }
        return n;
      });
    const finalNodes = checkAndUnlockNodes(updated);
    saveState(calculateTreeLayout(finalNodes, activeLayout));

    if (selectedNodeId && descendants.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  // --- 3. UI Helpers & Actions ---

  // Wipe and load templates
  const handleSelectTemplate = (templateId: string) => {
    const templateNodes = getTemplateNodes(templateId);
    const configured = calculateTreeLayout(templateNodes, activeLayout);
    setNodes(configured);
    setSelectedNodeId(null);
    setActiveTemplateId(templateId);

    localStorage.setItem('mindmap_nodes_v2', JSON.stringify(configured));
    localStorage.setItem('mindmap_template_id_v2', templateId);
  };

  const handleSelectTheme = (themeId: string) => {
    const matched = PREMIUM_THEMES.find((t) => t.id === themeId);
    if (matched) {
      setActiveTheme(matched);
      localStorage.setItem('mindmap_theme_id_v2', themeId);
    }
  };

  const handleSelectLayout = (layoutType: string) => {
    setActiveLayout(layoutType);
    localStorage.setItem('mindmap_active_layout_v2', layoutType);
    saveState(calculateTreeLayout(nodes, layoutType));
  };

  // Reset entire structure back to default
  const handleResetDefault = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    const defaultNodes = getTemplateNodes('llm-agentic-pipeline');
    const configured = calculateTreeLayout(defaultNodes, activeLayout);
    
    // Save current state to undo stack before resetting so users can undo if they click by mistake!
    undoStack.push(JSON.parse(JSON.stringify(nodes)));
    redoStack = [];
    setUndoLength(undoStack.length);
    setRedoLength(0);

    setNodes(configured);
    setSelectedNodeId(null);
    setActiveTemplateId('llm-agentic-pipeline');
    setSelectedIndustry('Tech & AI');
    localStorage.setItem('mindmap_nodes_v2', JSON.stringify(configured));
    localStorage.setItem('mindmap_template_id_v2', 'llm-agentic-pipeline');
    setIsResetConfirmOpen(false);
  };

  // --- 4. Exporters & Importers ---

  // High-fidelity Offscreen 2D Canvas Image Builder with High-DPI Supersampling
  const getOffscreenCanvas = () => {
    if (nodes.length === 0) return null;

    // 1. Calculate boundaries of all nodes to fit coordinates
    const xs = nodes.map((n) => n.x || 0);
    const ys = nodes.map((n) => n.y || 0);
    const minX = Math.min(...xs) - 80;
    const maxX = Math.max(...xs) + 260; // Node width is 220 + padding
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 140; // Node height is 80 + padding

    const width = maxX - minX;
    const height = maxY - minY;

    // 2. Setup Offscreen Canvas with Supersampling for Ultra High-Res Retina quality
    const scaleFactor = 3.5; // 350% scaling for razor sharp vectors upon zoom
    const canvas = document.createElement('canvas');
    canvas.width = width * scaleFactor;
    canvas.height = height * scaleFactor;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Standardize text drawing & image smoothing quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Scale context so that standard 1x coordinates automatically draw with high-DPI quality
    ctx.scale(scaleFactor, scaleFactor);

    // Translate coordinates so everything is visible
    ctx.translate(-minX, -minY);

    // 3. Fill Solid Canvas Background
    ctx.fillStyle = activeTheme.canvasBg;
    ctx.fillRect(minX, minY, width, height);

    // 4. Draw Radial grid dot background
    ctx.fillStyle = activeTheme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    for (let x = minX; x < maxX; x += 24) {
      for (let y = minY; y < maxY; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const NODE_W = 220;
    const NODE_H = 80;

    // Helper map
    const nodeMap = new Map<string, MindMapNode>(nodes.map((n) => [n.id, n]));

    // 5. Draw Connector Curves
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const parent = nodeMap.get(node.parentId);
      if (!parent) return;

      const px = (parent.x || 0) + NODE_W;
      const py = (parent.y || 0) + NODE_H / 2;
      const cx = node.x || 0;
      const cy = (node.y || 0) + NODE_H / 2;

      const controlDist = Math.abs(cx - px) * 0.45;

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.bezierCurveTo(px + controlDist, py, cx - controlDist, cy, cx, cy);
      ctx.strokeStyle = activeTheme.connectorColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    // 6. Draw Rounded Node Cards
    nodes.forEach((node) => {
      const nx = node.x || 0;
      const ny = node.y || 0;

      // Draw background rect
      ctx.fillStyle = node.fillColor || activeTheme.nodeBg;
      ctx.strokeStyle = activeTheme.nodeBorder;
      ctx.lineWidth = 2;

      // Draw rounded rectangle
      ctx.beginPath();
      const r = 12; // radius
      ctx.roundRect ? ctx.roundRect(nx, ny, NODE_W, NODE_H, r) : ctx.rect(nx, ny, NODE_W, NODE_H);
      ctx.fill();
      ctx.stroke();

      // Node text label
      ctx.fillStyle = node.textColor || activeTheme.nodeText;
      let fontStyle = node.isItalic ? "italic" : "normal";
      let fontWeight = node.isBold !== false ? "bold" : "normal";
      ctx.font = `${fontStyle} ${fontWeight} 12px sans-serif`;
      ctx.fillText(node.label.substring(0, 30), nx + 14, ny + 26);

      // Node subtask notes
      if (node.notes) {
        ctx.fillStyle = activeTheme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        let notesFontStyle = node.isItalic ? "italic" : "normal";
        ctx.font = `${notesFontStyle} normal 9px sans-serif`;
        ctx.fillText(node.notes.substring(0, 36), nx + 14, ny + 42);
      }

      // Priority Badge Fill
      ctx.fillStyle = node.priority === 'High' ? '#ef4444' : node.priority === 'Medium' ? '#eab308' : '#10b981';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(nx + 14, ny + 54, 45, 14, 4) : ctx.rect(nx + 14, ny + 54, 45, 14);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(node.priority.toUpperCase(), nx + 20, ny + 64);

      // Status Badge Fill
      ctx.fillStyle = node.status === 'Done' ? '#10b981' : node.status === 'In Progress' ? '#06b6d4' : node.status === 'Blocked' ? '#f43f5e' : '#64748b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(nx + 65, ny + 54, 55, 14, 4) : ctx.rect(nx + 65, ny + 54, 55, 14);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(node.status.toUpperCase(), nx + 70, ny + 64);
    });

    return { canvas, width, height };
  };

  // High-fidelity PNG Export
  const handleExportPNG = () => {
    const result = getOffscreenCanvas();
    if (!result) return;
    const { canvas } = result;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.setAttribute('download', `mindmap_board_${activeTemplateId}.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // High-fidelity Interactive PDF Export
  const handleExportPDF = () => {
    const result = getOffscreenCanvas();
    if (!result) return;
    const { canvas, width, height } = result;

    const dataUrl = canvas.toDataURL('image/png');
    const orientation = width > height ? 'l' : 'p';

    // Create jsPDF instance with page sizes matching the content bounds plus margin padding
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'px',
      format: [width + 80, height + 100]
    });

    // Clean background
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width + 80, height + 100, 'F');

    // Header Title
    pdf.setTextColor(15, 23, 42);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("MindSync Pro Workspace Outline", 40, 40);

    // Meta-information Subheader
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Generated on: ${new Date().toLocaleString()} | Theme: ${activeTheme.name} | Layout Mode: ${activeLayout}`, 40, 56);

    // Embed offscreen mindmap image
    pdf.addImage(dataUrl, 'PNG', 40, 75, width, height);

    // Save PDF file
    pdf.save(`mindmap_document_${activeTemplateId}.pdf`);
  };

  // Traversal helper for hierarchical list structure (DFS) to maintain logical grouping in Excel CSV
  const getHierarchicalNodeList = (nodesList: MindMapNode[]) => {
    const childrenMap = new Map<string, MindMapNode[]>();
    const roots: MindMapNode[] = [];

    nodesList.forEach((node) => {
      if (!node.parentId) {
        roots.push(node);
      } else {
        const list = childrenMap.get(node.parentId) || [];
        list.push(node);
        childrenMap.set(node.parentId, list);
      }
    });

    const result: { node: MindMapNode; depth: number; parentLabel: string }[] = [];

    const traverse = (node: MindMapNode, depth: number, parentLabel: string) => {
      result.push({ node, depth, parentLabel });
      const children = childrenMap.get(node.id) || [];
      // Sort children by Y value to export in top-to-bottom layout alignment
      children.sort((a, b) => (a.y || 0) - (b.y || 0));
      children.forEach((child) => traverse(child, depth + 1, node.label));
    };

    roots.sort((a, b) => (a.y || 0) - (b.y || 0));
    roots.forEach((root) => traverse(root, 0, ''));
    return result;
  };

  // Structured Microsoft Excel Outline Export (CSV format with full nesting support)
  const handleExportExcel = () => {
    const flatTree = getHierarchicalNodeList(nodes);
    const headers = ['Hierarchy Level', 'Topic (Hierarchical Mind Map Outline)', 'Parent Topic Label', 'Priority Status', 'Workflow Status', 'Node Notes / Description'];

    const rows = flatTree.map(({ node, depth, parentLabel }) => {
      const indent = '    '.repeat(depth);
      const prefix = depth === 0 ? '✦ ' : '└── ';
      const labelWithNesting = `${indent}${prefix}${node.label}`;

      return [
        String(depth),
        labelWithNesting,
        parentLabel || 'Root Core Project',
        node.priority,
        node.status,
        node.notes || ''
      ];
    });

    // Create CSV payload escaping all commas and quotes
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => {
        const escaped = String(field).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(','))
      .join('\n');

    // Include UTF-8 BOM so Excel opens with full character set preservation
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mindmap_excel_outline_${activeTemplateId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full Raw MindMap State JSON Backup Export
  const handleExportJSON = () => {
    const exportData = {
      appName: 'MindSync Pro',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      themeId: activeTheme.id,
      layoutMode: activeLayout,
      nodes: nodes,
      customStatuses: customStatuses
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mindmap_backup_${activeTemplateId}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Backwards-compatible JSON MindMap Import Handler
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJSON = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          // Verify nodes have valid identifiers
          const isValid = parsed.nodes.every((n: any) => n && typeof n.id === 'string' && typeof n.label === 'string');
          if (isValid) {
            // Push current state to undo stack before import
            undoStack.push(JSON.parse(JSON.stringify(nodes)));
            setUndoLength(undoStack.length);
            redoStack = [];
            setRedoLength(0);

            // Ensure standard statuses are maintained
            localStorage.setItem('mindmap_statuses_v2', JSON.stringify(STANDARD_STATUSES));

            // Restore theme
            if (parsed.themeId) {
              const matched = PREMIUM_THEMES.find(t => t.id === parsed.themeId);
              if (matched) {
                setActiveTheme(matched);
                localStorage.setItem('mindmap_theme_id_v2', matched.id);
              }
            }

            // Restore layout geometry
            if (parsed.layoutMode) {
              setActiveLayout(parsed.layoutMode);
              localStorage.setItem('mindmap_active_layout_v2', parsed.layoutMode);
            }

            // Setup Nodes with normalized status and proper Layout bounds
            const normalized = normalizeNodeStatuses(parsed.nodes);
            const evaluated = evaluateParentStatuses(normalized, STANDARD_STATUSES);
            const freshNodes = calculateTreeLayout(evaluated, parsed.layoutMode || activeLayout);
            setNodes(freshNodes);
            localStorage.setItem('mindmap_nodes_v2', JSON.stringify(freshNodes));
            
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            triggerAutoSaveIndicator();
          } else {
            alert('JSON validation error: Node objects inside the exported nodes array are missing required labels or IDs.');
          }
        } else {
          alert('JSON validation error: The selected file does not match a valid MindSync Pro mindmap export document schema.');
        }
      } catch (err) {
        console.error('Import failure:', err);
        alert('Invalid JSON file parsing: Failed to extract a valid mindmap schema. Make sure the file was created using the Backup export.');
      }
    };
    reader.readAsText(file);
  };

  // Full-screen VIBE shell (Phase 1A: File Opener, Reading View, Highlighter)
  if (activeView === 'vibe') {
    return <VibeView onBack={() => setActiveView('mindmap')} />;
  }

  return (
    <div className={`flex flex-col h-screen w-screen font-sans overflow-hidden transition-colors duration-300 relative ${
      activeTheme.isDark 
        ? 'bg-[#0b0c10] text-slate-100' 
        : 'bg-[#F8FAFC] text-[#0F172A]'
    }`}>      {/* 1. Dedicated White/Light Top Toolbar */}
      <header className="h-16 shrink-0 px-6 flex items-center justify-between z-30 border-b-2 border-slate-300 bg-white text-slate-900 shadow-md w-full gap-3 select-none">
        
        {/* LEFT & CENTER PARTS COMBINED IN A SINGLE ROW WITH 12PX GAP */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          
          {/* Logo "MindSync Pro" */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#2563EB] shadow-md shrink-0">
              <span className="font-extrabold text-white text-base">M</span>
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold tracking-tight text-sm text-[#0F172A] leading-none">
                  MindSync Pro
                </h1>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">MindMap Workspace</p>
            </div>
          </div>

          {/* Auto-Save status indicator */}
          <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l-2 border-slate-200 shrink-0">
            <div className={`w-2 h-2 rounded-full ${autoSaveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[11px] font-bold text-slate-500 select-none flex items-center gap-1">
              <Save className="w-3.5 h-3.5 text-[#475569]" />
              {autoSaveStatus === 'saving' ? 'Saving...' : `Saved at ${lastSavedTime}`}
            </span>
          </div>

          {/* View Switcher: [Mindmap] [Table] [Board] */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0 select-none">
            <button
              type="button"
              onClick={() => setActiveView('mindmap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none ${
                activeView === 'mindmap'
                  ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mindmap</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none ${
                activeView === 'table'
                  ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('board')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none ${
                activeView === 'board'
                  ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none ${
                activeView === 'calendar'
                  ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>

          {/* FOCUS BUTTON (with target icon 🎯) & Side-by-Side Counter Badge */}
          <div className="flex items-center gap-2 shrink-0 relative z-50">
            <button
              type="button"
              id="header-focus-toggle-btn"
              onClick={() => setIsFocusModeActive(prev => !prev)}
              title={isFocusModeActive ? "Turn Focus Mode OFF (Press 'F')" : "Turn Focus Mode ON (Press 'F')"}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 select-none shrink-0 ${
                isFocusModeActive
                  ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-[#2563eb] shadow-md shadow-blue-500/20 active:scale-95'
                  : 'bg-white border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 active:scale-95'
              }`}
            >
              <Target className={`w-4 h-4 shrink-0 ${isFocusModeActive ? 'animate-pulse text-white' : 'text-slate-500'}`} />
              <span>{isFocusModeActive ? 'Focus ON 🎯' : 'Focus'}</span>
            </button>

            {/* Counter Badge shown next to the button */}
            <div className="text-xs font-extrabold bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-xl border border-slate-200 shrink-0 shadow-xs select-none">
              <span className="text-blue-600">
                {nodes.filter(isNodeInFocusCriteria).length}
              </span>
              <span className="text-slate-400 font-bold mx-0.5">/</span>
              <span className="text-slate-500">
                {nodes.length}
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-xs min-w-[100px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              id="custom-canvas-search-input"
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1.5">
                <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-extrabold px-1.5 py-0.5 rounded-md select-none shrink-0">
                  {(() => {
                    const query = searchQuery.toLowerCase();
                    const matches = nodes.filter(
                      (n) =>
                        String(n.label || '').toLowerCase().includes(query) ||
                        (n.notes && String(n.notes).toLowerCase().includes(query))
                    );
                    return `${matches.length}`;
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 border-none bg-transparent cursor-pointer flex items-center justify-center"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT ZONE: Ghost Peek & Theme Selector */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Ghost Peek Toggle */}
          <button
            id="btn-ghost-peek"
            onClick={() => setIsGhostModeActive(!isGhostModeActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border-2 transition-all cursor-pointer ${
              isGhostModeActive
                ? 'border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Toggle Ghost Peek (X-Ray Visual Layering Mode)"
          >
            <span id="ghost-icon">
              {isGhostModeActive ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            </span> 
            <span className="hidden sm:inline">Ghost Peek: {isGhostModeActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Theme Selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0" htmlFor="top-theme-select">
              <Palette className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="hidden md:inline">Theme:</span>
            </label>
            <select
              id="top-theme-select"
              value={activeTheme.id}
              onChange={(e) => handleSelectTheme(e.target.value)}
              className="bg-white border-2 border-slate-300 text-slate-800 font-bold text-xs px-2 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
            >
              {PREMIUM_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* 2. Secondary Workspace & Control Toolbar (Housing the High-Fidelity Import/Export Suite) */}
      <div className="bg-[#F8FAFC] border-b-2 border-slate-300 px-6 py-2 flex flex-wrap items-center justify-between gap-3 z-20 shadow-xs shrink-0">
        {/* LEFT BAR: Layout & History Actions */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Layout Selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0" htmlFor="top-layout-select">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Map Layout:</span>
            </label>
            <select
              id="top-layout-select"
              value={activeLayout}
              onChange={(e) => handleSelectLayout(e.target.value)}
              className="bg-white border-2 border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 transition-all shadow-xs max-w-[210px] md:max-w-none"
            >
              <optgroup label="Category A: Radial & Standard">
                <option value="radial">1. Balanced Radial Starburst</option>
                <option value="right-sided">2. Right-Sided Tree Expansion</option>
                <option value="left-sided">3. Left-Sided Tree Expansion</option>
                <option value="dual-wing">4. Symmetrical Dual-Wing Split</option>
                <option value="cloud-cluster">5. Freeform Cloud Cluster</option>
                <option value="concentric-rings">6. Concentric Orbital Rings</option>
              </optgroup>
              <optgroup label="Category B: Hierarchical & Structural">
                <option value="top-down">7. Top-Down Corporate Org Chart</option>
                <option value="bottom-up">8. Bottom-Up Inverted Tree</option>
                <option value="block-90">9. Rigid 90° Technical Block Chart</option>
                <option value="bracket">10. Bracket / Brace Map</option>
                <option value="pyramid">11. Divided Layered Pyramid Hierarchy</option>
                <option value="funnel">12. Funnel Architecture Layout</option>
                <option value="diamond-network">13. Centralized Diamond Network</option>
                <option value="quad-matrix">14. Quad-Quadrant Matrix Grid Layout</option>
              </optgroup>
              <optgroup label="Category C: Process, Flow & Chronology">
                <option value="horizontal-timeline">15. Horizontal Milestone Timeline</option>
                <option value="vertical-flow">16. Vertical Process Flow Cascade</option>
                <option value="fishbone-lr">17. Left-to-Right Angled Fishbone</option>
                <option value="fishbone-rl">18. Right-to-Left Angled Fishbone</option>
                <option value="zigzag-workflow">19. Zig-Zag Alternating Workflow Path</option>
                <option value="closed-loop">20. Circular Closed-Loop Lifecycle</option>
                <option value="flowchart-block">21. Standard Flowchart Block Mapping</option>
                <option value="concept-web">22. Deep Cross-Linked Concept Web</option>
              </optgroup>
              <optgroup label="Category D: Premium Agile & Productivity">
                <option value="kanban-lanes">23. Kanban Board Lanes (by Status)</option>
                <option value="priority-quadrants">24. Priority Matrix Quadrants</option>
                <option value="value-stream">25. Value-Stream Mapping Flow</option>
                <option value="impact-effort">26. Impact-Effort 2x2 Spatial Chart</option>
                <option value="swimlane-flow">27. Swimlane Cross-Functional Flow</option>
                <option value="venn-diagram">28. Venn Diagram Tri-Circle Overlap</option>
                <option value="hub-spoke">29. Circular Hub-and-Spoke Wheel</option>
                <option value="diagonal-step">30. Diagonal Step-Up Escalation Chart</option>
                <option value="spiral-growth">31. Spiral Growth Map</option>
                <option value="sitemap-outline">32. Block-Style Site Map Outline</option>
                <option value="gantt-rows">33. Multi-Tiered Gantt Task Row</option>
                <option value="pie-sunburst">34. Concentric Pie/Sunburst Slice</option>
                <option value="bubble-matrix">35. Bubble Matrix Density Cluster</option>
                <option value="hex-honeycomb">36. Hexagonal Honeycomb Cellular</option>
                <option value="triple-wing">37. Split Triple-Wing Fan Layout</option>
                <option value="dual-track-timeline">38. Parallel Dual-Track Timeline</option>
                <option value="star-topology">39. Star-Topology Network Map</option>
                <option value="spine-journal">40. Central Spine Mind-Journal Tree</option>
              </optgroup>
            </select>
          </div>

          <div className="h-4 w-[1px] bg-slate-300 hidden md:block"></div>

          {/* Undo / Redo Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={undoLength === 0}
              className={`px-2.5 py-1 rounded-lg border-2 text-[11px] font-bold flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                undoLength === 0
                  ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95'
              }`}
              title="Undo Last Action (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5 mr-1" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleRedo}
              disabled={redoLength === 0}
              className={`px-2.5 py-1 rounded-lg border-2 text-[11px] font-bold flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                redoLength === 0
                  ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95'
              }`}
              title="Redo Next Action (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo className="w-3.5 h-3.5 mr-1" />
              <span>Redo</span>
            </button>
          </div>
        </div>

        {/* Centered VIBE Button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => setActiveView('vibe')}
            style={{
              background: "linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: 1,
              padding: "8px 20px",
              borderRadius: 999,
              border: "none",
              boxShadow: "0 0 12px rgba(236, 72, 153, 0.6)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            ⚡ VIBE
          </button>
        </div>

        {/* RIGHT BAR: High-Fidelity Export & Import Suite */}
        <div className="flex items-center gap-2 relative">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden lg:block mr-1">
            File Integration Suite:
          </div>

          {/* Hidden Input for Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            className="hidden"
            accept=".json"
          />
          
          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 text-indigo-700 hover:border-indigo-300 transition-all flex items-center gap-1.5 text-xs font-extrabold cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
            title="Import mind map from JSON Backup file"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>Import backup</span>
          </button>

          {/* Export Dropdown Button Group */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 text-emerald-700 hover:border-emerald-300 transition-all flex items-center gap-1.5 text-xs font-extrabold cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              title="Export mind map into various professional formats"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Map</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 text-emerald-500 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Options */}
            {isExportDropdownOpen && (
              <>
                {/* Invisible Overlay to close the dropdown on click outside */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent cursor-default" 
                  onClick={() => setIsExportDropdownOpen(false)}
                />
                
                <div className="absolute right-0 mt-1.5 w-60 bg-white border-2 border-slate-800 rounded-xl shadow-lg py-2 z-50 text-slate-900 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Export Format</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      handleExportPNG();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700 flex items-center gap-2.5 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="leading-tight text-slate-800">PNG Image</div>
                      <div className="text-[9px] text-slate-400 font-medium">High-resolution offscreen raster graphic</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExportPDF();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 flex items-center gap-2.5 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="leading-tight text-slate-800">PDF Document</div>
                      <div className="text-[9px] text-slate-400 font-medium">Vector document with custom title header</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExportExcel();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-amber-700 flex items-center gap-2.5 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <Grid className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="leading-tight text-slate-800">Excel Outline (.csv)</div>
                      <div className="text-[9px] text-slate-400 font-medium">DFS indented hierarchical table spreadsheet</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExportJSON();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-700 flex items-center gap-2.5 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="leading-tight text-slate-800">JSON State Backup</div>
                      <div className="text-[9px] text-slate-400 font-medium">Raw project schema backup to restore later</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          
          <button
            onClick={handleResetDefault}
            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 text-rose-700 hover:text-rose-800 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
            title="Reset to default map"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 3. Main Workspace Area: Single Mind Map Canvas */}
      <main className="flex-1 flex overflow-hidden w-full relative">
        <section className="flex-1 h-full relative overflow-hidden flex bg-slate-950">
          <div className="flex-1 h-full relative">
            {isFocusModeActive && nodes.filter(isNodeInFocusCriteria).length === 0 && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-50 animate-fade-in">
                <div className="max-w-md bg-slate-900 border-2 border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                  <div className="text-5xl mb-4 animate-bounce">🎉</div>
                  <h3 className="text-xl font-extrabold text-white mb-2">No urgent tasks!</h3>
                  <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                    All tasks are low priority or scheduled for the future. You are completely caught up on high priorities!
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsFocusModeActive(false)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95 border-none cursor-pointer"
                  >
                    Turn Off Focus Mode
                  </button>
                </div>
              </div>
            )}

            {/* Mindmap Canvas View Wrapper */}
            <div className={`absolute inset-0 transition-all duration-300 ${
              activeView === 'mindmap' 
                ? 'opacity-100 pointer-events-auto scale-100' 
                : 'opacity-0 pointer-events-none scale-98'
            }`}>
              <MindMapCanvas
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                theme={activeTheme}
                customStatuses={customStatuses}
                onSelectNode={setSelectedNodeId}
                onUpdateNode={handleUpdateNode}
                onBatchUpdateNodes={handleBatchUpdateNodes}
                onAddSibling={handleAddSibling}
                onAddChild={handleAddChild}
                onToggleCollapse={handleToggleCollapse}
                onDeleteNode={handleDeleteNode}
                layoutGeometry={activeLayout}
                searchQuery={searchQuery}
                isGhostModeActive={isGhostModeActive}
                isFocusModeActive={isFocusModeActive}
                onOpenDependencyModal={handleOpenDependencySelection}
                onOpenLockModal={(id) => {
                  const targetNode = nodes.find(n => n.id === id);
                  if (targetNode) {
                    setLockModalNodeId(id);
                    const raw = targetNode.lockDependencies || targetNode.blockedBy || [];
                    const pendingDeps = raw.filter(depId => {
                      const depNode = nodes.find(n => n.id === depId);
                      return depNode ? !isDone(depNode, customStatuses) : false;
                    });
                    setDraftDependencies(pendingDeps);
                    setActiveView('mindmap');
                  }
                }}
                dependencySelectionNodeId={dependencyModalNodeId || lockModalNodeId}
                draftDependencies={draftDependencies}
                onToggleDependency={handleToggleDependencyOnCanvas}
                highlightNodeId={highlightNodeId}
                onFocusNode={handleFocusNode}
              />
            </div>

            {/* Table View Wrapper */}
            <div className={`absolute inset-0 transition-all duration-300 ${
              activeView === 'table' 
                ? 'opacity-100 pointer-events-auto scale-100' 
                : 'opacity-0 pointer-events-none scale-98'
            }`}>
              <TableView
                nodes={nodes}
                theme={activeTheme}
                customStatuses={customStatuses}
                searchQuery={searchQuery}
                onUpdateNode={handleUpdateNode}
                onBatchUpdateNodes={handleBatchUpdateNodes}
                onDeleteNode={handleDeleteNode}
                onAddChild={handleAddChild}
                onSelectNode={setSelectedNodeId}
                isFocusModeActive={isFocusModeActive}
              />
            </div>

            {/* Board View Wrapper */}
            <div className={`absolute inset-0 transition-all duration-300 ${
              activeView === 'board' 
                ? 'opacity-100 pointer-events-auto scale-100' 
                : 'opacity-0 pointer-events-none scale-98'
            }`}>
              <BoardView
                nodes={nodes}
                theme={activeTheme}
                customStatuses={customStatuses}
                searchQuery={searchQuery}
                selectedNodeId={selectedNodeId}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onSelectNode={setSelectedNodeId}
                isFocusModeActive={isFocusModeActive}
              />
            </div>

            {/* Calendar View Wrapper */}
            <div className={`absolute inset-0 transition-all duration-300 ${
              activeView === 'calendar' 
                ? 'opacity-100 pointer-events-auto scale-100' 
                : 'opacity-0 pointer-events-none scale-98'
            }`}>
              <CalendarView
                nodes={nodes}
                theme={activeTheme}
                customStatuses={customStatuses}
                searchQuery={searchQuery}
                selectedNodeId={selectedNodeId}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onSelectNode={setSelectedNodeId}
                isFocusModeActive={isFocusModeActive}
                onAddNodeWithDate={handleAddNodeWithDate}
              />
            </div>

            {/* Smart Overdue Detection Toast List Container */}
            <div className="fixed top-24 right-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
              {overdueToasts.map((toast) => (
                <div
                  key={toast.id}
                  className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-800 flex items-start gap-3 w-full animate-in slide-in-from-right-4 fade-in duration-300"
                >
                  <div className="bg-rose-500/15 p-1.5 rounded-lg text-rose-500 shrink-0 mt-0.5 animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white leading-snug">
                      ⚠️ Urgent: <span className="text-rose-400 font-black">"{toast.nodeLabel}"</span> is overdue!
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-normal">
                      This high-priority task is past its due date.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleResolveOverdue(toast.nodeId, toast.id)}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[10px] font-extrabold shadow-xs transition-all cursor-pointer border-none"
                      >
                        Clear Overdue
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverdueToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-[10px] font-bold transition-all cursor-pointer border-none"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverdueToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer border-none bg-transparent self-start -mt-1 -mr-1"
                    title="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Right-Side Inspector Panel (Width: 350px) */}
          <div
            className={`flex flex-col h-full border-l transition-all duration-300 ease-in-out shrink-0 overflow-hidden z-20 bg-white shadow-2xl relative pb-24 ${
              selectedNodeId 
                ? 'w-[350px] border-slate-300' 
                : 'w-0 border-transparent pointer-events-none'
            }`}
          >
            {/* Inspector Panel Surface */}
            <div className="w-[350px] h-full flex flex-col bg-white text-slate-900 border-none relative pb-24">
              {(() => {
                const node = nodes.find((n) => n.id === selectedNodeId);
                if (!node) {
                  return (
                    <div className="p-6 flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Info className="w-8 h-8 opacity-40 text-slate-500" />
                      <p className="text-xs italic text-center font-semibold">Select a node or cell to view and edit its active properties.</p>
                    </div>
                  );
                }

                const isRoot = node.parentId === null;
                const nodeLocked = isNodeLocked(node, nodes, customStatuses);

                return (
                  <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {/* HEADER */}
                    <div className="flex-none p-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-3xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                          Node #{node.id}
                        </span>
                        {isRoot && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                            Root Core
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteNode(node.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                          title={nodes.length === 1 ? "Reset Canvas & Delete Root" : "Delete Node"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedNodeId(null)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer border-none bg-transparent flex items-center justify-center"
                          title="Close Inspector"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* BODY */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {nodeLocked && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 font-medium flex gap-2 animate-in fade-in duration-150">
                          <span className="text-sm">🔒</span>
                          <div>
                            <strong>Editing Locked:</strong> Complete this node's predecessor tasks to unlock editing.
                          </div>
                        </div>
                      )}

                      {/* Node Title Field */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Label Text
                        </label>
                        <input
                          id="inspector-label-input"
                          type="text"
                          value={node.label}
                          disabled={nodeLocked}
                          onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSibling(node.id);
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              handleAddChild(node.id);
                            }
                          }}
                          className={`w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 shadow-3xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${nodeLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                          placeholder="Node description label..."
                        />
                      </div>

                      {/* Balanced Layout Block for Priority and Status Selectors */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Priority
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              disabled={nodeLocked}
                              onClick={() => setIsPriorityDropdownOpen(!isPriorityDropdownOpen)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 shadow-3xs hover:border-slate-400 transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${nodeLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {node.priority === 'High' && (
                                  <>
                                    <div className="px-1 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black flex items-center gap-1 shrink-0">
                                      <ChevronsUp className="w-3 h-3 text-rose-600" />
                                    </div>
                                    <span className="text-rose-700 font-extrabold truncate">High</span>
                                  </>
                                )}
                                {node.priority === 'Medium' && (
                                  <>
                                    <div className="px-1 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-600 text-[10px] font-black flex items-center gap-1 shrink-0">
                                      <ChevronUp className="w-3 h-3 text-yellow-600" />
                                    </div>
                                    <span className="text-yellow-700 font-extrabold truncate">Medium</span>
                                  </>
                                )}
                                {node.priority === 'Low' && (
                                  <>
                                    <div className="px-1 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black flex items-center gap-1 shrink-0">
                                      <ChevronDown className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <span className="text-emerald-700 font-extrabold truncate">Low</span>
                                  </>
                                )}
                              </div>
                              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                            </button>

                            {isPriorityDropdownOpen && (
                              <>
                                {/* Backdrop to close dropdown */}
                                <div 
                                  className="fixed inset-0 z-40 bg-transparent" 
                                  onClick={() => setIsPriorityDropdownOpen(false)}
                                />
                                
                                {/* Options Dropdown Menu */}
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateNode(node.id, { priority: 'High' });
                                      setIsPriorityDropdownOpen(false);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer border-none bg-transparent"
                                  >
                                    <div className="px-1 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black flex items-center gap-1 shrink-0">
                                      <ChevronsUp className="w-3 h-3 text-rose-600" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[11px] font-extrabold text-rose-700">High</span>
                                      <span className="text-[8px] text-slate-400 font-bold leading-none mt-0.5">Critical attention</span>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateNode(node.id, { priority: 'Medium' });
                                      setIsPriorityDropdownOpen(false);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer border-none bg-transparent"
                                  >
                                    <div className="px-1 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-600 text-[10px] font-black flex items-center gap-1 shrink-0">
                                      <ChevronUp className="w-3 h-3 text-yellow-600" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[11px] font-extrabold text-yellow-700">Medium</span>
                                      <span className="text-[8px] text-slate-400 font-bold leading-none mt-0.5">Important items</span>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateNode(node.id, { priority: 'Low' });
                                      setIsPriorityDropdownOpen(false);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer border-none bg-transparent"
                                  >
                                    <div className="px-1 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black flex items-center gap-1 shrink-0">
                                      <ChevronDown className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[11px] font-extrabold text-emerald-700">Low</span>
                                      <span className="text-[8px] text-slate-400 font-bold leading-none mt-0.5">Flexible tasks</span>
                                    </div>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {isManagerNode(node, nodes) ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Manager Status
                              </label>
                              <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                AUTO MANAGER
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <ManagerStatusPill status={getManagerStatus(node, nodes)} />
                              <button type="button"
                                disabled={nodeLocked}
                                onClick={() => {
                                  const isBlocked = node.manualBlocked === true || String(node.status).toUpperCase() === 'BLOCKED';
                                  handleUpdateNode(node.id, {
                                    manualBlocked: !isBlocked,
                                    status: !isBlocked ? 'Blocked' : 'In Progress'
                                  });
                                }}
                                style={{ padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                                  border: '1px solid ' + (node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? '#047857' : '#b91c1c'),
                                  background: node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? '#d1fae5' : '#fee2e2',
                                  color: node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? '#047857' : '#b91c1c' }}>
                                {node.manualBlocked || String(node.status).toUpperCase() === 'BLOCKED' ? 'Unblock' : 'Mark as Blocked'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Status
                            </label>
                            <select
                              value={node.status}
                              disabled={nodeLocked}
                              onChange={(e) => handleUpdateNode(node.id, { status: e.target.value })}
                              className={`w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300 outline-none focus:border-blue-500 transition-all ${nodeLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                              style={(() => {
                                const curSt = customStatuses.find(s => s.name === node.status) || 
                                              customStatuses.find(s => s.id === node.status);
                                return {
                                  backgroundColor: curSt ? curSt.colorBg : '#f1f5f9',
                                  color: curSt ? curSt.colorText : '#475569',
                                  borderColor: curSt ? curSt.colorBorder : '#cbd5e1'
                                };
                              })()}
                            >
                              {customStatuses.map((st) => (
                                <option key={st.id} value={st.name} style={{ backgroundColor: st.colorBg, color: st.colorText }}>
                                  {st.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* TASK DEPENDENCIES & LOCK Section */}
                      {(() => {
                        const { deps, done, total, pct } = lockProgress(node, nodes, customStatuses);

                        // Find successors (nodes that depend on THIS node)
                        const successorNodes = nodes.filter((n) => {
                          const nDeps = (n.lockDependencies || n.blockedBy || []).map(String);
                          return nDeps.includes(String(node.id));
                        });

                        const Row = (d: any, i: number) => {
                          const dDone = isDone(d, customStatuses);
                          const isDeleted = d.isDeleted;

                          return (
                            <motion.button
                              key={d.id || i}
                              type="button"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04, duration: 0.22 }}
                              onClick={() => {
                                if (!isDeleted) handleFocusNode(d.id);
                              }}
                              onMouseEnter={(e) => {
                                if (!isDeleted) {
                                  e.currentTarget.style.transform = 'translateX(3px)';
                                  e.currentTarget.style.background = 'rgba(15,23,42,0.05)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateX(0)';
                                e.currentTarget.style.background = 'transparent';
                              }}
                              title={isDeleted ? 'This node was deleted' : 'Click to fly to this dependency node'}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '7px 8px',
                                borderRadius: 9,
                                border: 'none',
                                background: 'transparent',
                                cursor: isDeleted ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                opacity: isDeleted ? 0.6 : 1,
                                transition: 'transform 140ms ease, background 140ms ease',
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  background: dDone ? '#10b981' : '#f59e0b',
                                  boxShadow: dDone ? '0 0 0 3px rgba(16,185,129,0.18)' : '0 0 0 3px rgba(245,158,11,0.18)',
                                }}
                              />
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {d.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                  color: '#64748b',
                                }}
                              >
                                #{d.id}
                              </span>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  letterSpacing: 0.4,
                                  color: dDone ? '#059669' : '#b45309',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: dDone ? '#d1fae5' : '#fef3c7',
                                }}
                              >
                                {dDone ? 'DONE' : 'PENDING'}
                              </span>
                            </motion.button>
                          );
                        };

                        return (
                          <div style={{ marginTop: 16 }} className="space-y-3 pt-2 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: '#64748b' }}>
                                TASK DEPENDENCIES & LOCK
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setLockModalNodeId(node.id);
                                  const raw = Array.from(new Set([...(node.lockDependencies || []), ...(node.blockedBy || [])].map(String)));
                                  setDraftDependencies(raw);
                                  setActiveView('mindmap');
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#2563eb',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {nodeLocked || deps.length > 0 ? 'Edit Dependencies' : '+ Add Dependencies'}
                              </button>
                            </div>

                            {!nodeLocked && deps.length === 0 ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justify: 'space-between',
                                  gap: 8,
                                  padding: '10px 12px',
                                  borderRadius: 12,
                                  border: '1px dashed rgba(148,163,184,0.45)',
                                  background: 'rgba(148,163,184,0.06)',
                                }}
                              >
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                  Unlocked (No dependencies)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLockModalNodeId(node.id);
                                    const raw = Array.from(new Set([...(node.lockDependencies || []), ...(node.blockedBy || [])].map(String)));
                                    setDraftDependencies(raw);
                                    setActiveView('mindmap');
                                  }}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(37,99,235,0.4)',
                                    background: 'rgba(37,99,235,0.08)',
                                    color: '#2563eb',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Lock this node
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  padding: 12,
                                  borderRadius: 14,
                                  border: nodeLocked
                                    ? '1px solid rgba(217,119,6,0.35)'
                                    : '1px solid rgba(16,185,129,0.35)',
                                  background: nodeLocked
                                    ? 'linear-gradient(180deg, rgba(254,243,199,0.55), rgba(255,251,235,0.35))'
                                    : 'linear-gradient(180deg, rgba(209,250,229,0.45), rgba(240,253,244,0.25))',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justify: 'space-between',
                                    marginBottom: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '3px 9px',
                                      borderRadius: 999,
                                      background: nodeLocked ? '#d97706' : '#10b981',
                                      color: '#fff',
                                      fontSize: 10,
                                      fontWeight: 800,
                                      letterSpacing: 0.6,
                                    }}
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <rect x="3" y="11" width="18" height="11" rx="2" />
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    {nodeLocked ? 'LOCKED' : 'ALL DEPS DONE'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: nodeLocked ? '#92400e' : '#065f46',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {done}/{total} done
                                  </span>
                                </div>

                                {total > 0 && (
                                  <div
                                    style={{
                                      height: 6,
                                      borderRadius: 999,
                                      background: 'rgba(146,64,14,0.12)',
                                      overflow: 'hidden',
                                      marginBottom: 10,
                                    }}
                                  >
                                    <motion.div
                                      animate={{ width: `${pct}%` }}
                                      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                                      style={{
                                        height: '100%',
                                        borderRadius: 999,
                                        background: nodeLocked
                                          ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                                          : 'linear-gradient(90deg,#10b981,#059669)',
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Predecessors Header & List */}
                                <div
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    letterSpacing: 1.2,
                                    color: nodeLocked ? '#b45309' : '#047857',
                                    marginBottom: 6,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <span>PREDECESSORS (WAITING ON)</span>
                                  <span>{deps.length} TASKS</span>
                                </div>

                                <div
                                  style={{
                                    maxHeight: 168,
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    paddingRight: 2,
                                  }}
                                >
                                  {deps.length === 0 ? (
                                    <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 4px' }}>
                                      No predecessor dependencies.
                                    </div>
                                  ) : (
                                    deps.map((d, i) => Row(d, i))
                                  )}
                                </div>

                                {/* Successors List (Nodes waiting on THIS task) */}
                                {successorNodes.length > 0 && (
                                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                    <div
                                      style={{
                                        fontSize: 9.5,
                                        fontWeight: 800,
                                        letterSpacing: 1.2,
                                        color: '#475569',
                                        marginBottom: 4,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <span>SUCCESSORS (DEPENDS ON THIS)</span>
                                      <span>{successorNodes.length} TASKS</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                      {successorNodes.map((succ) => {
                                        const succDone = isDone(succ, customStatuses);
                                        return (
                                          <button
                                            key={succ.id}
                                            type="button"
                                            onClick={() => handleFocusNode(succ.id)}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 8,
                                              padding: '5px 8px',
                                              borderRadius: 8,
                                              border: 'none',
                                              background: 'transparent',
                                              cursor: 'pointer',
                                              textAlign: 'left',
                                            }}
                                          >
                                            <span
                                              style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: '50%',
                                                background: succ.isLocked ? '#f43f5e' : '#10b981',
                                              }}
                                            />
                                            <span
                                              style={{
                                                flex: 1,
                                                fontSize: 11.5,
                                                fontWeight: 600,
                                                color: '#0f172a',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              {succ.label}
                                            </span>
                                            <span style={{ fontSize: 9.5, color: '#64748b' }}>#{succ.id}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {nodeLocked && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm('Dependencies not complete — unlock anyway?')) {
                                        handleUpdateNode(node.id, {
                                          isLocked: false,
                                          lockDependencies: [],
                                          blockedBy: [],
                                          lockedAt: undefined,
                                        });
                                      }
                                    }}
                                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                    style={{
                                      marginTop: 10,
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: 10,
                                      border: '1px solid rgba(217,119,6,0.5)',
                                      background: 'transparent',
                                      color: '#b45309',
                                      fontSize: 11.5,
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      transition: 'transform 120ms ease',
                                    }}
                                  >
                                    Force unlock
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Due Date & Smart Overdue Detection */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5" htmlFor="inspector-duedate">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Due Date & Deadline
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="inspector-duedate"
                            type="date"
                            disabled={nodeLocked}
                            min={(() => {
                              const d = new Date();
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              return `${year}-${month}-${day}`;
                            })()}
                            value={node.dueDate || ''}
                            onChange={(e) => handleUpdateNode(node.id, { dueDate: e.target.value || undefined })}
                            className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 shadow-3xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${nodeLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          />
                          {node.dueDate && (
                            <button
                              type="button"
                              disabled={nodeLocked}
                              onClick={() => handleUpdateNode(node.id, { dueDate: undefined })}
                              className={`px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-extrabold transition-all shrink-0 ${nodeLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                              title="Clear due date"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notes Box */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Notes & Discussion
                        </label>
                        <textarea
                          value={node.notes || ''}
                          disabled={nodeLocked}
                          onChange={(e) => handleUpdateNode(node.id, { notes: e.target.value })}
                          rows={4}
                          placeholder="Add extensive meeting logs, action items, or descriptions..."
                          className={`w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-900 shadow-3xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none ${nodeLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Excel styling options */}
                      <div className="pt-3.5 border-t border-slate-200 space-y-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Excel Styling Options
                        </span>



                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="block text-[9px] uppercase font-bold text-slate-400">Fill Color</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                id="inspector-fill-color-picker"
                                type="color"
                                value={node.fillColor || '#ffffff'}
                                onChange={(e) => handleUpdateNode(node.id, { fillColor: e.target.value })}
                                className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0 bg-transparent shrink-0"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateNode(node.id, { fillColor: undefined })}
                                className="text-[10px] underline text-slate-500 hover:text-slate-800 cursor-pointer font-semibold border-none bg-transparent"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[9px] uppercase font-bold text-slate-400">Text Color</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                id="inspector-text-color-picker"
                                type="color"
                                value={node.textColor || '#000000'}
                                onChange={(e) => handleUpdateNode(node.id, { textColor: e.target.value })}
                                className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0 bg-transparent shrink-0"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateNode(node.id, { textColor: undefined })}
                                className="text-[10px] underline text-slate-500 hover:text-slate-800 cursor-pointer font-semibold border-none bg-transparent"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <span className="block text-[9px] uppercase font-bold text-slate-400">Border Style</span>
                            <select
                              value={node.borderStyle || 'solid'}
                              onChange={(e) => handleUpdateNode(node.id, { borderStyle: e.target.value as any })}
                              className="w-full px-1.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 cursor-pointer outline-none"
                            >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="none">Borderless</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[9px] uppercase font-bold text-slate-400">Border Color</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                id="inspector-border-color-picker"
                                type="color"
                                value={node.borderColor || '#cbd5e1'}
                                onChange={(e) => handleUpdateNode(node.id, { borderColor: e.target.value })}
                                className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0 bg-transparent shrink-0"
                                disabled={node.borderStyle === 'none'}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateNode(node.id, { borderColor: undefined })}
                                className="text-[10px] underline text-slate-500 hover:text-slate-800 cursor-pointer font-semibold border-none bg-transparent"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3">
                          <button
                            id="btn-apply-branch-color"
                            type="button"
                            onClick={() => handlePaintBranch(node.id)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Palette className="w-4 h-4 text-slate-500" />
                            <span>Apply Color to Entire Branch</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ACTION FOOTER */}
                    <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 flex gap-3 z-[100]" style={{ boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <button
                        id="btn-add-sibling"
                        type="button"
                        disabled={false}
                        className="flex-1 bg-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all text-sm hover:bg-gray-50 cursor-pointer"
                        style={{
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          display: 'block',
                          visibility: 'visible',
                          opacity: 1,
                          cursor: 'pointer'
                        }}
                      >
                        {isRoot ? '+ New Root' : '+ Sibling'}
                      </button>
                      <button
                        id="btn-add-child"
                        type="button"
                        className="flex-1 font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all text-sm cursor-pointer"
                        style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'block', visibility: 'visible', opacity: 1 }}
                      >
                        + Child
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
      </main>



      {/* --- 6. SANDBOX-SAFE RESET CONFIRMATION DIALOG --- */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Reset Workspace?</h3>
                <p className="text-xs text-slate-500 font-medium">You can still use Undo (Ctrl+Z) to restore it if needed.</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Are you sure you want to reset the current mind map? All nodes will be replaced with the default agentic pipeline template.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border-none"
              >
                Yes, Reset Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 7. AUTO-UNLOCK TOAST NOTIFICATIONS --- */}
      {unlockedToasts.length > 0 && (
        <div className="fixed bottom-12 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full">
          {unlockedToasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-2xl border border-slate-800 dark:border-slate-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🔓</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold font-sans">Task Unlocked!</span>
                  <span className="text-[10px] opacity-80 leading-snug line-clamp-1">{toast.title}</span>
                </div>
              </div>
              <button
                onClick={() => setUnlockedToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="p-1 rounded-md hover:bg-slate-800 dark:hover:bg-slate-100 text-slate-400 hover:text-slate-200 dark:hover:text-slate-700 border-none bg-transparent cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- 8. MULTI-DEPENDENCY MODAL --- */}
      {dependencyModalNodeId && (
        <DependencyModal
          isOpen={true}
          onClose={() => {
            setDependencyModalNodeId(null);
            setDraftDependencies([]);
          }}
          currentNodeId={dependencyModalNodeId}
          allNodes={nodes}
          customStatuses={customStatuses}
          draftDependencies={draftDependencies}
          onSave={() => {
            handleUpdateNode(dependencyModalNodeId, { blockedBy: draftDependencies });
            setDependencyModalNodeId(null);
            setDraftDependencies([]);
          }}
        />
      )}

      {/* --- 9. DEPENDENCY-BASED LOCK MODAL --- */}
      {lockModalNodeId && (
        <DependencyLockModal
          isOpen={true}
          nodeId={lockModalNodeId}
          allNodes={nodes}
          customStatuses={customStatuses}
          draftDependencies={draftDependencies}
          onConfirm={() => {
            // Set node as locked and sync custom status dependencies
            handleUpdateNode(lockModalNodeId, {
              isLocked: true,
              lockedAt: Date.now(),
              lockDependencies: draftDependencies,
              blockedBy: draftDependencies, // Sync with blockedBy so existing logic integrates flawlessly
            });
            setLockModalNodeId(null);
            setDraftDependencies([]);
          }}
          onCancel={() => {
            setLockModalNodeId(null);
            setDraftDependencies([]);
          }}
        />
      )}

      {/* 4. Footer Bar */}
      <footer className={`h-8 border-t flex items-center justify-between px-4 text-[11px] select-none shrink-0 transition-colors duration-300 ${
        activeTheme.isDark 
          ? 'bg-[#10121a] text-slate-400 border-slate-800' 
          : 'bg-white text-[#64748B] border-[#E2E8F0]'
      }`}>
        <div>
          Ready to map • <strong>{nodes.length}</strong> nodes tracked • <strong>4</strong> contributors online
        </div>
        <div className="flex gap-4">
          <span>Cursor: (Active)</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Operational
          </span>
        </div>
      </footer>

    </div>
  );
}
