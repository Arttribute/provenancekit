"use client";

import React from "react";
import { Database, Zap, User, Bot, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate, formatCid, formatActionType, formatBytes } from "../../lib/format";
import type { LayoutNode } from "./layout";

interface GraphNodeProps {
  node: LayoutNode;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  isDragging: boolean;
}

// Graph always renders on a dark canvas — hardcoded dark values intentionally
// (same approach as reference ProvenanceGraphUI)
const nodeConfig = {
  resource: {
    Icon: Database,
    label: "Resource",
    accentColor: "#3b82f6",    // blue-500
    accentMuted: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.35)",
  },
  action: {
    Icon: Zap,
    label: "Action",
    accentColor: "#22c55e",    // green-500
    accentMuted: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.35)",
  },
  entity: {
    Icon: User,
    label: "Entity",
    accentColor: "#f59e0b",    // amber-500
    accentMuted: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.35)",
  },
} as const;

function ResourceDetail({ data }: { data: Record<string, any> }) {
  const cid = data.cid ?? data.address?.ref;
  return (
    <div className="text-xs space-y-1" style={{ color: "var(--pk-graph-node-muted)" }}>
      {cid && (
        <div className="font-mono truncate" title={cid} style={{ color: "var(--pk-graph-node-muted)", opacity: 0.8 }}>
          {formatCid(cid, 10, 6)}
        </div>
      )}
      {data.type && <div className="capitalize">{data.type}</div>}
      {data.size && <div>{formatBytes(data.size)}</div>}
      {data.locations?.[0]?.provider && (
        <div className="flex items-center gap-1">
          <MapPin size={9} />
          <span>{data.locations[0].provider}</span>
        </div>
      )}
    </div>
  );
}

function ActionDetail({ data }: { data: Record<string, any> }) {
  return (
    <div className="text-xs space-y-1" style={{ color: "var(--pk-graph-node-muted)" }}>
      {data.type && <div>{formatActionType(data.type)}</div>}
      {data.timestamp && (
        <div className="flex items-center gap-1">
          <Clock size={9} />
          <span>{formatDate(data.timestamp)}</span>
        </div>
      )}
      {data["ext:ai@1.0.0"] && (
        <div className="flex items-center gap-1" style={{ color: "var(--pk-role-ai)" }}>
          <Bot size={9} />
          <span>{data["ext:ai@1.0.0"].provider} {data["ext:ai@1.0.0"].model}</span>
        </div>
      )}
    </div>
  );
}

function EntityDetail({ data }: { data: Record<string, any> }) {
  const isAI = data.role === "ai";
  return (
    <div className="text-xs space-y-1" style={{ color: "var(--pk-graph-node-muted)" }}>
      <div className="capitalize flex items-center gap-1">
        {isAI && <Bot size={9} style={{ color: "var(--pk-role-ai)" }} />}
        {data.role}
      </div>
      {data.id && (
        <div className="font-mono truncate" title={data.id} style={{ color: "var(--pk-graph-node-muted)", opacity: 0.8 }}>
          {formatCid(data.id, 8, 4)}
        </div>
      )}
    </div>
  );
}

export function GraphNode({
  node,
  isExpanded,
  onToggleExpand,
  onDragStart,
  isDragging,
}: GraphNodeProps) {
  const cfg = nodeConfig[node.type as keyof typeof nodeConfig] ?? nodeConfig.resource;
  const { Icon } = cfg;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart(node.id, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.id);
  };

  return (
    <div
      className={cn(
        "absolute select-none rounded-xl border shadow-lg cursor-grab active:cursor-grabbing",
        "transition-shadow duration-150"
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        zIndex: isDragging ? 1000 : 1,
        backgroundColor: "var(--pk-graph-node-bg)",
        borderColor: isDragging ? cfg.accentColor : cfg.borderColor,
        boxShadow: isDragging
          ? `0 0 0 2px ${cfg.accentColor}40, 0 8px 32px rgba(0,0,0,0.2)`
          : "0 2px 8px rgba(0,0,0,0.08)",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Colored accent bar at top */}
      <div
        className="h-[3px] rounded-t-xl"
        style={{ backgroundColor: cfg.accentColor }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ backgroundColor: cfg.accentMuted }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} strokeWidth={2} style={{ color: cfg.accentColor, flexShrink: 0 }} />
          <span
            className="text-xs font-semibold truncate"
            style={{ color: "var(--pk-graph-node-text)" }}
          >
            {node.label || cfg.label}
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 ml-1"
          style={{ color: "var(--pk-graph-node-muted)" }}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Detail body */}
      <div className="px-3 py-2.5" onClick={handleClick}>
        {node.type === "resource" && <ResourceDetail data={node.data} />}
        {node.type === "action" && <ActionDetail data={node.data} />}
        {node.type === "entity" && <EntityDetail data={node.data} />}

        {/* Extension data (only when expanded) */}
        {isExpanded &&
          Object.entries(node.data)
            .filter(([k]) => k.startsWith("ext:"))
            .map(([k, v]) => (
              <div
                key={k}
                className="mt-2 pt-2"
                style={{ borderTop: "1px solid var(--pk-graph-node-border)" }}
              >
                <div className="text-[10px] font-mono mb-1 truncate" style={{ color: "var(--pk-graph-node-muted)" }}>
                  {k}
                </div>
                {typeof v === "object" && v !== null && (
                  <div className="text-xs space-y-0.5">
                    {Object.entries(v as Record<string, unknown>)
                      .filter(([, val]) => val != null && typeof val !== "object")
                      .slice(0, 5)
                      .map(([field, val]) => (
                        <div key={field} className="flex gap-1" style={{ color: "var(--pk-graph-node-muted)" }}>
                          <span className="font-medium truncate">{field}:</span>
                          <span className="truncate" style={{ color: "var(--pk-graph-node-text)" }}>
                            {String(val)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
      </div>
    </div>
  );
}
