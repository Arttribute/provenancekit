"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ShieldCheck, FileImage, Bot, Clock, ExternalLink, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

// ── Types matching the ProvenanceKit SDK ─────────────────────────────────────

interface ContentRef {
  ref: string;
  scheme: string;
  size?: number;
}

interface SessionAction {
  id?: string;
  type: string;
  timestamp?: string;
  performedBy?: string;
  inputs?: ContentRef[];
  outputs?: ContentRef[];
  extensions?: Record<string, unknown>;
}

interface SessionResource {
  address?: { ref: string; scheme: string };
  type?: string;
  extensions?: Record<string, unknown>;
}

interface SessionProvenance {
  sessionId: string;
  actions: SessionAction[];
  resources: SessionResource[];
  entities: Array<{ id?: string; role?: string; name?: string }>;
  attributions: unknown[];
  summary: {
    actions: number;
    resources: number;
    entities: number;
    attributions: number;
  };
}

// ── Action timeline item ─────────────────────────────────────────────────────

function ActionItem({
  action,
  resources,
  isLatest,
  onViewProvenance,
}: {
  action: SessionAction;
  resources: SessionResource[];
  isLatest: boolean;
  onViewProvenance: (cid: string) => void;
}) {
  const [open, setOpen] = useState(isLatest);

  // withAITool() stores data as { tool: { provider, model, ... } }
  const aiExtRaw = action.extensions?.["ext:ai@1.0.0"] as
    | { tool?: { provider?: string; model?: string; tokensUsed?: number } }
    | undefined;
  const aiExt = aiExtRaw?.tool;
  const onchainExt = action.extensions?.["ext:onchain@1.0.0"] as
    | { txHash?: string; chainId?: number; chainName?: string; contractAddress?: string }
    | undefined;

  const outputResources = (action.outputs ?? [])
    .map((inp) => resources.find((r) => r.address?.ref === inp.ref))
    .filter(Boolean) as SessionResource[];

  const isAIGenerate = action.type === "generate" || !!aiExt;
  const isImageGenerate =
    isAIGenerate && outputResources.some((r) => r.type === "image");

  function formatTime(ts?: string) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  }

  return (
    <div className="relative pl-5 pb-3 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border" />

      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-0 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full",
          isImageGenerate
            ? "border border-violet-300 bg-violet-50 dark:bg-violet-950 dark:border-violet-700"
            : isAIGenerate
            ? "border border-primary/50 bg-primary/8 dark:bg-primary/15"
            : "border border-border bg-muted"
        )}
      >
        {isImageGenerate ? (
          <FileImage className="h-2 w-2 text-violet-500" />
        ) : isAIGenerate ? (
          <Bot className="h-2 w-2 text-primary" />
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        )}
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted/25 hover:shadow-sm transition-all"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium capitalize truncate">
              {action.type}
            </span>
            {aiExt?.model && (
              <span className="text-[10px] text-muted-foreground truncate">
                · {aiExt.provider}/{aiExt.model}
              </span>
            )}
            {isLatest && (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                latest
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {action.timestamp && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {formatTime(action.timestamp)}
              </span>
            )}
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-1 rounded-b-lg border-x border-b border-border bg-muted/20 px-3 py-2 text-xs space-y-1.5">
          {/* Tokens */}
          {aiExt?.tokensUsed != null && (
            <p className="text-muted-foreground">
              {aiExt.tokensUsed.toLocaleString()} tokens
            </p>
          )}

          {/* Input CIDs */}
          {action.inputs && action.inputs.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Inputs
              </p>
              {action.inputs.slice(0, 3).map((inp) => (
                <div key={inp.ref} className="flex items-center gap-1">
                  <code className="text-[10px] font-mono truncate text-muted-foreground flex-1">
                    {inp.ref.slice(0, 28)}…
                  </code>
                  <button
                    type="button"
                    onClick={() => onViewProvenance(inp.ref)}
                    className="shrink-0 text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Output CIDs */}
          {action.outputs && action.outputs.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Outputs
              </p>
              {action.outputs.slice(0, 3).map((inp) => (
                <div key={inp.ref} className="flex items-center gap-1">
                  <code className="text-[10px] font-mono truncate text-muted-foreground flex-1">
                    {inp.ref.slice(0, 28)}…
                  </code>
                  <button
                    type="button"
                    onClick={() => onViewProvenance(inp.ref)}
                    className="shrink-0 text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* On-chain info */}
          {onchainExt?.txHash && (
            <div className="flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1 dark:bg-emerald-950">
              <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                On-chain · {onchainExt.chainName ?? `Chain ${onchainExt.chainId}`}
              </span>
              <code className="text-[10px] font-mono text-emerald-600 truncate flex-1">
                {onchainExt.txHash.slice(0, 10)}…
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary stats row ────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-card px-3 py-2.5 min-w-0">
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

// ── Provenance Sheet ─────────────────────────────────────────────────────────

interface ProvenanceSheetProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation | undefined;
}

export function ProvenanceSheet({ open, onClose, conversation }: ProvenanceSheetProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionProvenance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionId = conversation?.provenance?.sessionId;

  async function fetchSession() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pk-proxy/session/${sessionId}/provenance`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  // Fetch on open and poll every 5 s while the sheet is visible
  useEffect(() => {
    if (!open || !sessionId) {
      setSession(null);
      return;
    }
    fetchSession();
    pollRef.current = setInterval(fetchSession, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  function handleViewProvenance(cid: string) {
    onClose();
    router.push(`/provenance/${cid}`);
  }

  const actions = session ? [...session.actions].reverse() : [];

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Sheet panel — slides in from the right */}
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-background shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-200"
          )}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              {/* "Pr" squircle — matches the badge */}
              <div
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "28%",
                  background: "oklch(0.12 0 0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 5px rgba(34,197,94,0.4), 0 0 2px rgba(34,197,94,0.25)",
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 800, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.03em" }}>Pr</span>
              </div>
              <Dialog.Title className="text-sm font-semibold">
                Session Provenance
              </Dialog.Title>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchSession}
                disabled={loading || !sessionId}
                title="Refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          {/* Conversation info */}
          {conversation && (
            <div className="border-b px-4 py-2 shrink-0 space-y-0.5">
              <p className="text-xs font-medium truncate">
                {conversation.title ?? "Untitled conversation"}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                {sessionId ?? "No session ID"}
              </p>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* No PK configured */}
            {!sessionId && (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">No provenance session</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a conversation with ProvenanceKit configured to track provenance.
                  </p>
                </div>
              </div>
            )}

            {sessionId && loading && !session && (
              <div className="p-4 space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted" />
                ))}
              </div>
            )}

            {sessionId && error && !session && (
              <div className="p-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {error}
                </div>
              </div>
            )}

            {session && (
              <div className="p-4 space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-4 gap-2">
                  <StatPill label="Actions" value={session.summary.actions} />
                  <StatPill label="Resources" value={session.summary.resources} />
                  <StatPill label="Entities" value={session.summary.entities} />
                  <StatPill label="Attribs" value={session.summary.attributions} />
                </div>

                {/* Action timeline */}
                {actions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      No actions recorded yet. Send a message to start tracking.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {actions.length} action{actions.length > 1 ? "s" : ""} recorded
                    </p>
                    {actions.map((action, i) => (
                      <ActionItem
                        key={action.id ?? i}
                        action={action}
                        resources={session.resources}
                        isLatest={i === 0}
                        onViewProvenance={handleViewProvenance}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer: link to full provenance explorer */}
          {conversation?.provenanceCid && (
            <div className="border-t px-4 py-3 shrink-0">
              <Link
                href={`/provenance/${conversation.provenanceCid}`}
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Provenance Explorer
              </Link>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
