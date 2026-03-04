"use client";

import { useState } from "react";
import { Shield, X, ExternalLink } from "lucide-react";

interface ProvenancePanelProps {
  cid: string;
  actionId?: string;
}

export function ProvenancePanel({ cid, actionId }: ProvenancePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-xs text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
      >
        <Shield className="h-3 w-3" />
        Verified
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-background border rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <h2 className="font-semibold text-sm">Provenance Record</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Content CID</p>
                <p className="font-mono text-xs break-all bg-muted rounded px-2 py-1.5">{cid}</p>
              </div>

              {actionId && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Action ID</p>
                  <p className="font-mono text-xs break-all bg-muted rounded px-2 py-1.5">
                    {actionId}
                  </p>
                </div>
              )}

              <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-3 space-y-1">
                <p className="text-xs font-medium text-green-800 dark:text-green-300">
                  This content is provenance-verified
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  The authorship, license, and creation history of this content is recorded on-chain
                  via ProvenanceKit and pinned to IPFS.
                </p>
              </div>

              <a
                href={`https://ipfs.io/ipfs/${cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                View on IPFS <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
