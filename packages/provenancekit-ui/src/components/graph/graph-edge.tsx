import React from "react";
import type { GraphEdge as ApiEdge } from "@provenancekit/sdk";
import type { LayoutNode } from "./layout";

interface GraphEdgeProps {
  edge: ApiEdge;
  nodes: LayoutNode[];
}

type EdgeType = "produces" | "consumes" | "tool" | "performedBy";

// Hardcoded OKLCH colors for SVG (CSS vars don't inherit in SVG markers universally)
const EDGE_COLORS: Record<EdgeType, string> = {
  produces: "oklch(0.52 0.18 250)",    // blue
  consumes: "oklch(0.58 0.22 25)",     // red-orange
  performedBy: "oklch(0.65 0.18 75)",  // amber
  tool: "oklch(0.52 0.2 310)",         // violet
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
  const markerId = `pk-arrow-${edgeType}`;

  // Connection points: right-center of source → left-center of target
  const startX = from.position.x + from.width;
  const startY = from.position.y + from.height / 2;
  const endX = to.position.x;
  const endY = to.position.y + to.height / 2;

  // Cubic Bezier control points
  const dx = Math.abs(endX - startX);
  const cpOffset = Math.max(60, dx * 0.4);
  const cp1X = startX + cpOffset;
  const cp2X = endX - cpOffset;

  const pathD = `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;

  // Midpoint for label
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

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

      {/* Invisible wider path for hover target */}
      <path d={pathD} stroke="transparent" strokeWidth={12} fill="none" />

      {/* Visible path */}
      <path
        d={pathD}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        opacity={0.8}
        markerEnd={`url(#${markerId})`}
      />

      {/* Edge label at midpoint */}
      <text
        x={midX}
        y={midY - 5}
        textAnchor="middle"
        fontSize={9}
        fill={color}
        opacity={0.75}
        fontFamily="ui-monospace, monospace"
      >
        {EDGE_LABELS[edgeType] ?? edgeType}
      </text>

      {/* Dot at source */}
      <circle cx={startX} cy={startY} r={3} fill={color} opacity={0.6} />
    </g>
  );
}
