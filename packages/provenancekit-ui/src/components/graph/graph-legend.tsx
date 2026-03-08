import React from "react";
import { Database, Zap, User } from "lucide-react";
import { cn } from "../../lib/utils";

interface GraphLegendProps {
  className?: string;
}

const items = [
  { Icon: Database, label: "Resource", color: "#3b82f6" },
  { Icon: Zap,      label: "Action",   color: "#22c55e" },
  { Icon: User,     label: "Entity",   color: "#f59e0b" },
];

export function GraphLegend({ className }: GraphLegendProps) {
  return (
    <div
      className={cn("absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg", className)}
      style={{
        backgroundColor: "var(--pk-graph-control-bg)",
        border: "1px solid var(--pk-graph-control-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {items.map(({ Icon, label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon size={11} strokeWidth={2} style={{ color }} />
          <span className="text-xs" style={{ color: "var(--pk-graph-control-text)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
