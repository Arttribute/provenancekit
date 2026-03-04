"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { GraphCanvas } from "./graph-canvas";
import { useProvenanceGraph } from "../../hooks/use-provenance-graph";
import type { GraphNode, GraphEdge, ProvenanceGraph as ApiGraph } from "@provenancekit/sdk";

export interface ProvenanceGraphProps {
  /** Resource CID — auto-fetches graph if no nodes/edges provided */
  cid?: string;
  depth?: number;
  /** Headless mode — provide nodes and edges directly */
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  /** Layout direction */
  layout?: "bfs-horizontal" | "bfs-vertical";
  height?: number | string;
  showControls?: boolean;
  showLegend?: boolean;
  draggable?: boolean;
  onNodeClick?: (node: GraphNode) => void;
  loadingSlot?: React.ReactNode;
  errorSlot?: React.ReactNode;
  className?: string;
}

function LoadingSkeleton({ height }: { height: number | string }) {
  return (
    <div
      className="rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)] animate-pulse"
      style={{ height }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-[var(--pk-muted-foreground)]">Loading provenance graph…</div>
      </div>
    </div>
  );
}

function ErrorDisplay({ message, height }: { message: string; height: number | string }) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-sm text-red-600 dark:text-red-400 px-4 text-center">{message}</div>
    </div>
  );
}

export function ProvenanceGraph({
  cid,
  depth,
  nodes: nodesProp,
  edges: edgesProp,
  height = 600,
  showControls = true,
  showLegend = true,
  draggable = true,
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
    return loadingSlot ? (
      <>{loadingSlot}</>
    ) : (
      <LoadingSkeleton height={height} />
    );
  }

  if (!headlessMode && error && !data) {
    return errorSlot ? (
      <>{errorSlot}</>
    ) : (
      <ErrorDisplay message={error.message} height={height} />
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)] flex items-center justify-center",
          className
        )}
        style={{ height }}
      >
        <div className="text-sm text-[var(--pk-muted-foreground)]">No provenance data available</div>
      </div>
    );
  }

  return (
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      height={height}
      showControls={showControls}
      showLegend={showLegend}
      draggable={draggable}
      onNodeClick={onNodeClick}
      className={className}
    />
  );
}
