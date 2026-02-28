import React from "react";
import { cn } from "../../lib/utils";
import { EntityAvatar } from "../primitives/entity-avatar";
import { RoleBadge } from "../primitives/role-badge";
import { CidDisplay } from "../primitives/cid-display";
import { AIExtensionView } from "../extensions/ai-extension-view";
import { getAIAgentSafe } from "../../lib/extensions";
import type { Entity } from "@provenancekit/eaa-types";

interface EntityCardProps {
  entity: Entity;
  className?: string;
}

export function EntityCard({ entity, className }: EntityCardProps) {
  const aiAgent = getAIAgentSafe(entity);

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--pk-node-entity-border)]",
        "bg-[var(--pk-node-entity-muted)] p-3 space-y-2",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <EntityAvatar role={entity.role ?? "human"} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-[var(--pk-foreground)] truncate">
              {entity.name ?? "Unnamed entity"}
            </span>
            {entity.role && <RoleBadge role={entity.role} />}
          </div>
          <CidDisplay cid={entity.id} prefixLen={10} suffixLen={6} className="mt-0.5" />
        </div>
      </div>

      {entity.publicKey && (
        <div className="text-xs text-[var(--pk-muted-foreground)]">
          <span className="font-medium">Public key:</span>{" "}
          <span className="font-mono">{entity.publicKey.slice(0, 16)}…</span>
        </div>
      )}

      {aiAgent && (
        <div className="border-t border-[var(--pk-surface-border)] pt-2">
          <AIExtensionView extension={aiAgent} mode="agent" />
        </div>
      )}
    </div>
  );
}
