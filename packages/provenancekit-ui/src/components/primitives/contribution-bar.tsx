import React from "react";
import { cn } from "../../lib/utils";
import { formatBps } from "../../lib/format";

interface ContributionBarProps {
  /** Basis points value: 0–10000 (0% to 100%) */
  bps: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function ContributionBar({
  bps,
  label,
  showLabel = true,
  className,
}: ContributionBarProps) {
  const percent = Math.min(100, Math.max(0, bps / 100));
  const displayLabel = label ?? formatBps(bps);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="flex-1 h-1.5 rounded-full bg-[var(--pk-surface-muted)] overflow-hidden"
        role="progressbar"
        aria-valuenow={bps}
        aria-valuemin={0}
        aria-valuemax={10000}
        aria-label={`Contribution: ${displayLabel}`}
      >
        <div
          className="h-full rounded-full bg-[var(--pk-node-resource)] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums text-[var(--pk-muted-foreground)] w-10 text-right shrink-0">
          {displayLabel}
        </span>
      )}
    </div>
  );
}
