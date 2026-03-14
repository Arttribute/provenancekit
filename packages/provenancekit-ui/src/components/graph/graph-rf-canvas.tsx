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
  // Seed with roots at level 0; fall back to all nodes if no roots found
  const seeds = roots.length > 0 ? roots : apiNodes.slice(0, 1);
  const queue: { id: string; level: number }[] = seeds.map((n) => ({ id: n.id, level: 0 }));
  const seen = new Set<string>();

  while (queue.length) {
    const { id, level } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    // Keep the deepest level to avoid collapsing long chains
    if (!levels.has(id) || levels.get(id)! < level) levels.set(id, level);
    apiEdges
      .filter((e) => e.from === id)
      .forEach((e) => queue.push({ id: e.to, level: level + 1 }));
  }

  // Assign any disconnected nodes to level 0
  apiNodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });

  // Group nodes by level
  const byLevel = new Map<number, ApiNode[]>();
  apiNodes.forEach((n) => {
    const l = levels.get(n.id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(n);
  });

  const nodes: Node[] = [];
  byLevel.forEach((arr, level) => {
    // Center the column vertically so all levels are aligned around y = 0
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

const edgeColors: Record<string, string> = {
  produces: "#3b82f6",
  consumes: "#ef4444",
  performedBy: "#f59e0b",
  tool: "#a855f7",
};

function GraphRFCanvasInner({
  nodes: apiNodes,
  edges: apiEdges,
  height = 500,
  onNodeClick,
  className,
}: GraphRFCanvasProps) {
  const rfNodes = useMemo(() => computeLayout(apiNodes, apiEdges), [apiNodes, apiEdges]);

  const rfEdges: Edge[] = useMemo(
    () =>
      apiEdges.map((e, i) => ({
        id: `${e.from}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        label: e.type,
        type: "smoothstep",
        animated: e.type === "produces",
        style: { stroke: edgeColors[e.type] ?? "#94a3b8", strokeWidth: 2 },
        labelStyle: { fill: "#64748b", fontSize: 10 },
        labelBgStyle: { fill: "var(--pk-graph-node-bg, #fff)", fillOpacity: 0.85 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColors[e.type] ?? "#94a3b8",
        },
      })),
    [apiEdges]
  );

  return (
    <div
      className={className}
      style={{
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--pk-graph-control-border, #e2e8f0)",
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
          color="var(--pk-graph-dot, #cbd5e1)"
        />
        <Controls
          style={{
            background: "var(--pk-graph-control-bg, rgba(255,255,255,0.92))",
            border: "1px solid var(--pk-graph-control-border, #e2e8f0)",
            borderRadius: 8,
            color: "var(--pk-graph-control-text, #64748b)",
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
          border: "1px solid var(--pk-graph-control-border, #e2e8f0)",
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
