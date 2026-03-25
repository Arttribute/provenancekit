"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import { nodeTypes } from "./graph-rf-nodes";
import type { GraphNode as ApiNode, GraphEdge as ApiEdge } from "@provenancekit/sdk";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 110;
const H_GAP = 80;
const V_GAP = 30;

// BFS layout — centers each column vertically around the canvas midpoint
function computeLayout(apiNodes: ApiNode[], apiEdges: ApiEdge[]): Node[] {
  if (apiNodes.length === 0) return [];

  const incoming = new Set(apiEdges.map((e) => e.to));
  const roots = apiNodes.filter((n) => !incoming.has(n.id));

  const levels = new Map<string, number>();
  const seeds = roots.length > 0 ? roots : apiNodes.slice(0, 1);
  const queue: { id: string; level: number }[] = seeds.map((n) => ({ id: n.id, level: 0 }));
  const seen = new Set<string>();

  while (queue.length) {
    const { id, level } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!levels.has(id) || levels.get(id)! < level) levels.set(id, level);
    apiEdges
      .filter((e) => e.from === id)
      .forEach((e) => queue.push({ id: e.to, level: level + 1 }));
  }

  apiNodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });

  const byLevel = new Map<number, ApiNode[]>();
  apiNodes.forEach((n) => {
    const l = levels.get(n.id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(n);
  });

  const nodes: Node[] = [];
  byLevel.forEach((arr, level) => {
    const columnHeight = arr.length * NODE_HEIGHT + (arr.length - 1) * V_GAP;
    const startY = -columnHeight / 2;
    arr.forEach((n, idx) => {
      nodes.push({
        id: n.id,
        type: n.type,
        position: {
          x: level * (NODE_WIDTH + H_GAP),
          y: startY + idx * (NODE_HEIGHT + V_GAP),
        },
        data: { ...n.data, label: n.label },
      });
    });
  });

  return nodes;
}

interface GraphRFCanvasProps {
  nodes: ApiNode[];
  edges: ApiEdge[];
  height?: number | string;
  onNodeClick?: (node: ApiNode) => void;
  className?: string;
}

// Edge colors: muted, desaturated — color is a subtle hint, not the dominant element
const edgeColors: Record<string, string> = {
  produces: "#6b9fd4",   // muted blue
  consumes: "#e08080",   // muted red
  performedBy: "#c9a44e", // muted amber
  tool: "#9b72c0",        // muted purple
};

function GraphRFCanvasInner({
  nodes: apiNodes,
  edges: apiEdges,
  height = 500,
  onNodeClick,
  className,
}: GraphRFCanvasProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // BFS layout — recomputed only when graph data changes, NOT on hover
  const layoutNodes = useMemo(() => computeLayout(apiNodes, apiEdges), [apiNodes, apiEdges]);

  // Nodes directly connected to the hovered node (includes hovered node itself)
  const connectedSet = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId) return null;
    const s = new Set<string>([hoveredNodeId]);
    for (const e of apiEdges) {
      if (e.from === hoveredNodeId) s.add(e.to);
      if (e.to === hoveredNodeId) s.add(e.from);
    }
    return s;
  }, [hoveredNodeId, apiEdges]);

  // Annotate nodes with highlight / dim state for GitHub-style interaction.
  // We set opacity + zIndex on the ReactFlow node's wrapper `style` (most reliable),
  // AND pass flags in `data` so the node card can adjust its own shadow/border.
  const rfNodes = useMemo(
    () =>
      layoutNodes.map((n) => {
        const isDimmed = connectedSet !== null && !connectedSet.has(n.id);
        const isHighlighted = connectedSet !== null && connectedSet.has(n.id);
        return {
          ...n,
          // ReactFlow applies `style` to the outer node wrapper — affects card + handles
          style: {
            opacity: isDimmed ? 0.2 : 1,
            zIndex: isHighlighted ? 10 : isDimmed ? 0 : 1,
            transition: "opacity 0.18s ease",
          },
          data: {
            ...n.data,
            _highlighted: isHighlighted,
            _dimmed: isDimmed,
          },
        };
      }),
    [layoutNodes, connectedSet]
  );

  // Edges: highlight those directly incident to the hovered node, dim the rest
  const rfEdges: Edge[] = useMemo(
    () =>
      apiEdges.map((e, i) => {
        const baseColor = edgeColors[e.type] ?? "#94a3b8";
        // An edge is "active" when no node is hovered, or when it touches the hovered node
        const active = !hoveredNodeId || e.from === hoveredNodeId || e.to === hoveredNodeId;
        return {
          id: `${e.from}-${e.to}-${i}`,
          source: e.from,
          target: e.to,
          label: e.type,
          type: "smoothstep",
          style: {
            stroke: active ? baseColor : "rgba(148,163,184,0.25)",
            strokeWidth: active ? (hoveredNodeId ? 2 : 1.5) : 1,
            transition: "stroke 0.15s ease, stroke-width 0.15s ease",
          },
          labelStyle: {
            fill: active ? "#64748b" : "rgba(100,116,139,0.3)",
            fontSize: 10,
          },
          labelBgStyle: {
            fill: "var(--pk-graph-node-bg, #fff)",
            fillOpacity: active ? 0.85 : 0.3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: active ? baseColor : "rgba(148,163,184,0.25)",
          },
        };
      }),
    [apiEdges, hoveredNodeId]
  );

  return (
    <div
      className={className}
      style={{
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--pk-graph-control-border, #dde1e7)",
        background: "var(--pk-graph-bg, #f8fafc)",
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, includeHiddenNodes: false }}
        minZoom={0.1}
        maxZoom={4}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        panOnDrag
        proOptions={{ hideAttribution: true }}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onNodeClick={(_, node) => {
          if (onNodeClick) {
            const apiNode = apiNodes.find((n) => n.id === node.id);
            if (apiNode) onNodeClick(apiNode);
          }
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--pk-graph-dot, #c8d0db)"
        />
        <Controls
          style={{
            background: "var(--pk-graph-control-bg, rgba(255,255,255,0.96))",
            border: "1px solid var(--pk-graph-control-border, #dde1e7)",
            borderRadius: 8,
            color: "var(--pk-graph-control-text, #5a6578)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        />
      </ReactFlow>
    </div>
  );
}

export function GraphRFCanvas(props: GraphRFCanvasProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div
        style={{
          height: props.height ?? 500,
          borderRadius: 12,
          background: "var(--pk-graph-bg, #f8fafc)",
          border: "1px solid var(--pk-graph-control-border, #dde1e7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--pk-muted-foreground, #64748b)" }}>
          Loading graph…
        </span>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphRFCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
