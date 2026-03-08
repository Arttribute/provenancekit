"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import { nodeTypes } from "./graph-rf-nodes";
import type { GraphNode as ApiNode, GraphEdge as ApiEdge } from "@provenancekit/sdk";

// BFS layout
function computeLayout(apiNodes: ApiNode[], apiEdges: ApiEdge[]): Node[] {
  const incoming = new Set(apiEdges.map((e) => e.to));
  const roots = apiNodes.filter((n) => !incoming.has(n.id));

  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = roots.map((n) => ({ id: n.id, level: 0 }));
  const seen = new Set<string>();

  while (queue.length) {
    const { id, level } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    levels.set(id, level);
    apiEdges
      .filter((e) => e.from === id)
      .forEach((e) => queue.push({ id: e.to, level: level + 1 }));
  }

  // Assign unseen nodes (disconnected)
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
    arr.forEach((n, idx) => {
      nodes.push({
        id: n.id,
        type: n.type,
        position: { x: level * 300, y: idx * 140 },
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
          type: "arrowclosed" as any,
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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={4}
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
  return (
    <ReactFlowProvider>
      <GraphRFCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
