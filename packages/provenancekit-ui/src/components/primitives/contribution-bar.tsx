import React from "react";

interface ContributionBarProps {
  /** 0–1 decimal (e.g. 0.7 = 70%) */
  value: number;
  className?: string;
}

export function ContributionBar({ value, className }: ContributionBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "var(--pk-surface-border, #e2e8f0)",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: "var(--pk-node-resource, #3b82f6)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--pk-foreground, #0f172a)",
          minWidth: 36,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
