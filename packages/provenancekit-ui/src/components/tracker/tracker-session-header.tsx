import React from "react";
import { Activity, Zap, Layers, Users } from "lucide-react";
import type { SessionProvenance } from "@provenancekit/sdk";

interface TrackerSessionHeaderProps {
  session: SessionProvenance;
  className?: string;
}

function StatChip({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 8,
        background: "var(--pk-surface, #fff)",
        border: "1px solid var(--pk-surface-border, #e2e8f0)",
        fontSize: 12,
        color: "var(--pk-foreground, #0f172a)",
      }}
    >
      <Icon size={12} strokeWidth={2} style={{ color: "var(--pk-muted-foreground, #64748b)", flexShrink: 0 }} />
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ color: "var(--pk-muted-foreground, #64748b)" }}>{label}</span>
    </div>
  );
}

export function TrackerSessionHeader({ session, className }: TrackerSessionHeaderProps) {
  const { summary } = session;
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 12,
        background: "var(--pk-surface-muted, #f8fafc)",
        border: "1px solid var(--pk-surface-border, #e2e8f0)",
        flexWrap: "wrap",
      }}
    >
      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 4 }}>
        <span style={{ position: "relative", display: "inline-flex" }}>
          {/* Pulsing ring */}
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "#22c55e",
              opacity: 0.35,
              animation: "pk-ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          <span
            style={{
              position: "relative",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              display: "block",
            }}
          />
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>Live</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <StatChip icon={Zap} value={summary.actions} label="actions" />
        <StatChip icon={Layers} value={summary.resources} label="resources" />
        <StatChip icon={Users} value={summary.entities} label="entities" />
      </div>
    </div>
  );
}
