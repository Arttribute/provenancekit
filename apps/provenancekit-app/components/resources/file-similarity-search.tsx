"use client";

/**
 * File similarity search panel for the Resources page.
 *
 * Drag-and-drop (or click-to-select) a file to find similar resources already
 * recorded in this project via ProvenanceKit vector embeddings.
 *
 * Uses the ProvenanceKitProvider context (pk-proxy route → PK API).
 */

import React, { useState, useCallback, useRef, DragEvent } from "react";
import { Upload, FileSearch, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useProvenanceKit } from "@provenancekit/ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { UploadMatchResult } from "@provenancekit/sdk";

interface Props {
  /** Called when the user selects a match to inspect in the CID lookup section */
  onSelectCid?: (cid: string) => void;
}

function formatScore(score: number) {
  return `${(score * 100).toFixed(1)}%`;
}

function verdictLabel(verdict: string) {
  if (verdict === "auto") return "High match";
  if (verdict === "review") return "Possible match";
  return "Low similarity";
}

function verdictClass(verdict: string) {
  if (verdict === "auto") return "text-emerald-700 border-emerald-200 bg-emerald-50";
  if (verdict === "review") return "text-amber-700 border-amber-200 bg-amber-50";
  return "text-slate-600 border-slate-200 bg-slate-50";
}

export function FileSimilaritySearch({ onSelectCid }: Props) {
  const { pk } = useProvenanceKit();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadMatchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (f: File) => {
      if (!pk) {
        setError("ProvenanceKit API not configured.");
        return;
      }
      setFile(f);
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await pk.uploadAndMatch(f, { topK: 5 });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [pk]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) runSearch(dropped);
    },
    [runSearch]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) runSearch(selected);
      e.target.value = "";
    },
    [runSearch]
  );

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer select-none",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
          loading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={handleFileInput}
          accept="image/*,audio/*,video/*,text/*,.pdf,.json,.md"
        />
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Searching for similar resources…</p>
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </>
        ) : (
          <>
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop a file to find similar provenance records</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports images, audio, video, text, PDF — click to browse
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-destructive">Search failed</p>
            <p className="text-muted-foreground mt-0.5">{error}</p>
          </div>
          <button onClick={reset} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {result.matches.length > 0
                  ? `${result.matches.length} similar resource${result.matches.length !== 1 ? "s" : ""} found`
                  : "No similar resources found"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {result.verdict !== "no-match" && (
                <Badge variant="outline" className={cn("text-xs", verdictClass(result.verdict))}>
                  {verdictLabel(result.verdict)}
                </Badge>
              )}
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear
              </button>
            </div>
          </div>

          {result.matches.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 px-4 py-8 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No duplicate or near-duplicate content found</p>
              <p className="text-xs text-muted-foreground mt-1">
                This content appears to be unique in your project.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {result.matches.map((match, i) => (
                <div
                  key={match.cid}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate text-foreground">{match.cid}</p>
                    {match.type && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{match.type}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs font-semibold tabular-nums">
                        {formatScore(match.score)}
                      </span>
                      <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${match.score * 100}%` }}
                        />
                      </div>
                    </div>
                    {onSelectCid && (
                      <button
                        onClick={() => onSelectCid(match.cid)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
