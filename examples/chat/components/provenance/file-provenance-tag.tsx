"use client";

/**
 * FileProvenanceTag
 *
 * Shown on uploaded file attachments in the chat input. When a file is attached,
 * this component runs a background provenance search via pk.uploadAndMatch()
 * and shows an expandable tag with similarity score, author, resource type, etc.
 *
 * NOTE: This component also lives in packages/provenancekit-ui/src for future
 * npm publishing. When @provenancekit/ui >= 0.2.0 is published, switch to
 * importing from "@provenancekit/ui" instead.
 */

import { useEffect, useState, useCallback } from "react";
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
  UserCheck,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Minimal types (mirrors @provenancekit/sdk) ───────────────────────────────

// /search/file returns SearchResult[] directly — a plain array, no wrapper object.
interface Match {
  cid: string;
  type?: string;
  score: number;
}

interface ProvenanceEntity {
  id?: string;
  role?: string;
  name?: string;
}

interface ProvenanceAction {
  type?: string;
  timestamp?: string;
  extensions?: Record<string, unknown>;
}

interface ProvenanceResource {
  type?: string;
  extensions?: Record<string, unknown>;
}

interface ProvenanceBundle {
  entities: ProvenanceEntity[];
  actions: ProvenanceAction[];
  resources: ProvenanceResource[];
  attributions: unknown[];
}

