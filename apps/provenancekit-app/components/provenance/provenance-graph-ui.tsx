// apps/provenancekit-app/components/provenance-graph-ui.tsx
"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Circle,
  Database,
  Zap,
  User,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
} from "lucide-react";
import type {
  GraphNode as ApiNode,
  GraphEdge as ApiEdge,
} from "@provenancekit/sdk";

interface Node {
  id: string;
  type: "resource" | "action" | "entity";
  label: string;
  data: any;
  position: { x: number; y: number };
}
interface Edge {
  from: string;
  to: string;
  type: string;
}
interface Transform {
  x: number;
  y: number;
  scale: number;
}

const getNodeIcon = (t: string) =>
  t === "resource" ? (
    <Database className="w-4 h-4" />
  ) : t === "action" ? (
    <Zap className="w-4 h-4" />
  ) : t === "entity" ? (
    <User className="w-4 h-4" />
  ) : (
    <Circle className="w-4 h-4" />
  );

const getNodeColor = (t: string) =>
  t === "resource"
    ? "text-blue-400"
    : t === "action"
    ? "text-green-400"
    : t === "entity"
    ? "text-yellow-400"
    : "text-gray-400";

const NodeCard = ({
  node,
  onDragStart,
  isDragging,
}: {
  node: Node;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  isDragging: boolean;
}) => {
  const completed = node.type === "action" || node.type === "resource";

  return (
    <div
      className={`absolute bg-gray-800 border border-gray-700 rounded-lg p-4 min-w-[200px] shadow-lg cursor-move select-none transition-shadow hover:shadow-xl ${
        isDragging ? "shadow-2xl ring-2 ring-blue-500" : ""
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        transform: "translate(-50%, -50%)",
        zIndex: isDragging ? 1000 : 1,
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        onDragStart(node.id, e);
      }}
    >
      <div className="flex items-center gap-3">
        <div className={getNodeColor(node.type)}>
          {completed ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-gray-500" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-white font-medium text-sm">{node.label}</div>
          {node.data.timestamp && (
            <div className="text-gray-400 text-xs mt-1">
              {new Date(node.data.timestamp).toLocaleString()}
            </div>
          )}
        </div>
        <div className={getNodeColor(node.type)}>{getNodeIcon(node.type)}</div>
      </div>

      {node.type === "action" && (
        <div className="mt-2 text-xs text-gray-500">
          {node.data.type?.replace("ext:", "")}
        </div>
      )}

      {node.type === "resource" && (
        <div className="mt-2 text-xs text-gray-500 flex flex-col gap-1">
          <span>
            {node.data.type} •{" "}
            {node.data.size ? Math.round(node.data.size / 1024) : 0}KB
          </span>
          {node.data.locations?.length ? (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {node.data.locations[0].provider}
            </span>
          ) : null}
        </div>
      )}

      {node.type === "entity" && (
        <div className="mt-2 text-xs text-gray-500">{node.data.role}</div>
      )}
    </div>
  );
};

const ConnectionLine = ({
  from,
  to,
  nodes,
}: {
  from: string;
  to: string;
  nodes: Node[];
}) => {
  const f = nodes.find((n) => n.id === from);
  const t = nodes.find((n) => n.id === to);
  if (!f || !t) return null;

  const startX = f.position.x + 100;
  const startY = f.position.y;
  const endX = t.position.x - 100;
  const endY = t.position.y;

  const midX = (startX + endX) / 2;
  const c1 = startX + (midX - startX) * 0.5;
  const c2 = endX - (endX - midX) * 0.5;

  const path = `M ${startX} ${startY} C ${c1} ${startY}, ${c2} ${endY}, ${endX} ${endY}`;

  return (
    <g>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
        </marker>
      </defs>
      <path
        d={path}
        stroke="#3b82f6"
        strokeWidth="2"
        fill="none"
        className="drop-shadow-sm"
        markerEnd="url(#arrowhead)"
      />
      <circle cx={startX} cy={startY} r="4" fill="#3b82f6" />
      <circle cx={endX} cy={endY} r="4" fill="#3b82f6" />
    </g>
  );
};

const calculateLayout = (nodes: ApiNode[], edges: ApiEdge[]): Node[] => {
  const levels = new Map<string, number>();
  const incoming = new Set(edges.map((e) => e.to));
  const roots = nodes.filter((n) => !incoming.has(n.id));

  const q = roots.map((n) => ({ node: n, level: 0 }));
  const seen = new Set<string>();

  while (q.length) {
    const { node, level } = q.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    levels.set(node.id, level);

    edges
      .filter((e) => e.from === node.id)
      .map((e) => nodes.find((n) => n.id === e.to))
      .filter(Boolean)
      .forEach((child) => q.push({ node: child!, level: level + 1 }));
  }

  const levelGroups = new Map<number, ApiNode[]>();
  nodes.forEach((n) => {
    const l = levels.get(n.id) ?? 0;
    const arr = levelGroups.get(l) || [];
    arr.push(n);
    levelGroups.set(l, arr);
  });

  const out: Node[] = [];
  levelGroups.forEach((arr, level) => {
    arr.forEach((n, idx) => {
      out.push({
        id: n.id,
        type: n.type as Node["type"],
        label: n.label,
        data: n.data,
        position: { x: 150 + level * 350, y: 100 + idx * 150 },
      });
    });
  });

  return out;
};

export const ProvenanceGraphUI = ({
  nodes: apiNodes,
  edges: apiEdges,
}: {
  nodes: ApiNode[];
  edges: ApiEdge[];
}) => {
  const initialNodes = useMemo(
    () => calculateLayout(apiNodes, apiEdges),
    [apiNodes, apiEdges]
  );
  const initialEdges: Edge[] = useMemo(
    () => apiEdges.map((e) => ({ from: e.from, to: e.to, type: e.type })),
    [apiEdges]
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [dragging, setDragging] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const maxX = Math.max(...nodes.map((n) => n.position.x)) + 300;
  const maxY = Math.max(...nodes.map((n) => n.position.y)) + 200;

  const onDragStart = useCallback((id: string, e: React.MouseEvent) => {
    setDragging(id);
    setLastPos({ x: e.clientX, y: e.clientY });
  }, []);

  const onDrag = useCallback(
    (dx: number, dy: number) => {
      if (!dragging) return;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging
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
    },
    [dragging, transform.scale]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      if (dragging) {
        onDrag(dx, dy);
        setLastPos({ x: e.clientX, y: e.clientY });
      } else if (panning) {
        setTransform((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
        setLastPos({ x: e.clientX, y: e.clientY });
      }
    },
    [dragging, panning, lastPos, onDrag]
  );

  const onMouseDownCanvas = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setPanning(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const stopDragPan = useCallback(() => {
    setDragging(null);
    setPanning(false);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((p) => ({
      ...p,
      scale: Math.max(0.3, Math.min(3, p.scale * factor)),
    }));
  }, []);

  const zoomIn = () =>
    setTransform((p) => ({ ...p, scale: Math.min(3, p.scale * 1.2) }));
  const zoomOut = () =>
    setTransform((p) => ({ ...p, scale: Math.max(0.3, p.scale / 1.2) }));
  const reset = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setNodes(initialNodes);
  };

  return (
    <div className="border rounded-lg overflow-hidden relative max-w-6xl ">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={zoomIn}
          className="bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={zoomOut}
          className="bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={reset}
          className="bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="max-w-5xl h-[600px] overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDownCanvas}
        onMouseMove={onMouseMove}
        onMouseUp={stopDragPan}
        onMouseLeave={stopDragPan}
        onWheel={onWheel}
      >
        <div
          className="relative origin-top-left transition-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: maxX,
            height: maxY,
            minHeight: "600px",
          }}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={maxX}
            height={maxY}
          >
            {initialEdges.map((e, i) => (
              <ConnectionLine key={i} from={e.from} to={e.to} nodes={nodes} />
            ))}
          </svg>

          {nodes.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              onDragStart={onDragStart}
              isDragging={dragging === n.id}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        <div>• Drag nodes to reposition</div>
        <div>• Drag canvas to pan</div>
        <div>• Scroll to zoom</div>
      </div>
    </div>
  );
};
