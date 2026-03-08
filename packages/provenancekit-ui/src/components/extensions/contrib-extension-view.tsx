import React from "react";
import { ContributionBar } from "../primitives/contribution-bar";
import type { ContribExtension } from "../../lib/extensions";

interface ContribExtensionViewProps {
  extension: ContribExtension;
  className?: string;
}

function toValue(ext: ContribExtension): number {
  // Normalize to 0-1 range
  if (ext.basis === "percentage") return Math.min(1, ext.weight / 100);
  if (ext.basis === "points") return Math.min(1, ext.weight / 10000);
  return Math.min(1, ext.weight / 10000);
}

export function ContribExtensionView({ extension, className }: ContribExtensionViewProps) {
  const value = toValue(extension);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <ContributionBar value={value} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--pk-muted-foreground, #64748b)" }}>
        {extension.source && (
          <span>
            Source:{" "}
            <span style={{ fontWeight: 600, color: "var(--pk-foreground, #0f172a)", textTransform: "capitalize" }}>
              {extension.source.replace("-", " ")}
            </span>
          </span>
        )}
        {extension.category && (
          <span>
            Category:{" "}
            <span style={{ fontWeight: 600, color: "var(--pk-foreground, #0f172a)" }}>
              {extension.category}
            </span>
          </span>
        )}
      </div>
      {extension.note && (
        <p style={{ fontSize: 12, color: "var(--pk-muted-foreground, #64748b)", fontStyle: "italic", margin: 0 }}>
          {extension.note}
        </p>
      )}
    </div>
  );
}
