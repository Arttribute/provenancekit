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
        "rounded-xl p-4 space-y-3 transition-colors",
        "bg-[var(--pk-surface)] border border-[var(--pk-surface-border)]",
        "hover:border-[var(--pk-node-entity-border)]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <EntityAvatar role={entity.role ?? "human"} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--pk-foreground)] truncate">
              {entity.name ?? "Unnamed entity"}
            </span>
            {entity.role && <RoleBadge role={entity.role} />}
          </div>
          <CidDisplay cid={entity.id} prefixLen={10} suffixLen={6} className="mt-0.5" />
        </div>
      </div>

      {entity.publicKey && (
        <div className="text-xs px-2.5 py-1.5 rounded-lg font-mono truncate bg-[var(--pk-surface-muted)] text-[var(--pk-muted-foreground)]">
          {entity.publicKey.slice(0, 24)}…
        </div>
      )}

      {aiAgent && (
        <div className="border-t border-[var(--pk-surface-border)] pt-3">
          <AIExtensionView extension={aiAgent} mode="agent" />
        </div>
      )}
    </div>
  );
}
