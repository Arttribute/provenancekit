"use client";

import React from "react";
import { ContributionBar } from "../primitives/contribution-bar";
import { EntityAvatar } from "../primitives/entity-avatar";
import { RoleBadge } from "../primitives/role-badge";
import { getContribSafe } from "../../lib/extensions";
import type { Attribution, Entity } from "@provenancekit/eaa-types";

interface AttributionListProps {
  attributions: Attribution[];
  entities: Entity[];
  showContribution?: boolean;
}

function computeWeights(attrs: Attribution[]): Map<string, number> {
  const map = new Map<string, number>();
  // Try to get contrib extension weights; fall back to equal weight
  const weights = attrs.map((a) => {
    const contrib = getContribSafe(a);
    if (contrib) {
      return contrib.basis === "percentage" ? contrib.weight : contrib.weight / 100;
    }
    return 1;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  attrs.forEach((a, i) => {
    const id = a.entityId as string;
    const existing = map.get(id) ?? 0;
    map.set(id, existing + weights[i]! / total);
  });
  return map;
}

export function AttributionList({
  attributions,
  entities,
  showContribution,
}: AttributionListProps) {
  const weights = showContribution ? computeWeights(attributions) : new Map<string, number>();

  const uniqueEntityIds = Array.from(new Set(attributions.map((a) => a.entityId as string)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {uniqueEntityIds.map((entityId) => {
        const entity = entities.find((e) => e.id === entityId);
        if (!entity) return null;
        const pct = weights.get(entityId) ?? 0;

        return (
          <div
            key={entityId}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <EntityAvatar role={entity.role ?? "human"} size="md" />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                {entity.name ?? String(entityId).slice(0, 16) + "…"}
              </div>
              <RoleBadge role={entity.role ?? "human"} />
            </div>

            {showContribution && pct > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 100 }}>
                <ContributionBar value={pct} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
