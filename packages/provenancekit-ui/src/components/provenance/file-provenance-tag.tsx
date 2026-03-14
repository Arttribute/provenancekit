"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  ShieldOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
  Bot,
  FileImage,
  Tag,
  Calendar,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useProvenanceKit } from "../../context/provenance-kit-provider";
import { CidDisplay } from "../primitives/cid-display";
import { formatDate } from "../../lib/format";
import { FileOwnershipClaim, type FileOwnershipClaimResult } from "./file-ownership-claim";
import type { UploadMatchResult, ProvenanceBundle } from "@provenancekit/sdk";

export interface FileProvenanceTagProps {
  /** The File or Blob to search for provenance */
  file: File | Blob;
  /** Called when user clicks "View Full Provenance" */
  onViewDetail?: (cid: string) => void;
  /**
   * Called when the file has no prior provenance and the user makes an ownership decision.
   * `owned = true` → record as "create" (user is the creator)
   * `owned = false` → record as "reference" (external/unknown source)
   * Should upload the file and return its CID + status.
   * If omitted, falls back to a plain "No prior provenance" label.
   */
  onClaim?: (owned: boolean) => Promise<FileOwnershipClaimResult>;
  /**
   * Called when existing provenance is found (match score ≥ threshold).
   * The host should use this CID as the inputCid for any subsequent provenance
   * actions (e.g. the generate action that uses this file as input), so that
   * the new action references the existing provenance chain rather than a
   * disconnected raw IPFS CID.
   */
  onMatchFound?: (cid: string) => void;
  /** Max matches to request (default 3) */
  topK?: number;
  className?: string;
}

