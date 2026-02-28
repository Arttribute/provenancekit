import type { GraphNode, GraphEdge } from "@provenancekit/sdk";

export interface LayoutConfig {
  direction: "horizontal" | "vertical";
  levelGapH: number;
  levelGapV: number;
  nodeWidth: number;
  nodeHeight: number;
  padding: number;
}

export interface LayoutNode {
  id: string;
  type: "resource" | "action" | "entity";
  label: string;
  data: Record<string, any>;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  direction: "horizontal",
  levelGapH: 320,
  levelGapV: 140,
  nodeWidth: 220,
  nodeHeight: 90,
  padding: 60,
};

/**
 * Compute a hierarchical BFS layout for a provenance graph.
 *
 * Algorithm:
 * 1. Find root nodes (no incoming edges).
 * 2. BFS to assign each node a level (depth from nearest root).
 *    If reachable from multiple paths, use maximum depth for a proper
 *    left-to-right chronological ordering.
 * 3. Group nodes into columns (levels).
 * 4. Within each column sort by type priority (resource > action > entity)
 *    for visual consistency.
 * 5. Center each column's nodes vertically.
 * 6. Disconnected nodes (entity islands with no edges) are placed in a
 *    rightmost "annotations" column.
 */
export function computeBFSLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const incomingEdges = new Set(edges.map((e) => e.to));
  const outgoingMap = new Map<string, string[]>();
  for (const edge of edges) {
    const arr = outgoingMap.get(edge.from) ?? [];
    arr.push(edge.to);
    outgoingMap.set(edge.from, arr);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Find true roots (connected nodes with no incoming edges)
  const roots = nodes.filter(
    (n) => !incomingEdges.has(n.id) && outgoingMap.has(n.id)
  );

  // Disconnected nodes: no incoming AND no outgoing edges
  const disconnected = nodes.filter(
    (n) => !incomingEdges.has(n.id) && !outgoingMap.has(n.id)
  );

  // BFS to assign levels (max-depth strategy)
  const levels = new Map<string, number>();
  const queue: Array<{ id: string; level: number }> = roots.map((n) => ({
    id: n.id,
    level: 0,
  }));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    // Only update if this is a deeper (later) level for the node
    if ((levels.get(id) ?? -1) < level) {
      levels.set(id, level);
      const children = outgoingMap.get(id) ?? [];
      for (const childId of children) {
        if (nodeIds.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      }
    }
  }

  // Any connected node not yet assigned gets level 0
  for (const node of nodes) {
    if (!levels.has(node.id) && !disconnected.find((d) => d.id === node.id)) {
      levels.set(node.id, 0);
    }
  }

  // Group by level
  const levelGroups = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    if (disconnected.find((d) => d.id === node.id)) continue;
    const level = levels.get(node.id) ?? 0;
    const arr = levelGroups.get(level) ?? [];
    arr.push(node);
    levelGroups.set(level, arr);
  }

  // Sort within each level: resources first, then actions, then entities
  const typePriority: Record<string, number> = { resource: 0, action: 1, entity: 2 };
  for (const arr of levelGroups.values()) {
    arr.sort((a, b) => (typePriority[a.type] ?? 3) - (typePriority[b.type] ?? 3));
  }

  const maxLevel = levelGroups.size > 0 ? Math.max(...levelGroups.keys()) : 0;

  // Calculate total height per level for centering
  const totalHeight = (count: number) =>
    count > 0 ? count * config.nodeHeight + (count - 1) * (config.levelGapV - config.nodeHeight) : 0;

  const result: LayoutNode[] = [];

  // Lay out connected nodes
  for (const [level, arr] of levelGroups) {
    const colHeight = totalHeight(arr.length);
    const colX = config.padding + level * config.levelGapH;

    arr.forEach((node, idx) => {
      const colY = config.padding + idx * config.levelGapV;
      result.push({
        id: node.id,
        type: node.type as LayoutNode["type"],
        label: node.label,
        data: node.data,
        position: {
          x: colX,
          y: colY + Math.max(0, (config.padding - colHeight / 2)),
        },
        width: config.nodeWidth,
        height: config.nodeHeight,
      });
    });
  }

  // Place disconnected nodes in a rightmost column
  if (disconnected.length > 0) {
    const annotationsX = config.padding + (maxLevel + 1) * config.levelGapH;
    disconnected.forEach((node, idx) => {
      result.push({
        id: node.id,
        type: node.type as LayoutNode["type"],
        label: node.label,
        data: node.data,
        position: {
          x: annotationsX,
          y: config.padding + idx * config.levelGapV,
        },
        width: config.nodeWidth,
        height: config.nodeHeight,
      });
    });
  }

  return result;
}

/** Calculate canvas bounds from layout nodes */
export function computeCanvasBounds(
  layoutNodes: LayoutNode[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): { width: number; height: number } {
  if (layoutNodes.length === 0) return { width: 600, height: 400 };
  const maxX = Math.max(...layoutNodes.map((n) => n.position.x + n.width));
  const maxY = Math.max(...layoutNodes.map((n) => n.position.y + n.height));
  return {
    width: maxX + config.padding,
    height: maxY + config.padding,
  };
}
