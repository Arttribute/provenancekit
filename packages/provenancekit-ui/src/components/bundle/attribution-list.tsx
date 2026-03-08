import React from "react";
import { cn } from "../../lib/utils";
import { EntityAvatar } from "../primitives/entity-avatar";
import { RoleBadge } from "../primitives/role-badge";
import { ContributionBar } from "../primitives/contribution-bar";
import { getContribSafe } from "../../lib/extensions";
import type { Attribution, Entity } from "@provenancekit/eaa-types";

interface AttributionListProps {
  attributions: Attribution[];
  entities: Entity[];
  showContribution?: boolean;
  className?: string;
}

export function AttributionList({
  attributions,
  entities,
  showContribution = true,
  className,
}: AttributionListProps) {
  if (attributions.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {attributions.map((attr, i) => {
        const entity = entities.find((e) => e.id === attr.entityId);
        const contrib = getContribSafe(attr);
        const bps = contrib
          ? contrib.basis === "percentage"
            ? Math.round(contrib.weight * 100)
            : contrib.weight
          : null;

        return (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--pk-surface)] border border-[var(--pk-surface-border)] hover:border-[var(--pk-node-resource-border)] transition-colors"
          >
            <EntityAvatar role={entity?.role ?? "human"} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium text-[var(--pk-foreground)] truncate">
                  {entity?.name ?? (attr.entityId ? attr.entityId.slice(0, 12) + "…" : "Unknown")}
                </span>
                {attr.role && <RoleBadge role={attr.role} />}
              </div>
              {attr.note && (
                <p className="text-xs text-[var(--pk-muted-foreground)] mt-0.5 italic">
                  {attr.note}
                </p>
              )}
            </div>
            {showContribution && bps !== null && (
              <div className="shrink-0 w-32">
                <ContributionBar bps={bps} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
