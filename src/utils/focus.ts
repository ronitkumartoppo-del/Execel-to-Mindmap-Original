import { MindMapNode } from '../types';

/**
 * Helper to check if a node is overdue or due today
 */
export const isNodeOverdueOrToday = (node: MindMapNode): boolean => {
  if (!node.dueDate) return false;
  const due = new Date(node.dueDate);
  if (isNaN(due.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  
  return dueDay.getTime() <= today.getTime();
};

/**
 * Helper to check if a node is completed
 */
export const isNodeCompleted = (node: MindMapNode): boolean => {
  return String(node.status || '').toUpperCase().trim() === 'DONE';
};

/**
 * Core criteria for a node to trigger focus.
 * A node meets Focus Criteria if:
 * - Priority = "HIGH"
 * - Due Date = Today or Overdue
 * - Status = "IN PROGRESS"
 */
export const isNodeInFocusCriteria = (node: MindMapNode): boolean => {
  const priorityUpper = String(node.priority || '').toUpperCase().trim();
  const statusUpper = String(node.status || '').toUpperCase().trim();

  // 1. Priority = "HIGH"
  if (priorityUpper === 'HIGH') return true;

  // 2. Status = "IN PROGRESS"
  if (statusUpper === 'IN PROGRESS' || statusUpper === 'IN_PROGRESS') return true;

  // 3. Due Date is today or overdue (today or earlier)
  if (node.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(node.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    if (!isNaN(dueDate.getTime()) && dueDate.getTime() <= today.getTime()) {
      return true;
    }
  }

  return false;
};

/**
 * Calculates which node IDs should be visible during Focus Mode.
 * Rules:
 * - A node is visible if it meets isNodeInFocusCriteria itself.
 * - If a node is visible, all its ancestors up to the root must remain visible so the hierarchy isn't disconnected.
 */
export const getVisibleNodeIdsInFocusMode = (allNodes: MindMapNode[]): Set<string> => {
  const visibleIds = new Set<string>();

  // 1. Find all base focus nodes
  const baseFocusNodes = allNodes.filter(isNodeInFocusCriteria);

  // 2. For each focused node, add itself and all its ancestors to the visible set
  const addNodeAndAncestors = (nodeId: string) => {
    let currentId: string | null = nodeId;
    while (currentId) {
      if (visibleIds.has(currentId)) break;
      visibleIds.add(currentId);
      const node = allNodes.find(n => n.id === currentId);
      currentId = node ? node.parentId : null;
    }
  };

  for (const node of baseFocusNodes) {
    addNodeAndAncestors(node.id);
  }

  // Always keep root node (parentId === null) visible for context if there are any nodes visible
  if (visibleIds.size > 0) {
    const rootNode = allNodes.find(n => n.parentId === null);
    if (rootNode) {
      visibleIds.add(rootNode.id);
    }
  }

  return visibleIds;
};

/**
 * Checks if a node should be visible based on focus mode state and filtering criteria.
 * - If isFocusMode is FALSE, returns TRUE.
 * - If isFocusMode is TRUE, returns TRUE if the node is visible per focus filtering rules (including parent context).
 */
export const shouldNodeBeVisible = (
  node: MindMapNode,
  allNodes: MindMapNode[],
  isFocusMode: boolean
): boolean => {
  if (!isFocusMode) return true;
  const visibleIds = getVisibleNodeIdsInFocusMode(allNodes);
  return visibleIds.has(node.id);
};
