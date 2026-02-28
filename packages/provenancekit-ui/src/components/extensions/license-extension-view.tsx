import React from "react";
import { Scale, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";
import { LicenseChip } from "../primitives/license-chip";
import type { LicenseExtension } from "../../lib/extensions";

interface LicenseExtensionViewProps {
  extension: LicenseExtension;
  className?: string;
}

export function LicenseExtensionView({ extension, className }: LicenseExtensionViewProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground)]">
        <Scale size={12} strokeWidth={2} />
        <span className="text-xs font-semibold text-[var(--pk-foreground)]">License</span>
      </div>

      <LicenseChip license={extension} />

      <div className="space-y-1 text-xs text-[var(--pk-muted-foreground)]">
        {extension.commercial !== undefined && (
          <div>Commercial use: <span className="font-medium text-[var(--pk-foreground)]">{extension.commercial ? "Allowed" : "Not allowed"}</span></div>
        )}
        {extension.derivatives !== undefined && (
          <div>Derivatives: <span className="font-medium text-[var(--pk-foreground)]">{extension.derivatives ? "Allowed" : "Not allowed"}</span></div>
        )}
        {extension.attribution && (
          <div>Attribution: <span className="font-medium text-[var(--pk-foreground)] capitalize">{extension.attribution}</span></div>
        )}
        {extension.attribution === "required" && extension.attributionText && (
          <div className="italic text-[var(--pk-foreground)]">"{extension.attributionText}"</div>
        )}
        {extension.expires && (
          <div>Expires: <span className="font-medium text-[var(--pk-foreground)]">{new Date(extension.expires).toLocaleDateString()}</span></div>
        )}
      </div>

      {extension.termsUrl && (
        <a
          href={extension.termsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--pk-node-resource)] hover:underline"
        >
          View full terms
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}
