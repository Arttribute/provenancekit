import React from "react";
import { Database, MapPin } from "lucide-react";
import { cn } from "../../lib/utils";
import { CidDisplay } from "../primitives/cid-display";
import { Timestamp } from "../primitives/timestamp";
import { LicenseChip } from "../primitives/license-chip";
import { LicenseExtensionView } from "../extensions/license-extension-view";
import { getLicenseSafe } from "../../lib/extensions";
import { formatBytes } from "../../lib/format";
import type { Resource } from "@provenancekit/eaa-types";

interface ResourceCardProps {
  resource: Resource;
  showExtensions?: boolean;
  className?: string;
}

export function ResourceCard({ resource, showExtensions = true, className }: ResourceCardProps) {
  const license = getLicenseSafe(resource);

  return (
    <div
      className={cn(
        "rounded-xl p-4 space-y-3 transition-colors",
        "bg-[var(--pk-surface)] border border-[var(--pk-surface-border)]",
        "hover:border-[var(--pk-node-resource-border)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--pk-node-resource-muted)] shrink-0">
            <Database size={13} strokeWidth={2} className="text-[var(--pk-node-resource)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--pk-foreground)] capitalize truncate">
            {resource.type}
          </span>
        </div>
        {license && <LicenseChip license={license} showIcons={false} />}
      </div>

      {/* CID */}
      {resource.address?.ref && (
        <CidDisplay cid={resource.address.ref} prefixLen={12} suffixLen={6} />
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs text-[var(--pk-muted-foreground)]">
        <Timestamp iso={resource.createdAt} />
        {(resource.address as any)?.size && (
          <span>{formatBytes((resource.address as any).size)}</span>
        )}
        {(resource.locations?.length ?? 0) > 0 &&
          resource.locations!.slice(0, 2).map((loc, i) => (
            <div key={i} className="flex items-center gap-1">
              <MapPin size={10} />
              <span>{loc.provider ?? (loc.uri ? new URL(loc.uri).hostname : loc.uri)}</span>
            </div>
          ))}
      </div>

      {/* License extension detail */}
      {showExtensions && license && (
        <div className="border-t border-[var(--pk-surface-border)] pt-3">
          <LicenseExtensionView extension={license} />
        </div>
      )}
    </div>
  );
}
