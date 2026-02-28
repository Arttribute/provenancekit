import React from "react";
import { CheckCircle, XCircle, AlertCircle, MinusCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { VerificationIndicator } from "../primitives/verification-indicator";
import type { VerificationExtension } from "../../lib/extensions";

interface VerificationViewProps {
  extension: VerificationExtension;
  showClaims?: boolean;
  className?: string;
}

type ClaimStatus = "verified" | "receipt-backed" | "unverified" | "failed" | "skipped";

function ClaimIcon({ status }: { status: ClaimStatus }) {
  if (status === "verified") return <CheckCircle size={11} strokeWidth={2} className="text-[var(--pk-verified)] shrink-0" />;
  if (status === "failed") return <XCircle size={11} strokeWidth={2} className="text-[var(--pk-failed)] shrink-0" />;
  if (status === "receipt-backed") return <CheckCircle size={11} strokeWidth={2} className="text-[var(--pk-partial)] shrink-0" />;
  if (status === "skipped") return <MinusCircle size={11} strokeWidth={2} className="text-[var(--pk-unverified)] shrink-0" />;
  return <AlertCircle size={11} strokeWidth={2} className="text-[var(--pk-unverified)] shrink-0" />;
}

const CLAIM_LABELS: Record<string, string> = {
  identity: "Identity",
  action: "Authorization",
  output: "Output binding",
  tool: "Tool attestation",
  inputs: "Input existence",
  attestation: "Environment",
};

export function VerificationView({
  extension,
  showClaims = true,
  className,
}: VerificationViewProps) {
  const claimEntries = Object.entries(extension.claims ?? {}).filter(([, v]) => v != null);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <VerificationIndicator status={extension.status} showLabel size="sm" />
        <span className="text-xs text-[var(--pk-muted-foreground)]">
          ({extension.policyUsed})
        </span>
      </div>

      {showClaims && claimEntries.length > 0 && (
        <div className="space-y-1">
          {claimEntries.map(([claimKey, claim]) => (
            <div key={claimKey} className="flex items-center gap-2">
              <ClaimIcon status={(claim as any).status as ClaimStatus} />
              <span className="text-xs text-[var(--pk-muted-foreground)]">
                {CLAIM_LABELS[claimKey] ?? claimKey}
              </span>
              {(claim as any).detail && (
                <span className="text-xs text-[var(--pk-muted-foreground)] truncate">
                  — {(claim as any).detail}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
