import React from "react";
import { Scale, DollarSign, GitBranch, Share2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { LicenseExtension } from "../../lib/extensions";

interface LicenseChipProps {
  license?: LicenseExtension | null;
  spdxId?: string;
  showIcons?: boolean;
  className?: string;
}

function formatLicenseLabel(type: string): string {
  // Shorten common SPDX identifiers for display
  const shorts: Record<string, string> = {
    "CC-BY-4.0": "CC BY",
    "CC-BY-SA-4.0": "CC BY-SA",
    "CC-BY-NC-4.0": "CC BY-NC",
    "CC-BY-NC-SA-4.0": "CC BY-NC-SA",
    "CC-BY-ND-4.0": "CC BY-ND",
    "CC0-1.0": "CC0",
    MIT: "MIT",
    "Apache-2.0": "Apache 2.0",
  };
  return shorts[type] ?? type;
}

export function LicenseChip({ 
  license, 
  spdxId, 
  showIcons = true, 
  className 
}: LicenseChipProps) {
  // Support both license object and spdxId string
  const licenseType = license?.type ?? spdxId;
  if (!licenseType) return null;

  const label = formatLicenseLabel(licenseType);
  const isPublicDomain = licenseType === "CC0-1.0" || licenseType === "CC0";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
        "dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        className
      )}
      title={`License: ${licenseType}${license?.termsUrl ? ` — ${license.termsUrl}` : ""}`}
    >
      <Scale size={10} strokeWidth={2} className="shrink-0" />
      <span>{label}</span>
      {showIcons && !isPublicDomain && license && (
        <>
          {license.commercial === false && (
            <span title="Non-commercial">
              <DollarSign size={10} strokeWidth={2} className="shrink-0 text-amber-500" aria-label="Non-commercial" />
            </span>
          )}
          {license.derivatives === false && (
            <span title="No derivatives">
              <GitBranch size={10} strokeWidth={2} className="shrink-0 text-amber-500" aria-label="No derivatives" />
            </span>
          )}
          {license.shareAlike && (
            <span title="Share alike required">
              <Share2 size={10} strokeWidth={2} className="shrink-0 text-blue-500" aria-label="Share alike required" />
            </span>
          )}
        </>
      )}
    </span>
  );
}
