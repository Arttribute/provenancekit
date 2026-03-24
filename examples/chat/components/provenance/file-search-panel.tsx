"use client";

/**
 * FileSearchPanel
 *
 * A modern file-upload-driven provenance search panel.
 * - Drag-drop or click to upload a file
 * - Searches for similar content via ProvenanceKit
 * - Results shown as clean cards with similarity score badges
 * - Clicking a result opens a full dialog with:
 *   - Image preview (for image files)
 *   - Provenance Graph tab
 *   - Overview (bundle) tab
 * - Matches below HIGH_CONFIDENCE threshold show a "Claim Attribution" prompt
 */

import { useState, useCallback, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ProvenanceBundleView, ProvenanceGraph, useProvenanceKit } from "@/components/provenance/pk-ui";
import { cn } from "@/lib/utils";
import type { Match } from "@provenancekit/sdk";

// ── Thresholds ─────────────────────────────────────────────────────────────────
/** ≥95% → show full provenance dialog. <95% → show claim/explore prompt. */
const HIGH_CONFIDENCE = 0.95;

// ── Upload Zone ────────────────────────────────────────────────────────────────

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  activeFile?: File | null;
  previewUrl?: string | null;
  onReset?: () => void;
  loading?: boolean;
}

function UploadZone({ onFile, disabled, activeFile, previewUrl, onReset, loading }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (activeFile) {
    const isImage = activeFile.type.startsWith("image/");
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="h-10 w-10 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
          ) : isImage ? (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{activeFile.name}</p>
          <p className="text-xs text-muted-foreground">{(activeFile.size / 1024).toFixed(1)} KB</p>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1 rounded-md hover:bg-muted"
            aria-label="Clear file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 p-8",
        "rounded-xl border-2 border-dashed transition-all cursor-pointer select-none",
        dragOver
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-border/70 hover:bg-muted/20",
        disabled && "opacity-50 pointer-events-none"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload file for provenance search"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,audio/*,text/*"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        disabled={disabled}
      />
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"
      >
        <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Drop a file or click to search</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Find provenance records by file content
        </p>
      </div>
    </div>
  );
}

// ── Result Card ────────────────────────────────────────────────────────────────

function MatchResultCard({ match, onClick }: { match: Match; onClick: () => void }) {
  const pct = Math.round(match.score * 100);
  const isHigh = pct >= 95;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/20 hover:shadow-sm transition-all"
    >
      {/* CID */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-foreground truncate">
          {match.cid.slice(0, 18)}…{match.cid.slice(-6)}
        </p>
        {match.type && (
          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{match.type}</p>
        )}
      </div>

      {/* Score badge */}
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
          isHigh
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800"
        )}
      >
        {pct}%
      </span>

      {/* Icon */}
      {isHigh ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      )}
    </button>
  );
}

// ── Provenance File Dialog ─────────────────────────────────────────────────────

type DialogTab = "preview" | "graph" | "overview";