// ── Similarity bar ────────────────────────────────────────────────────────────

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ── Bundle summary (expanded) ─────────────────────────────────────────────────

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
  const creator = bundle.entities?.find((e) => e.role === "human" || e.role === "creator");
  const aiEntity = bundle.entities?.find((e) => e.role === "ai");
  const topAction = bundle.actions?.[0];
  const topResource = bundle.resources?.[0];

  const licenseExt = topResource?.extensions?.["ext:license@1.0.0"] as
    | { spdxId?: string; name?: string }
    | undefined;
  const aiExt = topAction?.extensions?.["ext:ai@1.0.0"] as
    | { provider?: string; model?: string }
    | undefined;

  function formatDate(ts: string) {
    try { return new Date(ts).toLocaleDateString(); } catch { return ts; }
  }

  return (
    <div className="space-y-1.5 text-[11px]">
      {/* CID row */}
      <div className="flex items-center justify-between gap-2">
        <code className="font-mono text-[10px] text-muted-foreground truncate flex-1">
          {cid.slice(0, 32)}…
        </code>
        {onViewDetail && (
          <button
            type="button"
            onClick={() => onViewDetail(cid)}
            className="text-[10px] text-primary hover:underline shrink-0"
          >
            View full →
          </button>
        )}
      </div>

      {creator && (
        <div className="flex items-center gap-1.5 text-foreground">
          <User size={10} className="shrink-0 text-blue-500" />
          <span className="truncate">{creator.name ?? creator.id}</span>
        </div>
      )}

      {aiEntity && !aiExt && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Bot size={10} className="shrink-0 text-purple-500" />
          <span className="truncate">{aiEntity.name ?? aiEntity.id}</span>
        </div>
      )}

      {aiExt && (aiExt.provider || aiExt.model) && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Bot size={10} className="shrink-0 text-purple-500" />
          <span className="truncate">
            {[aiExt.provider, aiExt.model].filter(Boolean).join(" / ")}
          </span>
        </div>
      )}

      {topResource?.type && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FileImage size={10} className="shrink-0" />
          <span className="capitalize">{topResource.type}</span>
        </div>
      )}

      {topAction?.type && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Tag size={10} className="shrink-0" />
          <span className="capitalize">{topAction.type}</span>
        </div>
      )}

      {licenseExt && (licenseExt.spdxId || licenseExt.name) && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ShieldCheck size={10} className="shrink-0" />
          <span className="truncate">{licenseExt.spdxId ?? licenseExt.name}</span>
        </div>
      )}

      {topAction?.timestamp && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar size={10} className="shrink-0" />
          <span>{formatDate(topAction.timestamp)}</span>
        </div>
      )}

      {bundle.attributions && bundle.attributions.length > 0 && (
        <p className="text-muted-foreground">
          {bundle.attributions.length} attribution{bundle.attributions.length > 1 ? "s" : ""}
        </p>
      )}

      {extraMatches != null && extraMatches > 0 && (
        <p className="text-muted-foreground border-t border-border pt-1.5 mt-1">
          +{extraMatches} more similar record{extraMatches > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProvenanceState {
  status: "idle" | "loading" | "found" | "not-found" | "error";
  matches?: Match[];
  topBundle?: ProvenanceBundle;
}

export interface FileProvenanceTagProps {
  file: File | Blob;
  onViewDetail?: (cid: string) => void;
  /**
   * Called when the file has no prior provenance and the user makes an ownership
   * decision. The callback should call /api/pk-proxy/claim and return the CID.
   * If omitted, falls back to a plain "No prior provenance" label.
   */
  onClaim?: (owned: boolean) => Promise<{ cid: string; status: "claimed" | "referenced" }>;
  topK?: number;
  className?: string;
}

// ── Inline ownership-claim UI (mirrors FileOwnershipClaim from @provenancekit/ui) ──

type ClaimState = "idle" | "claiming" | "claimed" | "referenced" | "error";

function OwnershipClaim({
  onClaim,
  className,
}: {
  onClaim: (owned: boolean) => Promise<{ cid: string; status: "claimed" | "referenced" }>;
  className?: string;
}) {
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
        <Loader2 size={10} className="animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Recording provenance…</span>
      </div>
    );
  }
  if (claimState === "claimed") {
    return (
      <div className={cn("flex items-center gap-1.5 mt-1", className)}>
        <CheckCircle size={10} className="shrink-0 text-emerald-500" />
        <span className="text-[10px] text-emerald-600">Claimed as your work</span>
      </div>
    );
  }
  if (claimState === "referenced") {
    return (
      <div className={cn("flex items-center gap-1.5 mt-1", className)}>
        <CheckCircle size={10} className="shrink-0 text-blue-500" />
        <span className="text-[10px] text-blue-600">Recorded as external source</span>
      </div>
    );
  }
  if (claimState === "error") {
    return (
      <div className={cn("flex items-center gap-1.5 mt-1", className)}>
        <AlertCircle size={10} className="shrink-0 text-red-500" />
        <span className="text-[10px] text-red-600">Failed —</span>
        <button type="button" onClick={() => setClaimState("idle")} className="text-[10px] text-primary hover:underline">
          retry
        </button>
      </div>
    );
  }
  return (
    <div className={cn("mt-1 rounded-md border border-border bg-background p-1.5", className)}>
      <p className="text-[10px] text-muted-foreground mb-1.5 leading-snug">
        New file — do you own this?
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => handleClaim(true)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 transition-colors"
        >
          <UserCheck size={9} />
          Yes, I own it
        </button>
        <button
          type="button"
          onClick={() => handleClaim(false)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <ExternalLink size={9} />
          No, I don't
        </button>
      </div>
    </div>
  );
}

export function FileProvenanceTag({
  file,
  onViewDetail,
  onClaim,
  topK = 3,
  className,
}: FileProvenanceTagProps) {
  const [state, setState] = useState<ProvenanceState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  const search = useCallback(async () => {
    setState({ status: "loading" });
    try {
      // Use the pk-proxy to call uploadAndMatch
      const form = new FormData();
      form.append("file", file, (file as File).name ?? "file.bin");
      const res = await fetch(`/api/pk-proxy/search/file?topK=${topK}&min=0`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setState({ status: "error" });
        return;
      }
      // API returns SearchResult[] — a plain array [{ cid, score, type? }, ...]
      const matches: Match[] = await res.json();
      if (!matches?.length) {
        setState({ status: "not-found", matches: [] });
        return;
      }
      // Fetch bundle for top match
      const topCid = matches[0].cid;
      let topBundle: ProvenanceBundle | undefined;
      try {
        const bundleRes = await fetch(`/api/pk-proxy/bundle/${topCid}`);
        if (bundleRes.ok) topBundle = await bundleRes.json();
      } catch { /* non-fatal */ }
      setState({ status: "found", matches, topBundle });
    } catch {
      setState({ status: "error" });
    }
  }, [file, topK]);

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "idle" || state.status === "error") return null;

  if (state.status === "loading") {
    return (
      <div className={cn("flex items-center gap-1 mt-1", className)}>
        <Loader2 size={10} className="animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Checking provenance…</span>
      </div>
    );
  }

  if (state.status === "not-found") {
    if (onClaim) return <OwnershipClaim onClaim={onClaim} className={className} />;
    return (
      <div className={cn("flex items-center gap-1 mt-1", className)}>
        <ShieldOff size={10} className="text-muted-foreground/60" />
        <span className="text-[10px] text-muted-foreground/60">No prior provenance</span>
      </div>
    );
  }

  const topMatch = state.matches?.[0];
  if (!topMatch) return null;

  const creator = state.topBundle?.entities?.find(
    (e) => e.role === "human" || e.role === "creator"
  );
  const headerLabel = creator?.name
    ? `By ${creator.name}`
    : `${Math.round(topMatch.score * 100)}% match`;
  const extraMatches = (state.matches?.length ?? 0) - 1;

  return (
    <div
      className={cn(
        "mt-1 rounded-md border border-border bg-background overflow-hidden",
        className
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 pt-1.5 pb-1 hover:bg-muted/30 transition-colors"
      >
        <ShieldCheck size={10} className="shrink-0 text-emerald-500" />
        <span className="text-[10px] font-medium truncate flex-1 text-left text-foreground">
          {headerLabel}
        </span>
        {topMatch.type && (
          <span className="text-[10px] capitalize text-muted-foreground shrink-0 mr-1">
            {topMatch.type}
          </span>
        )}
        {expanded ? (
          <ChevronUp size={10} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={10} className="shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Similarity bar */}
      <div className="px-2 pb-1.5">
        <SimilarityBar score={topMatch.score} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border p-2">
          {state.topBundle ? (
            <BundleSummary
              bundle={state.topBundle}
              cid={topMatch.cid}
              onViewDetail={onViewDetail}
              extraMatches={extraMatches > 0 ? extraMatches : undefined}
            />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-[10px] text-muted-foreground truncate flex-1">
                {topMatch.cid.slice(0, 32)}…
              </code>
              {onViewDetail && (
                <button
                  type="button"
                  onClick={() => onViewDetail(topMatch.cid)}
                  className="text-[10px] text-primary hover:underline shrink-0"
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
