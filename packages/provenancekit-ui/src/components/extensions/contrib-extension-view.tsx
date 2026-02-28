import React from "react";
import { cn } from "../../lib/utils";
import { ContributionBar } from "../primitives/contribution-bar";
import type { ContribExtension } from "../../lib/extensions";

interface ContribExtensionViewProps {
  extension: ContribExtension;
  className?: string;
}

function toBps(ext: ContribExtension): number {
  if (ext.basis === "percentage") return Math.round(ext.weight * 100);
  if (ext.basis === "points") return ext.weight;
  return ext.weight; // absolute — display as-is, cap at 10000
}

export function ContribExtensionView({ extension, className }: ContribExtensionViewProps) {
  const bps = toBps(extension);

  return (
    <div className={cn("space-y-1.5", className)}>
      <ContributionBar bps={bps} />
      <div className="flex items-center gap-3 text-xs text-[var(--pk-muted-foreground)]">
        {extension.source && (
          <span>Source: <span className="font-medium text-[var(--pk-foreground)] capitalize">{extension.source.replace("-", " ")}</span></span>
        )}
        {extension.category && (
          <span>Category: <span className="font-medium text-[var(--pk-foreground)]">{extension.category}</span></span>
        )}
      </div>
      {extension.note && (
        <p className="text-xs text-[var(--pk-muted-foreground)] italic">{extension.note}</p>
      )}
    </div>
  );
}
