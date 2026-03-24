"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Database, Zap, User, Bot, MapPin, Clock } from "lucide-react";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatCid(cid: string, head = 8, tail = 5): string {
  if (!cid || cid.length <= head + tail + 3) return cid;
  return `${cid.slice(0, head)}…${cid.slice(-tail)}`;
}
function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatActionType(t: string): string {
  return t.replace(/^ext:/, "").replace(/@[\d.]+$/, "").replace(/-/g, " ");
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// ─── Node card wrapper ─────────────────────────────────────────────────────────
//
// Design: clean white/dark card, neutral border, minimal color usage.
// Color is only used for:
//   - The 3px top accent bar
//   - The type icon
// Everything else is monochromatic.

function NodeCard({
  accentColor,
  icon,
  typeLabel,
  highlighted,
  dimmed,
  children,
}: {
  accentColor: string;
  icon: React.ReactNode;
  typeLabel: string;
  highlighted?: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 260,
        background: "var(--pk-graph-node-bg, #fff)",
        // Neutral border unless highlighted — then we use a slightly stronger neutral, not colored
        border: `1px solid ${highlighted ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.09)"}`,
        borderRadius: 10,
        overflow: "hidden",
        // Subtle shadow, slightly stronger when highlighted
        // Opacity is managed at the ReactFlow node wrapper level, not here
        boxShadow: highlighted
          ? "0 4px 20px rgba(0,0,0,0.14)"
          : "0 1px 6px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
      }}
    >
      {/* Thin color accent bar at top — the ONLY place color is used on the card */}
      <div style={{ height: 3, background: accentColor }} />
      {/* Content */}
      <div style={{ padding: "9px 12px 10px" }}>
        {/* Type header: icon (colored) + type label (neutral) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          {icon}
          <span
            style={{
              fontWeight: 600,
              fontSize: 11,
              color: "var(--pk-graph-node-text, #111)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {typeLabel}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Resource Node ─────────────────────────────────────────────────────────────

export function ResourceNode({ data }: NodeProps) {
  const cid = (data as any).cid ?? (data as any).address?.ref;
  const highlighted = !!(data as any)._highlighted;
  const dimmed = !!(data as any)._dimmed;

  // Handle color: muted blue, used only for accent bar + icon
  const accentColor = "#3b82f6";

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "rgba(0,0,0,0.25)" }}
      />
      <NodeCard
        accentColor={accentColor}
        icon={<Database size={12} color={accentColor} strokeWidth={2} />}
        typeLabel="Resource"
        highlighted={highlighted}
        dimmed={dimmed}
      >
        {(data as any).label && (
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pk-graph-node-text, #111)", marginBottom: 4, lineHeight: 1.35 }}>
            {String((data as any).label)}
          </div>
        )}
        {cid && (
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--pk-graph-node-muted, #666)", wordBreak: "break-all" }}>
            {formatCid(String(cid))}
          </div>
        )}
        {(data as any).type && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 2 }}>
            {String((data as any).type)}
          </div>
        )}
        {(data as any).size && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-muted, #666)" }}>
            {formatBytes(Number((data as any).size))}
          </div>
        )}
        {(data as any).locations?.[0]?.provider && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 3 }}>
            <MapPin size={9} color="currentColor" />
            {String((data as any).locations[0].provider)}
          </div>
        )}
      </NodeCard>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "rgba(0,0,0,0.25)" }}
      />
    </>
  );
}

// ─── Action Node ──────────────────────────────────────────────────────────────

export function ActionNode({ data }: NodeProps) {
  const aiExt = (data as any)["ext:ai@1.0.0"];
  const highlighted = !!(data as any)._highlighted;
  const dimmed = !!(data as any)._dimmed;

  const accentColor = "#10b981"; // emerald — used only on accent bar + icon

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "rgba(0,0,0,0.25)" }}
      />
      <NodeCard
        accentColor={accentColor}
        icon={<Zap size={12} color={accentColor} strokeWidth={2} />}
        typeLabel="Action"
        highlighted={highlighted}
        dimmed={dimmed}
      >
        {(data as any).label && (
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pk-graph-node-text, #111)", marginBottom: 4, lineHeight: 1.35 }}>
            {String((data as any).label)}
          </div>
        )}
        {(data as any).type && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginBottom: 3 }}>
            {formatActionType(String((data as any).type))}
          </div>
        )}
        {(data as any).timestamp && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)" }}>
            <Clock size={9} color="currentColor" />
            {formatDate(String((data as any).timestamp))}
          </div>
        )}
        {aiExt && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 3 }}>
            <Bot size={9} color="currentColor" />
            {aiExt.provider} · {aiExt.model}
          </div>
        )}
      </NodeCard>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "rgba(0,0,0,0.25)" }}
      />
    </>
  );
}

// ─── Entity Node ──────────────────────────────────────────────────────────────

export function EntityNode({ data }: NodeProps) {
  const isAI = (data as any).role === "ai";
  const highlighted = !!(data as any)._highlighted;
  const dimmed = !!(data as any)._dimmed;

  const accentColor = "#f59e0b"; // amber — used only on accent bar + icon

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "rgba(0,0,0,0.25)" }}
      />
      <NodeCard
        accentColor={accentColor}
        icon={
          isAI
            ? <Bot size={12} color={accentColor} strokeWidth={2} />
            : <User size={12} color={accentColor} strokeWidth={2} />
        }
        typeLabel="Entity"
        highlighted={highlighted}
        dimmed={dimmed}
      >
        {(data as any).label && (
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pk-graph-node-text, #111)", marginBottom: 4, lineHeight: 1.35 }}>
            {String((data as any).label)}
          </div>
        )}
        {(data as any).name && (data as any).name !== (data as any).label && (
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--pk-graph-node-text, #111)", marginBottom: 2 }}>
            {String((data as any).name)}
          </div>
        )}
        {(data as any).role && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-muted, #666)", textTransform: "capitalize" }}>
            {String((data as any).role)}
          </div>
        )}
        {(data as any).id && (
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 3, wordBreak: "break-all" }}>
            {formatCid(String((data as any).id), 8, 4)}
          </div>
        )}
      </NodeCard>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "rgba(0,0,0,0.25)" }}
      />
    </>
  );
}

export const nodeTypes = {
  resource: ResourceNode,
  action: ActionNode,
  entity: EntityNode,
};
