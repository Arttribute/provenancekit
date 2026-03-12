"use client";

/**
 * FileOwnershipClaim
 *
 * Shown when a file attachment has no prior provenance in the system.
 * Asks the user whether they own the file:
 *   - Yes → recorded as "create" action by the user (claimed resource)
 *   - No  → recorded as "reference" action (unclaimed/external source)
 *
 * In both cases the file gets a CID in the provenance system so it can
 * be referenced as an inputCid in downstream provenance actions.
 *
 * onClaim is an async callback provided by the host app that should:
 *   1. Upload the file to IPFS / the PK API
 *   2. Record provenance with the appropriate action type
 *   3. Return { cid } so the parent can store it as an inputCid
 */

import React, { useState } from "react";
import { UserCheck, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface FileOwnershipClaimResult {
  cid: string;
  status: "claimed" | "referenced";
}

export interface FileOwnershipClaimProps {
  /**
   * Called when the user makes an ownership decision.
   * `owned = true`  → user created the file
   * `owned = false` → file is from an external / unknown source
   * Should return the CID of the recorded resource.
   */
  onClaim: (owned: boolean) => Promise<FileOwnershipClaimResult>;
  className?: string;
}

type ClaimState = "idle" | "claiming" | "claimed" | "referenced" | "error";

export function FileOwnershipClaim({ onClaim, className }: FileOwnershipClaimProps) {
  const [claimState, setClaimState] = useState<ClaimState>("idle");

  async function handleClaim(owned: boolean) {
    setClaimState("claiming");
    try {
      const result = await onClaim(owned);
      setClaimState(result.status === "claimed" ? "claimed" : "referenced");
    } catch {
      setClaimState("error");
    }
  }

  if (claimState === "claiming") {
    return (
      <div className={cn("flex items-center gap-1 mt-1", className)}>
        <Loader2 size={10} className="animate-spin text-[var(--pk-muted-foreground,#64748b)]" />
        <span className="text-[10px] text-[var(--pk-muted-foreground,#64748b)]">
          Recording provenance…
        </span>
      </div>
    );
  }

  if (claimState === "claimed") {
    return (
      <div className={cn("flex items-center gap-1.5 mt-1", className)}>
        <CheckCircle size={10} className="shrink-0 text-emerald-500" />
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
          Claimed as your work
        </span>
      </div>
    );
  }

  if (claimState === "referenced") {
    return (
      <div className={cn("flex items-center gap-1.5 mt-1", className)}>
        <CheckCircle size={10} className="shrink-0 text-blue-500" />
        <span className="text-[10px] text-blue-600 dark:text-blue-400">
          Recorded as external source
        </span>
      </div>
    );
  }

  if (claimState === "error") {
    return (
      <div className={cn("flex items-center gap-1.5 mt-1", className)}>
        <AlertCircle size={10} className="shrink-0 text-red-500" />
        <span className="text-[10px] text-red-600">Recording failed —</span>
        <button
          type="button"
          onClick={() => setClaimState("idle")}
          className="text-[10px] text-[var(--pk-node-resource,#6366f1)] hover:underline"
        >
          retry
        </button>
      </div>
    );
  }

  // idle — ask the user
  return (
    <div
      className={cn(
        "mt-1 rounded-md border border-[var(--pk-surface-border,#e2e8f0)] bg-[var(--pk-surface,#ffffff)] p-1.5",
        className
      )}
    >
      <p className="text-[10px] text-[var(--pk-muted-foreground,#64748b)] mb-1.5 leading-snug">
        New file — do you own this?
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => handleClaim(true)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
        >
          <UserCheck size={9} />
          Yes, I own it
        </button>
        <button
          type="button"
          onClick={() => handleClaim(false)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[var(--pk-surface-muted,#f1f5f9)] text-[var(--pk-muted-foreground,#64748b)] hover:bg-[var(--pk-surface-muted,#e2e8f0)] transition-colors"
        >
          <ExternalLink size={9} />
          No, I don't
        </button>
      </div>
    </div>
  );
}
