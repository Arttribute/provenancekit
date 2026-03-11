"use client";

/**
 * Client-side provenance viewer using @provenancekit/ui components.
 *
 * Renders ProvenanceBundleView and ProvenanceGraph for a given CID.
 * Fetches data through /api/pk-proxy via the ProvenanceKitProvider context.
 */

import React, { useState } from "react";
import { ProvenanceBundleView, ProvenanceGraph } from "@provenancekit/ui";
import { cn } from "@/lib/utils";

type Tab = "bundle" | "graph";

interface Props {
  cid: string;
}

export function ProvenanceViewer({ cid }: Props) {
  const [tab, setTab] = useState<Tab>("bundle");

  const tabs: { key: Tab; label: string }[] = [
    { key: "bundle", label: "Bundle" },
    { key: "graph", label: "Interactive Graph" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex gap-1 border-b">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bundle" && (
        <ProvenanceBundleView
          cid={cid}
          showEntities
          showActions
          showResources
          showAttributions
          showGraph={false}
        />
      )}

      {tab === "graph" && (
        <div className="rounded-lg border overflow-hidden">
          <ProvenanceGraph cid={cid} height={540} />
        </div>
      )}
    </div>
  );
}
