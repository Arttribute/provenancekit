import React from "react";
import type { GraphEdge as ApiEdge } from "@provenancekit/sdk";
import type { LayoutNode } from "./layout";

interface GraphEdgeProps {
  edge: ApiEdge;
  nodes: LayoutNode[];
}

type EdgeType = "produces" | "consumes" | "tool" | "performedBy";

// Colors match node accent colors for semantic clarity
const EDGE_COLORS: Record<EdgeType, string> = {
  produces: "#3b82f6",   // blue — resource producing
  consumes: "#ef4444",   // red — consuming input
  performedBy: "#f59e0b", // amber — entity link
  tool: "#a78bfa",        // violet — AI/tool link
};

const EDGE_LABELS: Record<EdgeType, string> = {
  produces: "produces",
  consumes: "consumes",
  performedBy: "performed by",
  tool: "tool",
};

export function GraphEdge({ edge, nodes }: GraphEdgeProps) {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;

  const edgeType = edge.type as EdgeType;
  const color = EDGE_COLORS[edgeType] ?? EDGE_COLORS.produces;
  const markerId = `pk-arrow-${edgeType}-${edge.from.slice(0, 6)}-${edge.to.slice(0, 6)}`;

  // Right-center → left-center connection
  const startX = from.position.x + from.width;
  const startY = from.position.y + from.height / 2;
  const endX = to.position.x;
  const endY = to.position.y + to.height / 2;

  // Cubic bezier control points
  const dx = Math.abs(endX - startX);
  const cpOffset = Math.max(60, dx * 0.45);
  const cp1X = startX + cpOffset;
  const cp2X = endX - cpOffset;

  const pathD = `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;

  // Label at midpoint (parametric t=0.5 of cubic bezier)
  const midX = (startX + 3 * cp1X + 3 * cp2X + endX) / 8;
  const midY = (startY + 3 * startY + 3 * endY + endY) / 8;

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      </defs>

      {/* Wide invisible hit target */}
      <path d={pathD} stroke="transparent" strokeWidth={12} fill="none" />

      {/* Visible bezier path */}
      <path
        d={pathD}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        opacity={0.7}
        markerEnd={`url(#${markerId})`}
      />

      {/* Source dot */}
      <circle cx={startX} cy={startY} r={3.5} fill={color} opacity={0.8} />

      {/* Label */}
      <text
        x={midX}
        y={midY - 6}
        textAnchor="middle"
        fontSize={9}
        fill={color}
        opacity={0.6}
        fontFamily="ui-monospace, 'Cascadia Code', monospace"
        letterSpacing="0.02em"
      >
        {EDGE_LABELS[edgeType] ?? edgeType}
      </text>
    </g>
  );
}
