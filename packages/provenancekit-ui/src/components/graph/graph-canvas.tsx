"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../../lib/utils";
import { GraphEdge } from "./graph-edge";
import { GraphNode } from "./graph-node";
import { GraphControls } from "./graph-controls";
import { GraphLegend } from "./graph-legend";
import {
  computeCanvasBounds,
  computeBFSLayout,
  DEFAULT_LAYOUT_CONFIG,
  type LayoutNode,
} from "./layout";
import type { GraphNode as ApiNode, GraphEdge as ApiEdge } from "@provenancekit/sdk";

interface Transform {
  x: number;
  y: number;
  scale: number;
}

const SCALE_MIN = 0.15;
const SCALE_MAX = 4;
const SCALE_STEP = 1.2;

interface GraphCanvasProps {
  nodes: ApiNode[];
  edges: ApiEdge[];
  height?: number | string;
  showControls?: boolean;
  showLegend?: boolean;
  draggable?: boolean;
  onNodeClick?: (node: ApiNode) => void;
  className?: string;
}

export function GraphCanvas({
  nodes: apiNodes,
  edges: apiEdges,
  height = 600,
  showControls = true,
  showLegend = true,
  draggable = true,
  onNodeClick,
  className,
}: GraphCanvasProps) {
  const initialLayoutNodes = useCallback(
    () => computeBFSLayout(apiNodes, apiEdges, DEFAULT_LAYOUT_CONFIG),
    [apiNodes, apiEdges]
  );

  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>(initialLayoutNodes);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayoutNodes(computeBFSLayout(apiNodes, apiEdges, DEFAULT_LAYOUT_CONFIG));
    setExpandedIds(new Set());
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [apiNodes, apiEdges]);

  const bounds = computeCanvasBounds(layoutNodes, DEFAULT_LAYOUT_CONFIG);

  const zoomIn = () =>
    setTransform((t) => ({ ...t, scale: Math.min(SCALE_MAX, t.scale * SCALE_STEP) }));
  const zoomOut = () =>
    setTransform((t) => ({ ...t, scale: Math.max(SCALE_MIN, t.scale / SCALE_STEP) }));
  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setLayoutNodes(computeBFSLayout(apiNodes, apiEdges, DEFAULT_LAYOUT_CONFIG));
  };

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleNodeDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (!draggable) return;
      setDraggingNodeId(id);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      hasDragged.current = false;
    },
    [draggable]
  );

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && e.target !== containerRef.current) return;
    setIsPanning(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (draggingNodeId) {
        hasDragged.current = true;
        setLayoutNodes((prev) =>
          prev.map((n) =>
            n.id === draggingNodeId
              ? {
                  ...n,
                  position: {
                    x: n.position.x + dx / transform.scale,
                    y: n.position.y + dy / transform.scale,
                  },
                }
              : n
          )
        );
      } else if (isPanning) {
        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      }
    },
    [draggingNodeId, isPanning, transform.scale]
  );

  const handleMouseUp = useCallback(
    (nodeId?: string) => {
      if (nodeId && draggingNodeId === nodeId && !hasDragged.current) {
        handleToggleExpand(nodeId);
        if (onNodeClick) {
          const apiNode = apiNodes.find((n) => n.id === nodeId);
          if (apiNode) onNodeClick(apiNode);
        }
      }
      setDraggingNodeId(null);
      setIsPanning(false);
      hasDragged.current = false;
    },
    [draggingNodeId, handleToggleExpand, onNodeClick, apiNodes]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 / SCALE_STEP : SCALE_STEP;
    setTransform((t) => ({
      ...t,
      scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, t.scale * factor)),
    }));
  }, []);

  return (
    <div
      className={cn("relative overflow-hidden rounded-xl", className)}
      style={{
        height,
        backgroundColor: "var(--pk-graph-bg)",
        border: "1px solid var(--pk-graph-control-border)",
      }}
    >
      {/* Dot-grid background */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ opacity: 0.8 }}
      >
        <defs>
          <pattern id="pk-dotgrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--pk-graph-dot)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pk-dotgrid)" />
      </svg>

      {/* Viewport */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => handleMouseUp()}
        onMouseLeave={() => {
          setDraggingNodeId(null);
          setIsPanning(false);
        }}
        onWheel={handleWheel}
      >
        {/* Transformed canvas */}
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: bounds.width,
            height: bounds.height,
          }}
        >
          {/* SVG edges layer */}
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={bounds.width}
            height={bounds.height}
          >
            {apiEdges.map((edge, i) => (
              <GraphEdge key={`${edge.from}-${edge.to}-${i}`} edge={edge} nodes={layoutNodes} />
            ))}
          </svg>

          {/* Node cards layer */}
          {layoutNodes.map((node) => (
            <GraphNode
              key={node.id}
              node={node}
              isExpanded={expandedIds.has(node.id)}
              onToggleExpand={handleToggleExpand}
              onDragStart={handleNodeDragStart}
              isDragging={draggingNodeId === node.id}
            />
          ))}
        </div>
      </div>

      {showControls && (
        <GraphControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />
      )}

      {showLegend && <GraphLegend />}

      {/* Usage hint */}
      <div
        className="absolute bottom-3 right-3 z-10 text-[10px] pointer-events-none"
        style={{ color: "var(--pk-graph-node-muted)", opacity: 0.6 }}
      >
        Drag to pan · Scroll to zoom · Click to expand
      </div>
    </div>
  );
}
