import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, Link } from 'lucide-react';
import { MindMapNode, CustomStatus } from '../types';
import { isDone, lockProgress } from '../utils/lockHelpers';
import { isNodeLocked } from '../utils/dependencies';

interface FloatingActionMenuProps {
  node: MindMapNode;
  allNodes?: MindMapNode[];
  customStatuses?: CustomStatus[];
  focusNode?: (id: string) => void;
  onFocusNode?: (id: string) => void;
  onForceUnlock?: (nodeId: string) => void;
  onStartLockSelection?: () => void;
  onRequestUnlock?: () => void;
  onOpenDependencyModal?: () => void;
  onStartLinking: () => void;
  onStartEdit?: () => void;
  onDelete?: () => void;
}

export default function FloatingActionMenu({
  node,
  allNodes = [],
  customStatuses = [],
  focusNode,
  onFocusNode,
  onForceUnlock,
  onStartLockSelection,
  onRequestUnlock,
  onStartLinking,
}: FloatingActionMenuProps) {
  const [showPopover, setShowPopover] = useState(false);

  const handleFocus = onFocusNode || focusNode;

  const nodeWidth = 220;
  const bubbleSize = 36; // 36px circle
  const gap = 10; // 10px gap
  
  const menuWidth = (bubbleSize * 2) + gap; // 82px
  const menuHeight = bubbleSize;
  const offset = 12; // float 12px above node

  const posX = (nodeWidth - menuWidth) / 2;
  const posY = -menuHeight - offset;

  const isLocked = isNodeLocked(node, allNodes, customStatuses);

  // iOS staggered spring pop-in variants
  const bubble1Variants = {
    hidden: {
      opacity: 0,
      scale: 0.2,
      y: 10,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.34, 1.56, 0.64, 1], // iOS cubic-bezier spring
        delay: 0,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.2,
      y: 10,
      transition: {
        duration: 0.18,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  const bubble2Variants = {
    hidden: {
      opacity: 0,
      scale: 0.2,
      y: 10,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.34, 1.56, 0.64, 1], // iOS cubic-bezier spring
        delay: 0.08, // 80ms stagger
      },
    },
    exit: {
      opacity: 0,
      scale: 0.2,
      y: 10,
      transition: {
        duration: 0.18,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  return (
    <div
      className="absolute pointer-events-auto z-[1000] select-none"
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
        width: `${menuWidth}px`,
        height: `${menuHeight}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${gap}px`,
      }}
    >
      {/* Link / Dependencies Bubble */}
      <motion.button
        type="button"
        variants={bubble1Variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        whileHover={
          isLocked
            ? {}
            : {
                scale: 1.16,
                y: -3,
                rotate: -7,
                boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
              }
        }
        whileTap={
          isLocked
            ? {}
            : {
                scale: 0.88,
                rotate: 0,
              }
        }
        onClick={(e) => {
          e.stopPropagation();
          if (isLocked) return;
          onStartLinking();
        }}
        style={{
          width: `${bubbleSize}px`,
          height: `${bubbleSize}px`,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isLocked ? 'not-allowed' : 'pointer',
          opacity: isLocked ? 0.4 : 1,
          pointerEvents: isLocked ? 'none' : 'auto',
          transformOrigin: 'center bottom',
          transition: 'box-shadow 150ms ease, opacity 150ms ease',
        }}
        className="dark:bg-slate-900 dark:border-slate-700/80"
        title={isLocked ? 'Locked — linking disabled' : 'Connect direct links to other nodes'}
      >
        <Link style={{ width: '17px', height: '17px', strokeWidth: 2.2 }} className="text-[#111827] dark:text-slate-100" />
      </motion.button>

      {/* Lock / Unlock Bubble */}
      <motion.button
        type="button"
        variants={bubble2Variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        whileHover={{
          scale: 1.16,
          y: -3,
          rotate: 7, // +7deg tilt
          boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
        }}
        whileTap={{
          scale: 0.88, // iOS press squish
          rotate: 0,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isLocked) {
            setShowPopover(!showPopover);
            if (onRequestUnlock) onRequestUnlock();
          } else {
            if (onStartLockSelection) onStartLockSelection();
          }
        }}
        style={{
          width: `${bubbleSize}px`,
          height: `${bubbleSize}px`,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transformOrigin: 'center bottom',
          transition: 'box-shadow 150ms ease',
        }}
        className="dark:bg-slate-900 dark:border-slate-700/80"
        title={isLocked ? 'View dependencies / Force unlock' : 'Lock task editing'}
      >
        {isLocked ? (
          <Unlock style={{ width: '17px', height: '17px', strokeWidth: 2.2 }} className="text-amber-500 dark:text-amber-400" />
        ) : (
          <Lock style={{ width: '17px', height: '17px', strokeWidth: 2.2 }} className="text-[#111827] dark:text-slate-100" />
        )}
      </motion.button>

      {/* CODE 4 - LOCK-BUBBLE POPOVER */}
      {isLocked && showPopover && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
              width: 240, padding: 10, borderRadius: 14, background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 18px 40px rgba(15,23,42,0.18)'
            }}
          >
            {(() => {
              const { deps, done, total } = lockProgress(node, allNodes);
              return (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, color: '#b45309', marginBottom: 6 }}>
                    WAITING ON · {done}/{total}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 180, overflowY: 'auto' }}>
                    {deps.map((d: any) => (
                      <button key={d.id} type="button" onClick={() => handleFocus?.(d.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,23,42,0.05)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 9,
                          border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%',
                          background: isDone(d) ? '#10b981' : '#94a3b8',
                          boxShadow: isDone(d) ? '0 0 0 3px rgba(16,185,129,0.18)' : 'none' }} />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#0f172a',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: isDone(d) ? '#059669' : '#b45309' }}>
                          {isDone(d) ? 'DONE' : 'PENDING'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => {
                      if (window.confirm('Dependencies not complete — unlock anyway?')) {
                        onForceUnlock?.(node.id);
                        setShowPopover(false);
                      }
                    }}
                    style={{ marginTop: 8, width: '100%', padding: '7px', borderRadius: 9,
                      border: '1px solid rgba(217,119,6,0.5)', background: 'transparent', color: '#b45309',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                    Force unlock
                  </button>
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
