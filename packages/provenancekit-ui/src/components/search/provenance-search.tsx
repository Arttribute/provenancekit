"use client";

import React, { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { FileUploadZone } from "./file-upload-zone";
import { SearchResultCard } from "./search-result-card";
import { useProvenanceKit } from "../../context/provenance-kit-provider";
import type { Match } from "@provenancekit/sdk";

export interface ProvenanceSearchProps {
  mode?: "upload" | "cid" | "both";
  accept?: string;
  maxSize?: number;
  onResult?: (result: { cid: string }) => void;
  className?: string;
}

export function ProvenanceSearch({
  mode = "both",
  accept,
  maxSize,
  onResult,
  className,
}: ProvenanceSearchProps) {
  const { pk } = useProvenanceKit();
  const [results, setResults] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cidInput, setCidInput] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      if (!pk) {
        setError("ProvenanceKitProvider not configured");
        return;
      }
      setLoading(true);
      setError(null);
      setResults([]);
      try {
        const matches = await pk.similar(file as any, 5);
        setResults(matches);
        if (matches[0]) onResult?.({ cid: matches[0].cid });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [pk, onResult]
  );

  const handleCidSearch = useCallback(async () => {
    if (!pk || !cidInput.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const matches = await pk.similar(cidInput.trim(), 5);
      setResults(matches);
      if (matches[0]) onResult?.({ cid: matches[0].cid });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [pk, cidInput, onResult]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* CID input */}
      {(mode === "cid" || mode === "both") && (
        <div className="flex gap-2">
          <input
            type="text"
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCidSearch()}
            placeholder="Enter a CID to find similar content…"
            className={cn(
              "flex-1 rounded-lg border border-[var(--pk-surface-border)] bg-[var(--pk-surface)]",
              "px-3 py-2 text-sm text-[var(--pk-foreground)] placeholder:text-[var(--pk-muted-foreground)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--pk-node-resource)]/30"
            )}
          />
          <button
            type="button"
            onClick={handleCidSearch}
            disabled={loading || !cidInput.trim()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--pk-node-resource)] text-[var(--pk-node-resource-fg)]",
              "hover:opacity-90 transition-opacity",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Search size={14} strokeWidth={2} />
            Search
          </button>
        </div>
      )}

      {/* File upload */}
      {(mode === "upload" || mode === "both") && (
        <FileUploadZone
          onFile={handleFile}
          accept={accept}
          maxSize={maxSize}
          disabled={loading}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--pk-muted-foreground)]">
          <div className="size-4 rounded-full border-2 border-[var(--pk-node-resource)] border-t-transparent animate-spin" />
          Searching for provenance…
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--pk-muted-foreground)]">
            {results.length} match{results.length !== 1 ? "es" : ""} found
          </p>
          {results.map((match) => (
            <SearchResultCard
              key={match.cid}
              match={match}
              onSelect={(cid) => onResult?.({ cid })}
            />
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (mode === "cid" || mode === "both") && cidInput && (
        <p className="text-sm text-[var(--pk-muted-foreground)] text-center py-4">
          No provenance found for this content
        </p>
      )}
    </div>
  );
}
