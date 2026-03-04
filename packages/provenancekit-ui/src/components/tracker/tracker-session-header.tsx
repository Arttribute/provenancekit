import React from "react";
import { Activity, Layers, Users, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import type { SessionProvenance } from "@provenancekit/sdk";

interface TrackerSessionHeaderProps {
  session: SessionProvenance;
  className?: string;
}

export function TrackerSessionHeader({ session, className }: TrackerSessionHeaderProps) {
  const { summary } = session;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-lg",
        "bg-[var(--pk-surface-muted)] border border-[var(--pk-surface-border)]",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-[var(--pk-node-action)]">
        <Activity size={14} strokeWidth={2} />
        <span className="text-xs font-semibold">Live tracking</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--pk-muted-foreground)] ml-auto">
        <div className="flex items-center gap-1">
          <Zap size={11} strokeWidth={2} />
          <span>{summary.actions} actions</span>
        </div>
        <div className="flex items-center gap-1">
          <Layers size={11} strokeWidth={2} />
          <span>{summary.resources} resources</span>
        </div>
        <div className="flex items-center gap-1">
          <Users size={11} strokeWidth={2} />
          <span>{summary.entities} entities</span>
        </div>
      </div>
    </div>
  );
}
