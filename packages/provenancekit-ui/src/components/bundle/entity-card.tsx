"use client";

import React from "react";
import { User, Bot, Building2 } from "lucide-react";
import { EntityAvatar } from "../primitives/entity-avatar";
import { RoleBadge } from "../primitives/role-badge";
import type { Entity } from "@provenancekit/eaa-types";

interface EntityCardProps {
  entity: Entity;
}

function formatCid(cid: string, head = 8, tail = 5): string {
  if (!cid || cid.length <= head + tail + 3) return cid;
  return `${cid.slice(0, head)}…${cid.slice(-tail)}`;
}

const roleConfig = {
  human: { Icon: User, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", accent: "#3b82f6", accentBg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" },
  ai: { Icon: Bot, color: "#7c3aed", bg: "rgba(124,58,237,0.1)", accent: "#7c3aed", accentBg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)" },
  org: { Icon: Building2, color: "#22c55e", bg: "rgba(34,197,94,0.1)", accent: "#22c55e", accentBg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" },
} as const;

export function EntityCard({ entity }: EntityCardProps) {
  const role = (entity.role ?? "human") as string;
  const cfg = role === "ai" ? roleConfig.ai : role === "organization" ? roleConfig.org : roleConfig.human;

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${cfg.accentBg}`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* Accent top bar */}
      <div style={{ height: 3, background: cfg.accent }} />

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            <EntityAvatar role={entity.role ?? "human"} size="md" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name */}
            {entity.name && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 3 }}>
                {entity.name}
              </div>
            )}

            {/* Role badge */}
            <div style={{ marginBottom: entity.id ? 4 : 0 }}>
              <RoleBadge role={entity.role ?? "human"} />
            </div>

            {/* ID */}
            {entity.id && (
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "#94a3b8",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 5,
                  padding: "2px 6px",
                  display: "inline-block",
                  marginTop: 4,
                }}
              >
                {formatCid(entity.id)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