function ProvenanceFileDialog({
  open,
  onClose,
  match,
  file,
  previewUrl,
}: {
  open: boolean;
  onClose: () => void;
  match: Match | null;
  file: File | null;
  previewUrl: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DialogTab>("overview");
  const [claimExpanded, setClaimExpanded] = useState(false);

  // Reset state when dialog closes or match changes
  useEffect(() => {
    if (!open) {
      setClaimExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (match && file) {
      const isImage = file.type.startsWith("image/");
      setTab(isImage ? "preview" : "overview");
    }
  }, [match, file]);

  if (!match || !file) return null;

  const pct = Math.round(match.score * 100);
  const isHigh = pct >= HIGH_CONFIDENCE * 100;
  const isImage = file.type.startsWith("image/");

  const tabs: { key: DialogTab; label: string }[] = [
    ...(isImage ? [{ key: "preview" as const, label: "Preview" }] : []),
    { key: "overview" as const, label: "Overview" },
    { key: "graph" as const, label: "Graph" },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-2xl max-h-[88vh] flex flex-col",
            "rounded-2xl border bg-background shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-150"
          )}
          aria-describedby={undefined}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 border-b px-5 py-4 shrink-0">
            {/* File thumbnail / icon */}
            <div className="h-9 w-9 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {isImage && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
              ) : isImage ? (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-sm font-semibold truncate">{file.name}</Dialog.Title>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                    isHigh
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                  )}
                >
                  {pct}% match
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {isHigh ? "Verified provenance record" : "Partial match · may be your content"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => { router.push(`/provenance/${match.cid}`); onClose(); }}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/8"
              >
                Full explorer
                <ExternalLink className="h-3 w-3" />
              </button>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors ml-0.5">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* ── Low-confidence prompt ──────────────────────────────────────── */}
          {!isHigh && (
            <div className="border-b px-5 py-3 bg-amber-50/60 dark:bg-amber-950/20 shrink-0">
              {!claimExpanded ? (
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="flex-1 text-xs text-amber-800 dark:text-amber-300">
                    <span className="font-semibold">{pct}% similarity.</span>{" "}
                    This might match your content. Is this your work?
                  </p>
                  <button
                    type="button"
                    onClick={() => setClaimExpanded(true)}
                    className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 bg-white dark:bg-transparent px-2.5 py-1 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    Claim attribution
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                      Record attribution with ProvenanceKit
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
                      To formally claim this content as your work, use the ProvenanceKit SDK to
                      record a provenance bundle for your original file. This links your identity
                      as creator on-chain.
                    </p>
                    <a
                      href="https://provenancekit.org/guides/recording-provenance"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1.5 inline-flex items-center gap-1"
                    >
                      View recording guide
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClaimExpanded(false)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab bar ────────────────────────────────────────────────────── */}
          <div className="flex border-b px-5 shrink-0">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab content ────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {tab === "preview" && isImage && previewUrl && (
              <div className="flex items-center justify-center p-6 min-h-[240px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="max-h-[400px] max-w-full rounded-xl border object-contain shadow-sm"
                />
              </div>
            )}
            {tab === "overview" && (
              <div className="p-5">
                <ProvenanceBundleView
                  cid={match.cid}
                  showEntities
                  showActions
                  showResources
                  showAttributions
                  showGraph={false}
                />
              </div>
            )}
            {tab === "graph" && (
              <div className="p-5">
                <div className="rounded-xl border overflow-hidden">
                  <ProvenanceGraph cid={match.cid} depth={10} height={380} />
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── File Search Panel ──────────────────────────────────────────────────────────

export function FileSearchPanel() {
  const { pk } = useProvenanceKit();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Match[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dialogMatch, setDialogMatch] = useState<Match | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!pk) { setError("ProvenanceKit not configured"); return; }

      // Create object URL for image preview
      const isImage = file.type.startsWith("image/");
      const url = isImage ? URL.createObjectURL(file) : null;

      // Revoke old preview URL to avoid memory leak
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      setActiveFile(file);
      setLoading(true);
      setError(null);
      setResults([]);

      try {
        const matches = await (pk as any).similar(file, 5);
        setResults(matches ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [pk]
  );

  const handleReset = useCallback(() => {
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setActiveFile(null);
    setResults([]);
    setError(null);
  }, []);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, []);

  return (
    <div className="space-y-3">
      <UploadZone
        onFile={handleFile}
        disabled={loading}
        activeFile={activeFile}
        previewUrl={previewUrl}
        onReset={handleReset}
        loading={loading}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {results.length} match{results.length !== 1 ? "es" : ""} found
          </p>
          {results.map((match) => (
            <MatchResultCard
              key={match.cid}
              match={match}
              onClick={() => { setDialogMatch(match); setDialogOpen(true); }}
            />
          ))}
        </div>
      )}

      {!loading && !error && activeFile && results.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No provenance records found for this file</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            This content hasn&apos;t been recorded with ProvenanceKit yet.
          </p>
        </div>
      )}

      <ProvenanceFileDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        match={dialogMatch}
        file={activeFile}
        previewUrl={previewUrl}
      />
    </div>
  );
}
