import { MindMapNode, Priority } from '../types';

/**
 * Checks if a target node is a descendant of a potential parent node.
 * Useful to prevent circular references in parent selection.
 */
export function isDescendant(
  nodeId: string,
  potentialParentId: string,
  nodes: MindMapNode[]
): boolean {
  if (nodeId === potentialParentId) return true;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  let current = nodeMap.get(potentialParentId);
  while (current && current.parentId) {
    if (current.parentId === nodeId) {
      return true;
    }
    current = nodeMap.get(current.parentId);
  }

  return false;
}

/**
 * Comprehensive Multi-Geometry Layout Engine.
 * Supports exactly 40 distinct layouts.
 */
export function calculateTreeLayout(
  nodes: MindMapNode[],
  layoutType: string = 'right-sided'
): MindMapNode[] {
  if (nodes.length === 0) return [];

  // 1. Create clones and clean mapping
  const nodeMap = new Map<string, MindMapNode>();
  nodes.forEach((n) => {
    nodeMap.set(n.id, {
      ...n,
      collapsed: false, // Force false during positioning math to reserve space for all nodes
      x: n.x || 0,
      y: n.y || 0,
      subtreeHeight: 1,
    });
  });

  // 2. Build parent-child relationships
  const childrenMap = new Map<string, MindMapNode[]>();
  const roots: MindMapNode[] = [];

  nodeMap.forEach((n) => {
    if (!n.parentId || !nodeMap.has(n.parentId)) {
      n.parentId = null; // Normalize root
      roots.push(n);
    } else {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n);
      childrenMap.set(n.parentId, list);
    }
  });

  // Ensure there is at least one root
  if (roots.length === 0 && nodes.length > 0) {
    const firstNode = nodeMap.get(nodes[0].id);
    if (firstNode) {
      firstNode.parentId = null;
      roots.push(firstNode);
    }
  }

  // Pre-calculate visible subtree leaf counts (weights) for hierarchical spacing
  function calculateWeights(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;

    if (node.collapsed) {
      node.subtreeHeight = 1;
      return 1;
    }

    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      node.subtreeHeight = 1;
      return 1;
    }

    let totalWeight = 0;
    children.forEach((child) => {
      totalWeight += calculateWeights(child.id);
    });
    node.subtreeHeight = totalWeight;
    return totalWeight;
  }

  roots.forEach((root) => calculateWeights(root.id));

  // Determine Node Depth helper
  function getNodeDepth(nodeId: string): number {
    let depth = 0;
    let curr = nodeMap.get(nodeId);
    while (curr && curr.parentId && nodeMap.has(curr.parentId)) {
      depth++;
      curr = nodeMap.get(curr.parentId);
    }
    return depth;
  }

  // List of all nodes under a parent (recursive visible list)
  function getVisibleDescendants(nodeId: string): string[] {
    const list: string[] = [];
    const node = nodeMap.get(nodeId);
    if (!node || node.collapsed) return list;

    const children = childrenMap.get(nodeId) || [];
    children.forEach((c) => {
      list.push(c.id);
      list.push(...getVisibleDescendants(c.id));
    });
    return list;
  }

  // --- IMPLEMENTATION OF THE 40 GEOMETRICAL LAYOUTS ---

  switch (layoutType) {
    // ==========================================
    // CATEGORY A: RADIAL & STANDARD (Layouts 1-6)
    // ==========================================

    case 'radial': {
      // 1. Balanced Radial Starburst (360° trigonometric distribution)
      const centerX = 650;
      const centerY = 450;

      roots.forEach((root, rIdx) => {
        root.x = centerX + rIdx * 350;
        root.y = centerY;

        function assignRadial(nodeId: string, angleStart: number, angleEnd: number, depth: number) {
          const node = nodeMap.get(nodeId);
          if (!node) return;

          const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
          if (children.length === 0) return;

          const totalWeight = children.reduce((sum, c) => sum + (c.subtreeHeight || 1), 0);
          let currentAngle = angleStart;
          const sectorSize = angleEnd - angleStart;
          const radius = 180 + (depth - 1) * 160;

          children.forEach((child) => {
            const childWeight = child.subtreeHeight || 1;
            const childAngleSize = (childWeight / totalWeight) * sectorSize;
            const childAngle = currentAngle + childAngleSize / 2;

            child.x = node.x! + radius * Math.cos(childAngle);
            child.y = node.y! + radius * Math.sin(childAngle);

            assignRadial(child.id, currentAngle, currentAngle + childAngleSize, depth + 1);
            currentAngle += childAngleSize;
          });
        }

        assignRadial(root.id, 0, 2 * Math.PI, 1);
      });
      break;
    }

    case 'right-sided': {
      // 2. Right-Sided Tree Expansion (Root on far-left, grows right)
      const startX = 120;
      let currentY = 100;

      function assignRightSided(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.x = startX + depth * 280;
        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (children.length === 0) {
          node.y = currentY;
          currentY += 85;
        } else {
          const firstChildY = currentY;
          children.forEach((child) => {
            assignRightSided(child.id, depth + 1);
          });
          const lastChildY = currentY - 85;
          node.y = (firstChildY + lastChildY) / 2;
        }
      }

      roots.forEach((root) => {
        assignRightSided(root.id, 0);
        currentY += 40;
      });
      break;
    }

    case 'left-sided': {
      // 3. Left-Sided Tree Expansion (Root on far-right, grows left)
      const rightX = 1100;
      let currentY = 100;

      function assignLeftSided(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.x = rightX - depth * 280;
        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (children.length === 0) {
          node.y = currentY;
          currentY += 85;
        } else {
          const firstChildY = currentY;
          children.forEach((child) => {
            assignLeftSided(child.id, depth + 1);
          });
          const lastChildY = currentY - 85;
          node.y = (firstChildY + lastChildY) / 2;
        }
      }

      roots.forEach((root) => {
        assignLeftSided(root.id, 0);
        currentY += 40;
      });
      break;
    }

    case 'dual-wing': {
      // 4. Symmetrical Dual-Wing Split
      const centerX = 600;

      roots.forEach((root) => {
        root.x = centerX;
        const children = childrenMap.get(root.id) || [];
        if (children.length === 0) {
          root.y = 350;
          return;
        }

        const leftChildren: MindMapNode[] = [];
        const rightChildren: MindMapNode[] = [];
        children.forEach((child, idx) => {
          if (idx % 2 === 0) {
            rightChildren.push(child);
          } else {
            leftChildren.push(child);
          }
        });

        let rightY = 100;
        function assignRightWing(nodeId: string, depth: number) {
          const node = nodeMap.get(nodeId);
          if (!node) return;
          node.x = centerX + depth * 280;
          const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

          if (kids.length === 0) {
            node.y = rightY;
            rightY += 85;
          } else {
            const startY = rightY;
            kids.forEach((k) => assignRightWing(k.id, depth + 1));
            const endY = rightY - 85;
            node.y = (startY + endY) / 2;
          }
        }

        let leftY = 100;
        function assignLeftWing(nodeId: string, depth: number) {
          const node = nodeMap.get(nodeId);
          if (!node) return;
          node.x = centerX - depth * 280;
          const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

          if (kids.length === 0) {
            node.y = leftY;
            leftY += 85;
          } else {
            const startY = leftY;
            kids.forEach((k) => assignLeftWing(k.id, depth + 1));
            const endY = leftY - 85;
            node.y = (startY + endY) / 2;
          }
        }

        rightChildren.forEach((child) => assignRightWing(child.id, 1));
        leftChildren.forEach((child) => assignLeftWing(child.id, 1));

        const maxWingY = Math.max(rightY, leftY);
        root.y = maxWingY / 2;
      });
      break;
    }

    case 'cloud-cluster': {
      // 5. Freeform Cloud Cluster (Organic circular layout)
      const centerX = 600;
      const centerY = 450;
      const allNodes = Array.from(nodeMap.values());

      allNodes.forEach((node, idx) => {
        if (node.parentId === null) {
          node.x = centerX;
          node.y = centerY;
        } else {
          const depth = getNodeDepth(node.id);
          const angle = (idx / (allNodes.length || 1)) * 2 * Math.PI;
          const radius = 130 + depth * 120;
          node.x = centerX + radius * Math.cos(angle) + Math.sin(idx * 1.5) * 20;
          node.y = centerY + radius * Math.sin(angle) + Math.cos(idx * 1.5) * 20;
        }
      });
      break;
    }

    case 'concentric-rings': {
      // 6. Concentric Orbital Rings
      const centerX = 600;
      const centerY = 450;

      roots.forEach((root, rIdx) => {
        root.x = centerX + rIdx * 350;
        root.y = centerY;
      });

      const depthMap = new Map<number, MindMapNode[]>();
      nodeMap.forEach((node) => {
        const depth = getNodeDepth(node.id);
        if (depth > 0) {
          const list = depthMap.get(depth) || [];
          list.push(node);
          depthMap.set(depth, list);
        }
      });

      depthMap.forEach((nodesAtDepth, depth) => {
        const count = nodesAtDepth.length;
        const radius = depth * 180;
        nodesAtDepth.sort((a, b) => (a.parentId || '').localeCompare(b.parentId || ''));

        nodesAtDepth.forEach((node, idx) => {
          const angle = (idx / count) * 2 * Math.PI;
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        });
      });
      break;
    }

    // ===================================================
    // CATEGORY B: HIERARCHICAL & STRUCTURAL (Layouts 7-14)
    // ===================================================

    case 'top-down': {
      // 7. Top-Down Corporate Org Chart
      const startY = 80;
      let currentX = 150;

      function assignTopDown(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.y = startY + depth * 160;
        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (children.length === 0) {
          node.x = currentX;
          currentX += 250;
        } else {
          const firstChildX = currentX;
          children.forEach((child) => {
            assignTopDown(child.id, depth + 1);
          });
          const lastChildX = currentX - 250;
          node.x = (firstChildX + lastChildX) / 2;
        }
      }

      roots.forEach((root) => {
        assignTopDown(root.id, 0);
        currentX += 80;
      });
      break;
    }

    case 'bottom-up': {
      // 8. Bottom-Up Inverted Tree
      const startY = 650;
      let currentX = 150;

      function assignBottomUp(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.y = startY - depth * 160;
        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (children.length === 0) {
          node.x = currentX;
          currentX += 250;
        } else {
          const firstChildX = currentX;
          children.forEach((child) => {
            assignBottomUp(child.id, depth + 1);
          });
          const lastChildX = currentX - 250;
          node.x = (firstChildX + lastChildX) / 2;
        }
      }

      roots.forEach((root) => {
        assignBottomUp(root.id, 0);
        currentX += 80;
      });
      break;
    }

    case 'block-90': {
      // 9. Rigid 90-Degree Technical Block Chart
      let rowIdx = 0;

      function assignBlock90(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.x = 120 + depth * 260;
        node.y = 100 + rowIdx * 90;

        const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
        if (kids.length === 0) {
          rowIdx++;
        } else {
          kids.forEach((child) => {
            assignBlock90(child.id, depth + 1);
          });
          const childNodes = kids.map(k => nodeMap.get(k.id)).filter(Boolean) as MindMapNode[];
          if (childNodes.length > 0) {
            node.y = (childNodes[0].y! + childNodes[childNodes.length - 1].y!) / 2;
          }
        }
      }

      roots.forEach((root) => {
        assignBlock90(root.id, 0);
        rowIdx++;
      });
      break;
    }

    case 'bracket': {
      // 10. Bracket / Brace Map
      let currentY = 100;

      function assignBracket(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.x = 100 + depth * 270;
        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (children.length === 0) {
          node.y = currentY;
          currentY += 85;
        } else {
          const firstY = currentY;
          children.forEach((child) => {
            assignBracket(child.id, depth + 1);
          });
          const lastY = currentY - 85;
          node.y = (firstY + lastY) / 2;
        }
      }

      roots.forEach((root) => {
        assignBracket(root.id, 0);
        currentY += 40;
      });
      break;
    }

    case 'pyramid': {
      // 11. Divided Layered Pyramid Hierarchy (Narrow top, wide base, staggered layers)
      const centerX = 600;
      const startY = 100;

      const levels: Map<number, MindMapNode[]> = new Map();
      nodeMap.forEach((node) => {
        const d = getNodeDepth(node.id);
        const list = levels.get(d) || [];
        list.push(node);
        levels.set(d, list);
      });

      levels.forEach((lvlNodes, depth) => {
        const count = lvlNodes.length;
        const y = startY + depth * 140;
        // Distribute horizontally
        const layerWidth = 180 + depth * 220;
        lvlNodes.forEach((node, idx) => {
          node.y = y;
          if (count === 1) {
            node.x = centerX;
          } else {
            node.x = centerX - (layerWidth / 2) + (idx / (count - 1)) * layerWidth;
          }
        });
      });
      break;
    }

    case 'funnel': {
      // 12. Funnel Architecture Layout (Wide top, narrow bottom org chart)
      const centerX = 600;
      const startY = 80;

      const levels: Map<number, MindMapNode[]> = new Map();
      nodeMap.forEach((node) => {
        const d = getNodeDepth(node.id);
        const list = levels.get(d) || [];
        list.push(node);
        levels.set(d, list);
      });

      const maxDepth = Math.max(...Array.from(levels.keys()), 0);

      levels.forEach((lvlNodes, depth) => {
        const count = lvlNodes.length;
        const y = startY + depth * 140;
        // Reverse layer width: wider at depth=0, narrower at maxDepth
        const layerWidth = 180 + (maxDepth - depth) * 250;
        lvlNodes.forEach((node, idx) => {
          node.y = y;
          if (count === 1) {
            node.x = centerX;
          } else {
            node.x = centerX - (layerWidth / 2) + (idx / (count - 1)) * layerWidth;
          }
        });
      });
      break;
    }

    case 'diamond-network': {
      // 13. Centralized Diamond Network Diagram (Nodes arranged along diamond outlines)
      const centerX = 600;
      const centerY = 450;

      roots.forEach((root, rIdx) => {
        root.x = centerX + rIdx * 350;
        root.y = centerY;

        function assignDiamond(nodeId: string, depth: number, wing: number) {
          const node = nodeMap.get(nodeId);
          if (!node) return;

          const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
          kids.forEach((child, idx) => {
            // Assign 4 primary axes for depth=1, then branch outward
            const childWing = depth === 0 ? idx % 4 : wing;
            const angle = (childWing * Math.PI) / 2; // 0, 90, 180, 270 deg
            const offsetMultiplier = depth === 0 ? 1 : 1 + (idx - (kids.length - 1) / 2) * 0.35;
            
            const radius = 170 + depth * 140;
            child.x = root.x! + radius * Math.cos(angle) * offsetMultiplier;
            child.y = root.y! + radius * Math.sin(angle) * offsetMultiplier;

            assignDiamond(child.id, depth + 1, childWing);
          });
        }

        assignDiamond(root.id, 0, 0);
      });
      break;
    }

    case 'quad-matrix': {
      // 14. Quad-Quadrant Matrix Grid Layout (Split branches into 4 quadrant regions)
      const centerX = 600;
      const centerY = 400;

      roots.forEach((root) => {
        root.x = centerX;
        root.y = centerY;

        const mainBranches = childrenMap.get(root.id) || [];
        mainBranches.forEach((branch, bIdx) => {
          // Quad indices: 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right
          const quad = bIdx % 4;
          const qx = quad % 2 === 0 ? centerX - 320 : centerX + 320;
          const qy = quad < 2 ? centerY - 200 : centerY + 200;

          branch.x = qx;
          branch.y = qy;

          const kids = getVisibleDescendants(branch.id);
          kids.forEach((kidId, kIdx) => {
            const kid = nodeMap.get(kidId);
            if (kid) {
              // Align in rows of 2 inside the quadrant
              const row = Math.floor(kIdx / 2);
              const col = kIdx % 2;
              kid.x = qx + (col === 0 ? -120 : 120);
              kid.y = qy + 80 + row * 85;
            }
          });
        });
      });
      break;
    }

    // ======================================================
    // CATEGORY C: PROCESS, FLOW & CHRONOLOGY (Layouts 15-22)
    // ======================================================

    case 'horizontal-timeline': {
      // 15. Horizontal Milestone Timeline
      const root = roots[0] || nodeMap.values().next().value;
      if (root) {
        root.x = 100;
        root.y = 350;

        const mainMilestones = childrenMap.get(root.id) || [];
        mainMilestones.forEach((milestone, idx) => {
          milestone.x = 100 + (idx + 1) * 280;
          milestone.y = 350;

          const isEven = idx % 2 === 0;

          let leafOffset = 0;
          function layoutMilestoneBranch(nodeId: string, depth: number) {
            const node = nodeMap.get(nodeId);
            if (!node) return;

            node.x = milestone.x! + leafOffset * 100;
            node.y = isEven ? 350 - depth * 110 : 350 + depth * 110;

            const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
            if (kids.length === 0) {
              leafOffset++;
            } else {
              kids.forEach((k) => layoutMilestoneBranch(k.id, depth + 1));
            }
          }

          const kids = milestone.collapsed ? [] : (childrenMap.get(milestone.id) || []);
          kids.forEach((k) => layoutMilestoneBranch(k.id, 1));
        });

        roots.forEach((r) => {
          if (r.id !== root.id) {
            r.x = 200;
            r.y = 600;
          }
        });
      }
      break;
    }

    case 'vertical-flow': {
      // 16. Vertical Process Flow Cascade
      let currentY = 100;

      function assignVerticalFlow(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.x = 400 + depth * 60;
        node.y = currentY;
        currentY += 95;

        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
        children.forEach((child) => {
          assignVerticalFlow(child.id, depth + 1);
        });
      }

      roots.forEach((root) => {
        assignVerticalFlow(root.id, 0);
        currentY += 50;
      });
      break;
    }

    case 'fishbone-lr': {
      // 17. Left-to-Right Angled Fishbone Diagram
      const root = roots[0];
      if (root) {
        root.x = 1000;
        root.y = 350;

        const mainBones = childrenMap.get(root.id) || [];
        mainBones.forEach((bone, idx) => {
          const spineX = 1000 - (idx + 1) * 220;
          const isEven = idx % 2 === 0;

          bone.x = spineX - 60;
          bone.y = isEven ? 350 - 150 : 350 + 150;

          let descOffset = 0;
          function assignBoneDescendants(nodeId: string, depth: number) {
            const node = nodeMap.get(nodeId);
            if (!node) return;

            node.x = bone.x! - depth * 140;
            node.y = bone.y! + (isEven ? -descOffset * 50 : descOffset * 50);

            const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
            if (kids.length === 0) {
              descOffset++;
            } else {
              kids.forEach((k) => assignBoneDescendants(k.id, depth + 1));
            }
          }

          const kids = bone.collapsed ? [] : (childrenMap.get(bone.id) || []);
          kids.forEach((k) => assignBoneDescendants(k.id, 1));
        });
      }
      break;
    }

    case 'fishbone-rl': {
      // 18. Right-to-Left Angled Fishbone Diagram
      const root = roots[0];
      if (root) {
        root.x = 100;
        root.y = 350;

        const mainBones = childrenMap.get(root.id) || [];
        mainBones.forEach((bone, idx) => {
          const spineX = 100 + (idx + 1) * 220;
          const isEven = idx % 2 === 0;

          bone.x = spineX + 60;
          bone.y = isEven ? 350 - 150 : 350 + 150;

          let descOffset = 0;
          function assignBoneDescendants(nodeId: string, depth: number) {
            const node = nodeMap.get(nodeId);
            if (!node) return;

            node.x = bone.x! + depth * 140;
            node.y = bone.y! + (isEven ? -descOffset * 50 : descOffset * 50);

            const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
            if (kids.length === 0) {
              descOffset++;
            } else {
              kids.forEach((k) => assignBoneDescendants(k.id, depth + 1));
            }
          }

          const kids = bone.collapsed ? [] : (childrenMap.get(bone.id) || []);
          kids.forEach((k) => assignBoneDescendants(k.id, 1));
        });
      }
      break;
    }

    case 'zigzag-workflow': {
      // 19. Zig-Zag Alternating Workflow Path
      const allNodes = Array.from(nodeMap.values());
      allNodes.forEach((node, idx) => {
        const row = Math.floor(idx / 4);
        let col = idx % 4;
        if (row % 2 !== 0) {
          col = 3 - col; // snake horizontal reverse
        }
        node.x = 150 + col * 260;
        node.y = 100 + row * 165;
      });
      break;
    }

    case 'closed-loop': {
      // 20. Circular Closed-Loop Lifecycle System
      const centerX = 600;
      const centerY = 400;
      const allNodes = Array.from(nodeMap.values());
      const total = allNodes.length || 1;

      allNodes.forEach((node, idx) => {
        const angle = (idx / total) * 2 * Math.PI;
        node.x = centerX + 260 * Math.cos(angle);
        node.y = centerY + 260 * Math.sin(angle);
      });
      break;
    }

    case 'flowchart-block': {
      // 21. Standard Flowchart Block Mapping
      let colIdx = 0;
      function assignFlowchart(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.y = 80 + depth * 150;
        const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (kids.length === 0) {
          node.x = 150 + colIdx * 250;
          colIdx++;
        } else {
          const firstX = colIdx;
          kids.forEach((c) => assignFlowchart(c.id, depth + 1));
          const lastX = colIdx - 1;
          node.x = 150 + ((firstX + lastX) / 2) * 250;
        }
      }
      roots.forEach((root) => {
        assignFlowchart(root.id, 0);
        colIdx++;
      });
      break;
    }

    case 'concept-web': {
      // 22. Deep Cross-Linked Concept Relationship Web
      const centerX = 600;
      const centerY = 400;

      roots.forEach((root, rIdx) => {
        root.x = centerX + rIdx * 300;
        root.y = centerY;
      });

      const depthMap = new Map<number, MindMapNode[]>();
      nodeMap.forEach((node) => {
        const depth = getNodeDepth(node.id);
        if (depth > 0) {
          const list = depthMap.get(depth) || [];
          list.push(node);
          depthMap.set(depth, list);
        }
      });

      depthMap.forEach((nodesAtDepth, depth) => {
        const count = nodesAtDepth.length;
        const radius = depth * 160;
        nodesAtDepth.forEach((node, idx) => {
          const angle = (idx / count) * 2 * Math.PI + (depth * 0.2);
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        });
      });
      break;
    }

    // ========================================================
    // CATEGORY D: PREMIUM AGILE & PRODUCTIVITY (Layouts 23-40)
    // ========================================================

    case 'kanban-lanes': {
      // 23. Kanban Board Lanes (Grouped horizontally by Status)
      const statuses = ['Todo', 'In Progress', 'Done', 'Blocked'];
      const statusMap: Record<string, number> = { Todo: 0, 'In Progress': 1, Done: 2, Blocked: 3 };

      const columns: MindMapNode[][] = [[], [], [], []];
      nodeMap.forEach((node) => {
        const s = node.status || 'Todo';
        const idx = statusMap[s] !== undefined ? statusMap[s] : 0;
        columns[idx].push(node);
      });

      columns.forEach((colNodes, colIdx) => {
        const x = 120 + colIdx * 270;
        colNodes.forEach((node, rowIdx) => {
          node.x = x;
          node.y = 120 + rowIdx * 110;
        });
      });
      break;
    }

    case 'priority-quadrants': {
      // 24. Priority Matrix Quadrants (Separated by High/Medium/Low priority fields)
      const priorities: Priority[] = ['High', 'Medium', 'Low'];
      const groups: Record<Priority, MindMapNode[]> = { High: [], Medium: [], Low: [] };

      nodeMap.forEach((node) => {
        groups[node.priority || 'Medium'].push(node);
      });

      // Layout coordinates for quadrants
      // High: Top Left
      groups.High.forEach((node, idx) => {
        node.x = 150 + (idx % 2) * 240;
        node.y = 120 + Math.floor(idx / 2) * 110;
      });
      // Medium: Top Right / Center
      groups.Medium.forEach((node, idx) => {
        node.x = 650 + (idx % 2) * 240;
        node.y = 120 + Math.floor(idx / 2) * 110;
      });
      // Low: Bottom Row / Wide Span
      groups.Low.forEach((node, idx) => {
        node.x = 350 + (idx % 3) * 240;
        node.y = 520 + Math.floor(idx / 3) * 110;
      });
      break;
    }

    case 'value-stream': {
      // 25. Value-Stream Mapping Flow (Horizontal steps with deep columns)
      const root = roots[0];
      if (root) {
        root.x = 100;
        root.y = 150;

        const columnParents = childrenMap.get(root.id) || [];
        columnParents.forEach((colParent, idx) => {
          colParent.x = 100 + (idx + 1) * 260;
          colParent.y = 150;

          // Align deep items directly below this column header step
          const items = getVisibleDescendants(colParent.id);
          items.forEach((itemId, itemIdx) => {
            const itemNode = nodeMap.get(itemId);
            if (itemNode) {
              itemNode.x = colParent.x;
              itemNode.y = 260 + itemIdx * 105;
            }
          });
        });
      }
      break;
    }

    case 'impact-effort': {
      // 26. Impact-Effort 2x2 Spatial Chart
      // High Priority + Done/In Progress -> Quick Wins (Top Right)
      // High Priority + Todo -> Major Projects (Top Left)
      // Low Priority + Done/In Progress -> Fill-ins (Bottom Right)
      // Low Priority + Todo -> Thankless Tasks (Bottom Left)
      Array.from(nodeMap.values()).forEach((node, idx) => {
        const isHighImpact = node.priority === 'High' || node.priority === 'Medium';
        const isLowEffort = node.status === 'Done' || node.status === 'In Progress';

        let qX = 180;
        let qY = 120;

        if (isHighImpact && isLowEffort) {
          qX = 700; qY = 120; // Quick Wins
        } else if (isHighImpact && !isLowEffort) {
          qX = 180; qY = 120; // Major Projects
        } else if (!isHighImpact && isLowEffort) {
          qX = 700; qY = 480; // Fill-ins
        } else {
          qX = 180; qY = 480; // Thankless tasks
        }

        node.x = qX + (idx % 2) * 240;
        node.y = qY + Math.floor(idx / 2) * 90;
      });
      break;
    }

    case 'swimlane-flow': {
      // 27. Swimlane Cross-Functional Flow (Horizontal channels based on Priorities)
      const lanes: Record<Priority, MindMapNode[]> = { High: [], Medium: [], Low: [] };
      nodeMap.forEach((node) => {
        lanes[node.priority || 'Medium'].push(node);
      });

      const priorityHeights: Record<Priority, number> = { High: 150, Medium: 350, Low: 550 };
      prioritiesArray.forEach((p) => {
        const laneNodes = lanes[p];
        laneNodes.forEach((node, idx) => {
          node.x = 150 + idx * 260;
          node.y = priorityHeights[p];
        });
      });
      break;
    }

    case 'venn-diagram': {
      // 28. Venn Diagram Tri-Circle Overlap Node Layout (High, Medium, Low circles)
      const centers = {
        High: { cx: 420, cy: 300 },
        Medium: { cx: 780, cy: 300 },
        Low: { cx: 600, cy: 530 }
      };

      const counts = { High: 0, Medium: 0, Low: 0 };
      nodeMap.forEach((node) => {
        const p = node.priority || 'Medium';
        const center = centers[p];
        const idx = counts[p]++;
        const angle = (idx / 6) * 2 * Math.PI;
        const dist = 60 + (idx > 5 ? 50 : 0);
        node.x = center.cx + dist * Math.cos(angle);
        node.y = center.cy + dist * Math.sin(angle);
      });
      break;
    }

    case 'hub-spoke': {
      // 29. Circular Hub-and-Spoke Wheel
      const centerX = 600;
      const centerY = 400;

      roots.forEach((root) => {
        root.x = centerX;
        root.y = centerY;

        const children = childrenMap.get(root.id) || [];
        const childCount = children.length || 1;

        children.forEach((child, idx) => {
          const angle = (idx / childCount) * 2 * Math.PI;
          child.x = centerX + 260 * Math.cos(angle);
          child.y = centerY + 260 * Math.sin(angle);

          const grandchildren = childrenMap.get(child.id) || [];
          const gcCount = grandchildren.length;
          grandchildren.forEach((gc, gcIdx) => {
            const spread = 0.5; // radian spread
            const gcAngle = angle + (gcIdx - (gcCount - 1) / 2) * spread;
            gc.x = child.x! + 140 * Math.cos(gcAngle);
            gc.y = child.y! + 140 * Math.sin(gcAngle);
          });
        });
      });
      break;
    }

    case 'diagonal-step': {
      // 30. Diagonal Step-Up Escalation Chart
      const allNodes = Array.from(nodeMap.values());
      allNodes.forEach((node, idx) => {
        node.x = 100 + idx * 240;
        node.y = 600 - idx * 115;
      });
      break;
    }

    case 'spiral-growth': {
      // 31. Spiral Growth Map
      const centerX = 600;
      const centerY = 400;
      const allNodes = Array.from(nodeMap.values());

      allNodes.forEach((node, idx) => {
        const angle = idx * 0.75;
        const radius = 80 + idx * 35;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });
      break;
    }

    case 'sitemap-outline': {
      // 32. Block-Style Site Map Outline (Columns at Level 1, vertical lists below)
      const root = roots[0];
      if (root) {
        root.x = 600;
        root.y = 80;

        const cols = childrenMap.get(root.id) || [];
        const colCount = cols.length || 1;
        const colWidth = 260;
        const totalW = (colCount - 1) * colWidth;

        cols.forEach((colNode, cIdx) => {
          colNode.x = 600 - (totalW / 2) + cIdx * colWidth;
          colNode.y = 190;

          const descendants = getVisibleDescendants(colNode.id);
          descendants.forEach((dId, dIdx) => {
            const dNode = nodeMap.get(dId);
            if (dNode) {
              const depth = getNodeDepth(dId);
              dNode.x = colNode.x + (depth - 1) * 30;
              dNode.y = 190 + (dIdx + 1) * 90;
            }
          });
        });
      }
      break;
    }

    case 'gantt-rows': {
      // 33. Multi-Tiered Gantt Task Row Alignment
      const allNodes = Array.from(nodeMap.values());
      allNodes.forEach((node, idx) => {
        node.x = 150 + idx * 130;
        node.y = 100 + idx * 65;
      });
      break;
    }

    case 'pie-sunburst': {
      // 34. Concentric Pie/Sunburst Slice Geometry
      const centerX = 600;
      const centerY = 450;

      roots.forEach((root, rIdx) => {
        root.x = centerX + rIdx * 350;
        root.y = centerY;

        function assignPie(nodeId: string, depth: number, startAngle: number, endAngle: number) {
          const node = nodeMap.get(nodeId);
          if (!node) return;

          const kids = node.collapsed ? [] : (childrenMap.get(nodeId) || []);
          if (kids.length === 0) return;

          const totalWeight = kids.reduce((acc, k) => acc + (k.subtreeHeight || 1), 0);
          let currentAngle = startAngle;
          const arc = endAngle - startAngle;

          kids.forEach((child) => {
            const weight = child.subtreeHeight || 1;
            const size = (weight / totalWeight) * arc;
            const mid = currentAngle + size / 2;

            const radius = 140 + depth * 140;
            child.x = root.x! + radius * Math.cos(mid);
            child.y = root.y! + radius * Math.sin(mid);

            assignPie(child.id, depth + 1, currentAngle, currentAngle + size);
            currentAngle += size;
          });
        }

        assignPie(root.id, 0, 0, 2 * Math.PI);
      });
      break;
    }

    case 'bubble-matrix': {
      // 35. Bubble Matrix Density Cluster
      const centerX = 600;
      const centerY = 400;

      roots.forEach((root, rIdx) => {
        root.x = centerX + rIdx * 350;
        root.y = centerY;

        const mainBranches = childrenMap.get(root.id) || [];
        const mainCount = mainBranches.length;
        const branchRadius = 240;

        mainBranches.forEach((branch, bIdx) => {
          const angle = (bIdx / mainCount) * 2 * Math.PI;
          branch.x = root.x! + branchRadius * Math.cos(angle);
          branch.y = root.y! + branchRadius * Math.sin(angle);

          const descendants = getVisibleDescendants(branch.id);
          const descCount = descendants.length;
          const clusterRadius = 80;

          descendants.forEach((descId, dIdx) => {
            const descNode = nodeMap.get(descId);
            if (descNode) {
              const subAngle = (dIdx / descCount) * 2 * Math.PI;
              descNode.x = branch.x! + clusterRadius * Math.cos(subAngle);
              descNode.y = branch.y! + clusterRadius * Math.sin(subAngle);
            }
          });
        });
      });
      break;
    }

    case 'hex-honeycomb': {
      // 36. Hexagonal Honeycomb Cellular Network
      const allNodes = Array.from(nodeMap.values());
      allNodes.forEach((node, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const xOffset = row % 2 === 0 ? 0 : 130;
        node.x = 220 + col * 280 + xOffset;
        node.y = 120 + row * 160;
      });
      break;
    }

    case 'triple-wing': {
      // 37. Split Triple-Wing Fan Layout (3 main branches expand at 120 deg intervals)
      const centerX = 600;
      const centerY = 400;

      roots.forEach((root) => {
        root.x = centerX;
        root.y = centerY;

        const children = childrenMap.get(root.id) || [];
        children.forEach((child, idx) => {
          const wing = idx % 3;
          const angle = (wing * 2 * Math.PI) / 3; // 0, 120, 240 degrees
          
          child.x = centerX + 180 * Math.cos(angle);
          child.y = centerY + 180 * Math.sin(angle);

          const descendants = getVisibleDescendants(child.id);
          descendants.forEach((kidId, kIdx) => {
            const kid = nodeMap.get(kidId);
            if (kid) {
              const spreadAngle = angle + (kIdx - (descendants.length - 1) / 2) * 0.25;
              const kidRadius = 180 + 130 * getNodeDepth(kidId);
              kid.x = centerX + kidRadius * Math.cos(spreadAngle);
              kid.y = centerY + kidRadius * Math.sin(spreadAngle);
            }
          });
        });
      });
      break;
    }

    case 'horizontal-timeline-parallel':
    case 'dual-track-timeline': {
      // 38. Parallel Dual-Track Timeline
      const root = roots[0];
      if (root) {
        root.x = 100;
        root.y = 350;

        const mainMilestones = childrenMap.get(root.id) || [];
        mainMilestones.forEach((milestone, idx) => {
          const trackIdx = idx % 2;
          milestone.x = 120 + (idx + 1) * 260;
          milestone.y = trackIdx === 0 ? 200 : 500;

          const kids = getVisibleDescendants(milestone.id);
          kids.forEach((kId, kIdx) => {
            const kNode = nodeMap.get(kId);
            if (kNode) {
              kNode.x = milestone.x;
              kNode.y = milestone.y + (trackIdx === 0 ? -(kIdx + 1) * 90 : (kIdx + 1) * 90);
            }
          });
        });
      }
      break;
    }

    case 'star-topology': {
      // 39. Star-Topology Network Map (Center is root, all other nodes surround in single ring)
      const centerX = 600;
      const centerY = 450;
      const allNodes = Array.from(nodeMap.values());
      const nonRoots = allNodes.filter((n) => n.parentId !== null);
      const totalRing = nonRoots.length || 1;

      allNodes.forEach((node) => {
        if (node.parentId === null) {
          node.x = centerX;
          node.y = centerY;
        }
      });

      nonRoots.forEach((node, idx) => {
        const angle = (idx / totalRing) * 2 * Math.PI;
        node.x = centerX + 280 * Math.cos(angle);
        node.y = centerY + 280 * Math.sin(angle);
      });
      break;
    }

    case 'spine-journal': {
      // 40. Central Spine Mind-Journal Freeform Tree (Vertical spine with alternated side leaves)
      const centerX = 600;
      const spineNodes = Array.from(nodeMap.values()).filter((n) => n.parentId === null || n.priority === 'High');
      const sideNodes = Array.from(nodeMap.values()).filter((n) => n.parentId !== null && n.priority !== 'High');

      spineNodes.forEach((node, idx) => {
        node.x = centerX;
        node.y = 100 + idx * 140;
      });

      sideNodes.forEach((node, idx) => {
        const side = idx % 2 === 0 ? -1 : 1; // alternating left/right
        node.x = centerX + side * 270;
        node.y = 150 + Math.floor(idx / 2) * 110;
      });
      break;
    }

    default: {
      // Fallback is right-sided
      const startX = 120;
      let currentY = 100;

      function assignFallback(nodeId: string, depth: number) {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        node.x = startX + depth * 280;
        const children = node.collapsed ? [] : (childrenMap.get(nodeId) || []);

        if (children.length === 0) {
          node.y = currentY;
          currentY += 85;
        } else {
          const firstChildY = currentY;
          children.forEach((child) => {
            assignFallback(child.id, depth + 1);
          });
          const lastChildY = currentY - 85;
          node.y = (firstChildY + lastChildY) / 2;
        }
      }

      roots.forEach((root) => {
        assignFallback(root.id, 0);
        currentY += 40;
      });
      break;
    }
  }

  const result = Array.from(nodeMap.values());
  // Set final positions instantly
  result.forEach((node) => {
    node.targetX = node.x;
    node.targetY = node.y;

    const original = nodes.find((n) => n.id === node.id);
    if (original) {
      node.collapsed = original.collapsed;
      node.x = node.targetX;
      node.y = node.targetY;
      node.createdAt = original.createdAt !== undefined ? original.createdAt : Date.now();
      node.opacity = 1;
    } else {
      node.createdAt = Date.now();
      node.opacity = 1;
      node.x = node.targetX;
      node.y = node.targetY;
    }
  });
  return result;
}

// Private helper to iterate over Priority enums cleanly inside math bounds
const prioritiesArray: Priority[] = ['High', 'Medium', 'Low'];
