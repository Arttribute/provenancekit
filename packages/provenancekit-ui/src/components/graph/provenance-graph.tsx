"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { GraphRFCanvas } from "./graph-rf-canvas";
import { useProvenanceGraph } from "../../hooks/use-provenance-graph";
import type { GraphNode, GraphEdge } from "@provenancekit/sdk";

export interface ProvenanceGraphProps {
  /** Resource CID — auto-fetches graph if no nodes/edges provided */
  cid?: string;
  depth?: number;
  /** Headless mode — provide nodes and edges directly */
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  height?: number | string;
  onNodeClick?: (node: GraphNode) => void;
  loadingSlot?: React.ReactNode;
  errorSlot?: React.ReactNode;
  className?: string;
}

function LoadingSkeleton({ height }: { height: number | string }) {
  return (
    <div
      className={cn("rounded-xl animate-pulse")}
      style={{
        height,
        background: "var(--pk-surface-muted, #f8fafc)",
        border: "1px solid var(--pk-surface-border, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--pk-muted-foreground, #64748b)" }}>
        Loading provenance graph…
      </span>
    </div>
  );
}

function ErrorDisplay({ message, height }: { message: string; height: number | string }) {
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(239,68,68,0.05)",
        border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 12,
      }}
    >
      <span style={{ fontSize: 13, color: "#ef4444" }}>{message}</span>
    </div>
  );
}

export function ProvenanceGraph({
  cid,
  depth,
  nodes: nodesProp,
  edges: edgesProp,
  height = 500,
  onNodeClick,
  loadingSlot,
  errorSlot,
  className,
}: ProvenanceGraphProps) {
  const headlessMode = nodesProp !== undefined && edgesProp !== undefined;

  const { data, loading, error } = useProvenanceGraph(headlessMode ? null : cid, {
    depth,
    enabled: !headlessMode && !!cid,
  });

  const nodes = headlessMode ? nodesProp! : (data?.nodes ?? []);
  const edges = headlessMode ? edgesProp! : (data?.edges ?? []);

  if (!headlessMode && loading && !data) {
    return loadingSlot ? <>{loadingSlot}</> : <LoadingSkeleton height={height} />;
  }

  if (!headlessMode && error && !data) {
    return errorSlot ? <>{errorSlot}</> : <ErrorDisplay message={error.message} height={height} />;
  }

  if (nodes.length === 0) {
    return (
      <div
        className={className}
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--pk-surface-muted, #f8fafc)",
          border: "1px solid var(--pk-surface-border, #e2e8f0)",
          borderRadius: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--pk-muted-foreground, #64748b)" }}>
          No provenance data available
        </span>
      </div>
    );
  }

  return (
    <GraphRFCanvas
      nodes={nodes}
      edges={edges}
      height={height}
      onNodeClick={onNodeClick}
      className={className}
    />
  );
}
