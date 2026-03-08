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

function NodeCard({
  accentColor,
  accentBg,
  borderColor,
  children,
}: {
  accentColor: string;
  accentBg: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 260,
        background: "var(--pk-graph-node-bg, #fff)",
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: accentColor }} />
      {/* Header */}
      <div
        style={{
          background: accentBg,
          padding: "8px 12px 6px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Resource Node ─────────────────────────────────────────────────────────────

export function ResourceNode({ data }: NodeProps) {
  const cid = (data as any).cid ?? (data as any).address?.ref;
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: "#3b82f6" }} />
      <NodeCard
        accentColor="#3b82f6"
        accentBg="rgba(59,130,246,0.08)"
        borderColor="rgba(59,130,246,0.3)"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Database size={13} color="#3b82f6" strokeWidth={2} />
          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--pk-graph-node-text, #111)" }}>
            Resource
          </span>
        </div>
        {(data as any).label && (
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 3, color: "var(--pk-graph-node-text, #111)" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 2 }}>
            <MapPin size={9} />
            {String((data as any).locations[0].provider)}
          </div>
        )}
      </NodeCard>
      <Handle type="source" position={Position.Right} style={{ background: "#3b82f6" }} />
    </>
  );
}

// ─── Action Node ──────────────────────────────────────────────────────────────

export function ActionNode({ data }: NodeProps) {
  const aiExt = (data as any)["ext:ai@1.0.0"];
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: "#22c55e" }} />
      <NodeCard
        accentColor="#22c55e"
        accentBg="rgba(34,197,94,0.08)"
        borderColor="rgba(34,197,94,0.3)"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Zap size={13} color="#22c55e" strokeWidth={2} />
          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--pk-graph-node-text, #111)" }}>
            Action
          </span>
        </div>
        {(data as any).label && (
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 3, color: "var(--pk-graph-node-text, #111)" }}>
            {String((data as any).label)}
          </div>
        )}
        {(data as any).type && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginBottom: 2 }}>
            {formatActionType(String((data as any).type))}
          </div>
        )}
        {(data as any).timestamp && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--pk-graph-node-muted, #666)" }}>
            <Clock size={9} />
            {formatDate(String((data as any).timestamp))}
          </div>
        )}
        {aiExt && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#a855f7", marginTop: 2 }}>
            <Bot size={9} />
            {aiExt.provider} {aiExt.model}
          </div>
        )}
      </NodeCard>
      <Handle type="source" position={Position.Right} style={{ background: "#22c55e" }} />
    </>
  );
}

// ─── Entity Node ──────────────────────────────────────────────────────────────

export function EntityNode({ data }: NodeProps) {
  const isAI = (data as any).role === "ai";
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: "#f59e0b" }} />
      <NodeCard
        accentColor="#f59e0b"
        accentBg="rgba(245,158,11,0.08)"
        borderColor="rgba(245,158,11,0.3)"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          {isAI ? <Bot size={13} color="#f59e0b" strokeWidth={2} /> : <User size={13} color="#f59e0b" strokeWidth={2} />}
          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--pk-graph-node-text, #111)" }}>
            Entity
          </span>
        </div>
        {(data as any).label && (
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 3, color: "var(--pk-graph-node-text, #111)" }}>
            {String((data as any).label)}
          </div>
        )}
        {(data as any).name && (data as any).name !== (data as any).label && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-text, #111)", fontWeight: 500 }}>
            {String((data as any).name)}
          </div>
        )}
        {(data as any).role && (
          <div style={{ fontSize: 10, color: "var(--pk-graph-node-muted, #666)", textTransform: "capitalize", marginTop: 2 }}>
            {String((data as any).role)}
          </div>
        )}
        {(data as any).id && (
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--pk-graph-node-muted, #666)", marginTop: 2, wordBreak: "break-all" }}>
            {formatCid(String((data as any).id), 8, 4)}
          </div>
        )}
      </NodeCard>
      <Handle type="source" position={Position.Right} style={{ background: "#f59e0b" }} />
    </>
  );
}

export const nodeTypes = {
  resource: ResourceNode,
  action: ActionNode,
  entity: EntityNode,
};
