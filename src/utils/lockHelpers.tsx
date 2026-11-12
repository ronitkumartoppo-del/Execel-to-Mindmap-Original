import React from 'react';
import { CustomStatus } from '../types';

export function isManagerNode(node: any, all: any[]): boolean {
  if (!node) return false;
  const isRoot = node?.parentId === null || node?.parentId === undefined;
  const hasChildren = (all || []).some((n: any) => n.parentId === node.id && !n.isDeleted);
  return isRoot || hasChildren;
}

export function isLeafDone(n: any): boolean {
  if (!n) return false;
  if (n.isDeleted) return true;
  const s = String(n?.status ?? '').trim().toUpperCase();
  return s === 'DONE' || s === 'COMPLETE' || s === 'COMPLETED' || s === 'FINISHED'
    || n?.isComplete === true || n?.isDone === true;
}

export function allLeavesDone(node: any, all: any[]): boolean {
  const children = (all || []).filter((n: any) => n.parentId === node.id && !n.isDeleted);
  if (children.length === 0) return isLeafDone(node);
  return children.every((c) => allLeavesDone(c, all));
}

export function getManagerStatus(node: any, all: any[]): string {
  if (node?.manualBlocked === true || String(node?.status ?? '').toUpperCase() === 'BLOCKED') return 'BLOCKED';
  const hasChildren = (all || []).some((n: any) => n.parentId === node.id && !n.isDeleted);
  if (!hasChildren) return 'STAND BY';
  return allLeavesDone(node, all) ? 'DONE' : 'IN PROGRESS';
}

export function isNodeDone(node: any, all: any[]): boolean {
  if (!node) return false;
  return isManagerNode(node, all) ? getManagerStatus(node, all) === 'DONE' : isLeafDone(node);
}

export function ManagerStatusPill({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'STAND BY':    { background: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1' },
    'IN PROGRESS': { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' },
    'DONE':        { background: '#d1fae5', color: '#047857', border: '1px solid #6ee7b7' },
    'BLOCKED':     { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      ...(styles[status] || styles['STAND BY'])
    }}>
      {status}
    </span>
  );
}

const DONE_LABELS = ['done', 'complete', 'completed', 'finished'];

export const isDone = (n: any, customStatuses?: CustomStatus[], allNodes?: any[]): boolean => {
  if (!n) return false;
  if (n.isDeleted) return true;
  if (allNodes && allNodes.length > 0) {
    return isNodeDone(n, allNodes);
  }
  return isLeafDone(n);
};

// Resolve dependency ids -> node objects, creating placeholder for deleted nodes
export const resolveLockDeps = (node: any, allNodes: any[]): any[] => {
  if (!node) return [];
  const rawIds: string[] = [
    ...(node.lockDependencies || []),
    ...(node.blockedBy || []),
  ].map(String);
  
  const uniqueIds = Array.from(new Set(rawIds));

  return uniqueIds.map((id: string) => {
    const found = allNodes.find((n: any) => String(n.id) === id);
    if (found) return found;
    return {
      id,
      label: `[Removed Task #${id}]`,
      isDeleted: true,
      status: 'Done',
    };
  });
};

export const lockProgress = (node: any, allNodes: any[], customStatuses?: CustomStatus[]) => {
  const deps = resolveLockDeps(node, allNodes);
  const done = deps.filter((d) => isNodeDone(d, allNodes)).length;
  return { deps, done, total: deps.length, pct: deps.length ? Math.round((done / deps.length) * 100) : 0 };
};

// Click-to-focus: pan the camera + throw a one-shot ring on the target node.
export function useNodeFocus(centerViewportOn?: (id: string) => void) {
  const [pingNodeId, setPingNodeId] = React.useState<string | null>(null);
  const nonce = React.useRef(0);
  const focusNode = React.useCallback((id: string) => {
    try { centerViewportOn?.(id); } catch {}
    nonce.current += 1;
    setPingNodeId(String(id));
    window.setTimeout(() => setPingNodeId(null), 1400);
  }, [centerViewportOn]);
  return { focusNode, pingNodeId, nonce: nonce.current };
}

