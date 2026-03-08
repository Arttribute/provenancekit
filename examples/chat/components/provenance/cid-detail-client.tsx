"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ProvenanceBundleView, ProvenanceGraph, ProvenanceTracker } from "@/components/provenance/pk-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CidDetailClientProps {
  cid: string;
  sessionId: string | null;
}

type Tab = "overview" | "graph" | "session";

export function CidDetailClient({ cid, sessionId }: CidDetailClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "overview", label: "Overview" },
    { key: "graph", label: "Graph" },
    { key: "session", label: "Session timeline", disabled: !sessionId },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Provenance Record</h1>
            <p className="text-xs text-muted-foreground font-mono truncate">{cid}</p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b">
          {TABS.map(({ key, label, disabled }) => (
            <button
              key={key}
              onClick={() => !disabled && setTab(key)}
              disabled={disabled}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {tab === "overview" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Full provenance bundle for this AI response — entities, actions, resources, and
                attributions recorded via ProvenanceKit.
              </p>
              <ProvenanceBundleView
                cid={cid}
                showEntities
                showActions
                showResources
                showAttributions
                showGraph={false}
              />
            </div>
          )}

          {tab === "graph" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Interactive provenance graph. Click nodes to explore entities, actions, and
                resources.
              </p>
              <div className="rounded-lg border overflow-hidden">
                <ProvenanceGraph
                  cid={cid}
                  height={500}
                />
              </div>
            </div>
          )}

          {tab === "session" && sessionId && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                All provenance records in this conversation session, in chronological order.
                Session ID:{" "}
                <code className="font-mono">{sessionId}</code>
              </p>
              <ProvenanceTracker
                sessionId={sessionId}
                pollInterval={0}
                showEntities
                showResources
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
