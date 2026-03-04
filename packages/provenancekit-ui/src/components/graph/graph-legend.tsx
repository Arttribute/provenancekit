import React from "react";
import { Database, Zap, User } from "lucide-react";
import { cn } from "../../lib/utils";

interface GraphLegendProps {
  className?: string;
}

const items = [
  { Icon: Database, label: "Resource", colorClass: "text-[var(--pk-node-resource)]" },
  { Icon: Zap, label: "Action", colorClass: "text-[var(--pk-node-action)]" },
  { Icon: User, label: "Entity", colorClass: "text-[var(--pk-node-entity)]" },
];

export function GraphLegend({ className }: GraphLegendProps) {
  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5",
        "rounded-lg border border-[var(--pk-surface-border)]",
        "bg-[var(--pk-surface)] shadow-sm",
        className
      )}
    >
      {items.map(({ Icon, label, colorClass }) => (
        <div key={label} className="flex items-center gap-1">
          <Icon size={11} strokeWidth={2} className={colorClass} />
          <span className="text-xs text-[var(--pk-muted-foreground)]">{label}</span>
        </div>
      ))}
    </div>
  );
}
