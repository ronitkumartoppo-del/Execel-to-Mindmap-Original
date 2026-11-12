import { MindMapNode, CustomStatus } from '../types';
import { isDone, isNodeDone, getManagerStatus, isManagerNode } from './lockHelpers';

export const DONE_STATUS_LABELS = ['done', 'complete', 'completed', 'finished'];

export function isStatusDone(node: MindMapNode, customStatuses?: CustomStatus[]): boolean {
  return isDone(node, customStatuses);
}

export function wouldCreateCycle(
  nodeId: string,
  candidateId: string,
  allNodes: MindMapNode[]
): boolean {
  if (nodeId === candidateId) return true;

  const visited = new Set<string>();
  const queue = [candidateId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === nodeId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = allNodes.find((n) => n.id === currentId);
    if (currentNode) {
      const deps = currentNode.lockDependencies || currentNode.blockedBy || [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          queue.push(depId);
        }
      }
    }
  }

  return false;
}

export function evaluateUpdatedLocks(
  nodes: MindMapNode[],
  customStatuses?: CustomStatus[]
): { updatedNodes: MindMapNode[]; unlockedNodeIds: string[] } {
  let changed = false;
  const unlockedNodeIds: string[] = [];

  const updatedNodes = nodes.map((node) => {
    const currentDeps = Array.from(
      new Set([
        ...(node.lockDependencies || []),
        ...(node.blockedBy || []),
      ].map(String))
    );

    // Filter to valid dependencies that exist in nodes array
    const validDeps = currentDeps.filter((depId) => nodes.some((n) => String(n.id) === depId));

    // Check if any valid dependency is NOT done
    const hasIncompleteDeps = validDeps.some((depId) => {
      const depNode = nodes.find((n) => String(n.id) === depId);
      return depNode ? !isNodeDone(depNode, nodes) : false;
    });

    const shouldBeLocked = validDeps.length > 0 && hasIncompleteDeps;

    const lockStateChanged = !!node.isLocked !== shouldBeLocked;
    const depsChanged =
      JSON.stringify(node.lockDependencies || []) !== JSON.stringify(validDeps) ||
      JSON.stringify(node.blockedBy || []) !== JSON.stringify(validDeps);

    if (lockStateChanged || depsChanged) {
      changed = true;
      if (node.isLocked && !shouldBeLocked && validDeps.length > 0) {
        unlockedNodeIds.push(node.id);
      }
      return {
        ...node,
        isLocked: shouldBeLocked,
        lockDependencies: validDeps,
        blockedBy: validDeps,
        lockedAt: shouldBeLocked ? node.lockedAt || Date.now() : undefined,
      };
    }

    return node;
  });

  return { updatedNodes: changed ? updatedNodes : nodes, unlockedNodeIds };
}

export function evaluateParentStatuses(
  nodes: MindMapNode[],
  customStatuses?: CustomStatus[]
): MindMapNode[] {
  let currentNodes = [...nodes];
  let overallChanged = false;

  for (let pass = 0; pass < 10; pass++) {
    let passChanged = false;
    currentNodes = currentNodes.map((node) => {
      if (!isManagerNode(node, currentNodes)) {
        return node;
      }

      const targetStatus = getManagerStatus(node, currentNodes);

      if (targetStatus !== node.status) {
        passChanged = true;
        overallChanged = true;
        return {
          ...node,
          status: targetStatus,
        };
      }

      return node;
    });

    if (!passChanged) break;
  }

  return overallChanged ? currentNodes : nodes;
}


