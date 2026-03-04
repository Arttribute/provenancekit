"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, X, ExternalLink, GitBranch, Users, FileText, Zap } from "lucide-react";
import { ProvenanceBundleView } from "@provenancekit/ui";
import { formatCid } from "@provenancekit/ui";
import type { ProvenanceBundle } from "@provenancekit/sdk";
import type { DistributionEntry } from "@/lib/provenance";

interface ProvenancePanelProps {
  cid: string;
  actionId?: string;
  postId: string;
}

type Tab = "bundle" | "distribution";

export function ProvenancePanel({ cid, actionId, postId }: ProvenancePanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("bundle");

  const { data: bundle, isLoading: bundleLoading } = useQuery<ProvenanceBundle>({
    queryKey: ["pk-bundle", cid],
    queryFn: () => fetch(`/api/pk/bundle/${cid}`).then((r) => r.json()),
    enabled: open && !!cid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: distribution, isLoading: distLoading } = useQuery<{
    entries: DistributionEntry[];
  }>({
    queryKey: ["pk-distribution", cid],
    queryFn: () => fetch(`/api/pk/distribution/${cid}`).then((r) => r.json()),
    enabled: open && tab === "distribution" && !!cid,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border bg-green-50 dark:bg-green-900/20 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
      >
        <Shield className="h-3 w-3" />
        Provenance
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-xl bg-background border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Provenance Record</h2>
                  <p className="text-xs text-muted-foreground">
                    Recorded via ProvenanceKit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* CID display */}
            <div className="px-5 py-3 border-b bg-muted/30 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Content CID</p>
                  <p className="font-mono text-xs text-foreground">{formatCid(cid, 20)}</p>
                </div>
                <a
                  href={`https://ipfs.io/ipfs/${cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  IPFS <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {actionId && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Action ID</p>
                  <p className="font-mono text-xs text-muted-foreground">{actionId.slice(0, 32)}…</p>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b shrink-0">
              {([ 
                { id: "bundle" as const,       label: "Bundle", icon: FileText },
                { id: "distribution" as const, label: "Distribution", icon: Users },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={
                    "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors " +
                    (tab === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {tab === "bundle" && (
                <>
                  {bundleLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : bundle ? (
                    <ProvenanceBundleView
                      bundle={bundle}
                      showGraph={false}
                      showEntities
                      showActions
                      showResources
                      showAttributions
                    />
                  ) : (
                    <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                          Content is provenance-tracked
                        </p>
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-400">
                        Authorship, license, and creation history are recorded on-chain
                        via ProvenanceKit and pinned to IPFS.
                      </p>
                    </div>
                  )}
                </>
              )}

              {tab === "distribution" && (
                <>
                  {distLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : distribution?.entries?.length ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Revenue distribution based on the provenance graph.
                        Basis points are used to deploy a 0xSplits contract on Base.
                      </p>
                      {distribution.entries.map((entry) => (
                        <div
                          key={entry.entityId}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-xs">
                                {entry.entityId.slice(0, 16)}…
                              </span>
                            </div>
                            {entry.wallet && (
                              <p className="font-mono text-xs text-muted-foreground">
                                {entry.wallet.slice(0, 6)}…{entry.wallet.slice(-4)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{entry.percentage}%</p>
                            <p className="text-xs text-muted-foreground">{entry.bps} bps</p>
                          </div>
                        </div>
                      ))}

                      <div className="rounded-lg bg-muted/50 border p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <GitBranch className="h-3.5 w-3.5" />
                          Distribution follows the provenance chain — all contributors earn.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Zap className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Distribution data not available
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The provenance graph may still be building.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
