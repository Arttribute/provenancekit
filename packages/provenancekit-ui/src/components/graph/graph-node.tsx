"use client";

import React, { useState } from "react";
import { Database, Zap, User, Bot, ChevronDown, ChevronUp, MapPin, Clock } from "lucide-react";
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

const nodeConfig = {
  resource: {
    Icon: Database,
    label: "Resource",
    bgClass: "bg-[var(--pk-node-resource-muted)] border-[var(--pk-node-resource-border)]",
    iconClass: "text-[var(--pk-node-resource)]",
    headerClass: "bg-[var(--pk-node-resource)]/10",
  },
  action: {
    Icon: Zap,
    label: "Action",
    bgClass: "bg-[var(--pk-node-action-muted)] border-[var(--pk-node-action-border)]",
    iconClass: "text-[var(--pk-node-action)]",
    headerClass: "bg-[var(--pk-node-action)]/10",
  },
  entity: {
    Icon: User,
    label: "Entity",
    bgClass: "bg-[var(--pk-node-entity-muted)] border-[var(--pk-node-entity-border)]",
    iconClass: "text-[var(--pk-node-entity)]",
    headerClass: "bg-[var(--pk-node-entity)]/10",
  },
} as const;

function ResourceDetail({ data }: { data: Record<string, any> }) {
  const cid = data.cid ?? data.address?.ref;
  return (
    <div className="text-xs space-y-1 text-[var(--pk-muted-foreground)]">
      {cid && (
        <div className="font-mono truncate" title={cid}>
          {formatCid(cid, 10, 6)}
        </div>
      )}
      {data.type && <div className="capitalize">{data.type}</div>}
      {data.size && (
        <div className="flex items-center gap-1">
          <span>{formatBytes(data.size)}</span>
        </div>
      )}
      {data.locations?.[0]?.provider && (
        <div className="flex items-center gap-1">
          <MapPin size={10} />
          <span>{data.locations[0].provider}</span>
        </div>
      )}
    </div>
  );
}

function ActionDetail({ data }: { data: Record<string, any> }) {
  return (
    <div className="text-xs space-y-1 text-[var(--pk-muted-foreground)]">
      {data.type && <div className="capitalize">{formatActionType(data.type)}</div>}
      {data.timestamp && (
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>{formatDate(data.timestamp)}</span>
        </div>
      )}
      {data["ext:ai@1.0.0"] && (
        <div className="flex items-center gap-1 text-[var(--pk-role-ai)]">
          <Bot size={10} />
          <span>{data["ext:ai@1.0.0"].provider} {data["ext:ai@1.0.0"].model}</span>
        </div>
      )}
    </div>
  );
}

function EntityDetail({ data }: { data: Record<string, any> }) {
  const isAI = data.role === "ai";
  return (
    <div className="text-xs space-y-1 text-[var(--pk-muted-foreground)]">
      <div className="capitalize flex items-center gap-1">
        {isAI && <Bot size={10} className="text-[var(--pk-role-ai)]" />}
        {data.role}
      </div>
      {data.id && (
        <div className="font-mono truncate" title={data.id}>
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
  const cfg = nodeConfig[node.type] ?? nodeConfig.resource;
  const { Icon } = cfg;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart(node.id, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only toggle expand if not dragging (click without significant movement)
    e.stopPropagation();
    onToggleExpand(node.id);
  };

  return (
    <div
      className={cn(
        "absolute select-none rounded-[var(--pk-radius)] border shadow-sm",
        "transition-shadow duration-150",
        cfg.bgClass,
        "bg-[var(--pk-surface)]",
        isDragging ? "shadow-xl ring-2 ring-[var(--pk-node-resource)]/50 z-50" : "hover:shadow-md",
        "cursor-grab active:cursor-grabbing"
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        zIndex: isDragging ? 1000 : 1,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Node header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-t-[calc(var(--pk-radius)-1px)]",
          cfg.headerClass
        )}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={13} strokeWidth={2} className={cn("shrink-0", cfg.iconClass)} />
          <span className="text-xs font-semibold text-[var(--pk-foreground)] truncate">
            {node.label || cfg.label}
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 text-[var(--pk-muted-foreground)] hover:text-[var(--pk-foreground)]"
          aria-label={isExpanded ? "Collapse node" : "Expand node"}
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Collapsed summary */}
      {!isExpanded && (
        <div className="px-3 py-2" onClick={handleClick}>
          {node.type === "resource" && <ResourceDetail data={node.data} />}
          {node.type === "action" && <ActionDetail data={node.data} />}
          {node.type === "entity" && <EntityDetail data={node.data} />}
        </div>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2" onClick={handleClick}>
          {node.type === "resource" && <ResourceDetail data={node.data} />}
          {node.type === "action" && <ActionDetail data={node.data} />}
          {node.type === "entity" && <EntityDetail data={node.data} />}

          {/* Raw extension data (simplified) */}
          {Object.entries(node.data)
            .filter(([k]) => k.startsWith("ext:"))
            .map(([k, v]) => (
              <div key={k} className="border-t border-[var(--pk-surface-border)] pt-2">
                <div className="text-xs font-mono text-[var(--pk-muted-foreground)] mb-1 truncate">
                  {k}
                </div>
                {typeof v === "object" && v !== null && (
                  <div className="text-xs space-y-0.5">
                    {Object.entries(v as Record<string, unknown>)
                      .filter(([, val]) => val != null && typeof val !== "object")
                      .slice(0, 5)
                      .map(([field, val]) => (
                        <div key={field} className="flex gap-1 text-[var(--pk-muted-foreground)]">
                          <span className="font-medium min-w-0 truncate">{field}:</span>
                          <span className="truncate">{String(val)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