interface ProvenanceState {
  status: "idle" | "loading" | "found" | "not-found" | "error";
  result?: UploadMatchResult;
  topBundle?: ProvenanceBundle;
}

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 90
      ? "bg-[var(--pk-verified,#22c55e)]"
      : pct >= 70
      ? "bg-[var(--pk-partial,#f59e0b)]"
      : "bg-[var(--pk-unverified,#ef4444)]";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1 rounded-full bg-[var(--pk-surface-muted,#f1f5f9)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-[var(--pk-muted-foreground,#64748b)] shrink-0 w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

function BundleSummary({
  bundle,
  cid,
  onViewDetail,
  extraMatches,
}: {
  bundle: ProvenanceBundle;
  cid: string;
  onViewDetail?: (cid: string) => void;
  extraMatches?: number;
}) {
  const creator = bundle.entities?.find(
    (e) => e.role === "human" || e.role === "creator"
  );
  const aiEntity = bundle.entities?.find((e) => e.role === "ai");
  const topAction = bundle.actions?.[0];
  const topResource = bundle.resources?.[0];

  const licenseExt = topResource?.extensions?.["ext:license@1.0.0"] as
    | { spdxId?: string; name?: string }
    | undefined;
  const aiExt = topAction?.extensions?.["ext:ai@1.0.0"] as
    | { provider?: string; model?: string }
    | undefined;

  return (
    <div className="space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <CidDisplay cid={cid} showCopy={true} />
        {onViewDetail && (
          <button
            type="button"
            onClick={() => onViewDetail(cid)}
            className="text-[10px] text-[var(--pk-node-resource,#6366f1)] hover:underline shrink-0"
          >
            View full →
          </button>
        )}
      </div>

      {creator && (
        <div className="flex items-center gap-1.5 text-[var(--pk-foreground,#0f172a)]">
          <User size={10} className="shrink-0 text-[var(--pk-role-human,#3b82f6)]" />
          <span className="truncate">{creator.name ?? creator.id}</span>
        </div>
      )}

      {aiEntity && !aiExt && (
        <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]">
          <Bot size={10} className="shrink-0 text-[var(--pk-role-ai,#a855f7)]" />
          <span className="truncate">{aiEntity.name ?? aiEntity.id}</span>
        </div>
      )}

      {aiExt && (aiExt.provider || aiExt.model) && (
        <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]">
          <Bot size={10} className="shrink-0 text-[var(--pk-role-ai,#a855f7)]" />
          <span className="truncate">
            {[aiExt.provider, aiExt.model].filter(Boolean).join(" / ")}
          </span>
        </div>
      )}

      {topResource?.type && (
        <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]">
          <FileImage size={10} className="shrink-0" />
          <span className="capitalize">{topResource.type}</span>
        </div>
      )}

      {topAction?.type && (
        <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]">
          <Tag size={10} className="shrink-0" />
          <span className="capitalize">{topAction.type}</span>
        </div>
      )}

      {licenseExt && (licenseExt.spdxId || licenseExt.name) && (
        <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]">
          <ShieldCheck size={10} className="shrink-0" />
          <span className="truncate">{licenseExt.spdxId ?? licenseExt.name}</span>
        </div>
      )}

      {topAction?.timestamp && (
        <div className="flex items-center gap-1.5 text-[var(--pk-muted-foreground,#64748b)]">
          <Calendar size={10} className="shrink-0" />
          <span>{formatDate(topAction.timestamp)}</span>
        </div>
      )}

      {bundle.attributions && bundle.attributions.length > 0 && (
        <p className="text-[var(--pk-muted-foreground,#64748b)]">
          {bundle.attributions.length} attribution
          {bundle.attributions.length > 1 ? "s" : ""}
        </p>
      )}

      {extraMatches != null && extraMatches > 0 && (
        <p className="text-[var(--pk-muted-foreground,#64748b)] border-t border-[var(--pk-surface-border,#e2e8f0)] pt-1.5 mt-1">
          +{extraMatches} more similar record{extraMatches > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

export function FileProvenanceTag({
  file,
  onViewDetail,
  onClaim,
  onMatchFound,
  topK = 3,
  className,
}: FileProvenanceTagProps) {
  const { pk } = useProvenanceKit();
  const [state, setState] = useState<ProvenanceState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  const search = useCallback(async () => {
    if (!pk || !file) return;
    setState({ status: "loading" });
    try {
      const result = await pk.uploadAndMatch(file, { topK });
      if (!result.matches || result.matches.length === 0 || result.verdict === "no-match") {
        setState({ status: "not-found", result });
        return;
      }
      const topCid = result.matches[0].cid;
      let topBundle: ProvenanceBundle | undefined;
      try {
        topBundle = await pk.bundle(topCid);
      } catch {
        // bundle fetch is non-fatal
      }
      setState({ status: "found", result, topBundle });
      // Notify the host so it can use the matched CID as inputCid for downstream
      // provenance actions — the generate action will reference this existing chain
      // rather than a disconnected raw IPFS upload.
      onMatchFound?.(topCid);
    } catch {
      // silent — don't break the upload UX
      setState({ status: "error" });
    }
  }, [pk, file, topK, onMatchFound]);

  // Run once on mount
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pk || state.status === "idle" || state.status === "error") return null;

  if (state.status === "loading") {
    return (
      <div className={cn("flex items-center gap-1 mt-1", className)}>
        <Loader2 size={10} className="animate-spin text-[var(--pk-muted-foreground,#94a3b8)]" />
        <span className="text-[10px] text-[var(--pk-muted-foreground,#94a3b8)]">
          Checking provenance…
        </span>
      </div>
    );
  }

  if (state.status === "not-found") {
    // If the host provides an onClaim callback, let the user claim ownership.
    // Otherwise fall back to a simple label.
    if (onClaim) {
      return <FileOwnershipClaim onClaim={onClaim} className={className} />;
    }
    return (
      <div className={cn("flex items-center gap-1 mt-1", className)}>
        <ShieldOff size={10} className="text-[var(--pk-muted-foreground,#94a3b8)]" />
        <span className="text-[10px] text-[var(--pk-muted-foreground,#94a3b8)]">
          No prior provenance found
        </span>
      </div>
    );
  }

  const topMatch = state.result?.matches?.[0];
  if (!topMatch) return null;

  const creator = state.topBundle?.entities?.find(
    (e) => e.role === "human" || e.role === "creator"
  );
  const headerLabel = creator?.name
    ? `By ${creator.name}`
    : `${Math.round(topMatch.score * 100)}% match`;

  const extraMatches = (state.result?.matches?.length ?? 0) - 1;

  return (
    <div
      className={cn(
        "mt-1 rounded-md border border-[var(--pk-surface-border,#e2e8f0)] bg-[var(--pk-surface,#ffffff)] overflow-hidden",
        className
      )}
    >
      {/* Header: clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 pt-1.5 pb-1 hover:bg-[var(--pk-surface-muted,#f8fafc)] transition-colors"
      >
        <ShieldCheck size={10} className="shrink-0 text-[var(--pk-verified,#22c55e)]" />
        <span className="text-[10px] font-medium truncate flex-1 text-left text-[var(--pk-foreground,#0f172a)]">
          {headerLabel}
        </span>
        {topMatch.type && (
          <span className="text-[10px] capitalize text-[var(--pk-muted-foreground,#64748b)] shrink-0 mr-1">
            {topMatch.type}
          </span>
        )}
        {expanded ? (
          <ChevronUp size={10} className="shrink-0 text-[var(--pk-muted-foreground,#64748b)]" />
        ) : (
          <ChevronDown size={10} className="shrink-0 text-[var(--pk-muted-foreground,#64748b)]" />
        )}
      </button>

      {/* Similarity bar — always visible */}
      <div className="px-2 pb-1.5">
        <SimilarityBar score={topMatch.score} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[var(--pk-surface-border,#e2e8f0)] p-2">
          {state.topBundle ? (
            <BundleSummary
              bundle={state.topBundle}
              cid={topMatch.cid}
              onViewDetail={onViewDetail}
              extraMatches={extraMatches > 0 ? extraMatches : undefined}
            />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <CidDisplay cid={topMatch.cid} showCopy={true} />
              {onViewDetail && (
                <button
                  type="button"
                  onClick={() => onViewDetail(topMatch.cid)}
                  className="text-[10px] text-[var(--pk-node-resource,#6366f1)] hover:underline shrink-0"
                >
                  View full →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
