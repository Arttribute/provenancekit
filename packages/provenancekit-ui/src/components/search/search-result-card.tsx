"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { CidDisplay } from "../primitives/cid-display";
import { ProvenanceBundleView } from "../bundle/provenance-bundle-view";
import type { Match } from "@provenancekit/sdk";
import type { ProvenanceBundle } from "@provenancekit/sdk";

interface SearchResultCardProps {
  match: Match;
  bundle?: ProvenanceBundle;
  onSelect?: (cid: string) => void;
  className?: string;
}

function ScoreBar({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  const color =
    percent >= 90
      ? "bg-[var(--pk-verified)]"
      : percent >= 70
      ? "bg-[var(--pk-partial)]"
      : "bg-[var(--pk-unverified)]";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--pk-surface-muted)] overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--pk-muted-foreground)] w-10 text-right shrink-0">
        {percent}%
      </span>
    </div>
  );
}

export function SearchResultCard({
  match,
  bundle,
  onSelect,
  className,
}: SearchResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)] overflow-hidden",
        className
      )}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--pk-surface-muted)] transition-colors"
        onClick={() => {
          setExpanded((v) => !v);
          onSelect?.(match.cid);
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CidDisplay cid={match.cid} showCopy={false} />
            {match.type && (
              <span className="text-xs text-[var(--pk-muted-foreground)] capitalize bg-[var(--pk-surface-muted)] px-1.5 py-0.5 rounded">
                {match.type}
              </span>
            )}
          </div>
          <ScoreBar score={match.score} />
        </div>
        <button
          type="button"
          className="shrink-0 text-[var(--pk-muted-foreground)]"
          aria-label={expanded ? "Collapse" : "View provenance"}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--pk-surface-border)] p-3">
          <ProvenanceBundleView
            cid={bundle ? undefined : match.cid}
            bundle={bundle}
            showGraph={false}
          />
        </div>
      )}
    </div>
  );
}
