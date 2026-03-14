"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { ProvenanceBundleView, ProvenanceGraph } from "@/components/provenance/pk-ui";
import { SessionFlowDiagram } from "@/components/provenance/session-flow-diagram";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GraphNode, GraphEdge } from "@provenancekit/sdk";

interface CidDetailClientProps {
  cid: string;
  sessionId: string | null;
}

type Tab = "overview" | "graph" | "session";

interface SessionData {
  sessionId: string;
  actions: Array<{
    id: string;
    type: string;
    performedBy: string;
    timestamp: string;
    inputs?: Array<{ ref: string }>;
    outputs?: Array<{ ref: string }>;
    extensions?: Record<string, unknown>;
  }>;
  resources: Array<{
    address: { ref: string; size?: number };
    type: string;
    createdBy?: string;
    extensions?: Record<string, unknown>;
  }>;
  entities: Array<{
    id: string;
    role: string;
    name?: string;
    extensions?: Record<string, unknown>;
  }>;
  attributions: Array<Record<string, unknown>>;
}

/** Build GraphNode[] + GraphEdge[] from full session data. */
function buildSessionGraph(session: SessionData): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const entity of session.entities) {
    nodes.push({
      id: `ent:${entity.id}`,
      type: "entity",
      label: entity.name?.split("/").pop() ?? entity.role,
      data: entity,
    });
  }

  for (const action of session.actions) {
    nodes.push({
      id: `act:${action.id}`,
      type: "action",
      label: action.type,
      data: action,
    });
    if (action.performedBy) {
      edges.push({ from: `ent:${action.performedBy}`, to: `act:${action.id}`, type: "performedBy" });
    }
    for (const input of action.inputs ?? []) {
      if (input.ref) edges.push({ from: `res:${input.ref}`, to: `act:${action.id}`, type: "consumes" });
    }
    for (const output of action.outputs ?? []) {
      if (output.ref) edges.push({ from: `act:${action.id}`, to: `res:${output.ref}`, type: "produces" });
    }
  }

  for (const resource of session.resources) {
    const cid = resource.address?.ref;
    if (!cid) continue;
    nodes.push({
      id: `res:${cid}`,
      type: "resource",
      label: cid.length > 12 ? `${cid.slice(0, 8)}…${cid.slice(-4)}` : cid,
      data: resource,
    });
  }

  return { nodes, edges };
}

export function CidDetailClient({ cid, sessionId }: CidDetailClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // Fetch full session data when sessionId is available
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/pk-proxy/session/${encodeURIComponent(sessionId)}/provenance`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSessionData(data); })
      .catch(() => null);
  }, [sessionId, refreshKey]);

  // Auto-retry once after 8 s in case the bundle is still recording
  useEffect(() => {
    const t = setTimeout(() => setRefreshKey((k) => k + 1), 8000);
    return () => clearTimeout(t);
  }, [cid]);

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
          {tab === "overview" && (() => {
            const sessionBundle = sessionData
              ? {
                  resources: sessionData.resources,
                  actions: sessionData.actions,
                  entities: sessionData.entities,
                  attributions: sessionData.attributions,
                }
              : undefined;
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {sessionData
                      ? "Complete provenance history for this session — all entities, actions, resources, and attributions."
                      : "Full provenance bundle for this AI response — entities, actions, resources, and attributions recorded via ProvenanceKit."}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    title="Retry"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ProvenanceBundleView
                  key={refreshKey}
                  cid={cid}
                  bundle={sessionBundle as any}
                  showEntities
                  showActions
                  showResources
                  showAttributions
                  showGraph={false}
                />
              </div>
            );
          })()}

          {tab === "graph" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Full provenance graph — traces every resource, action, and entity involved in
                  creating this output, including inputs from prior sessions.
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  title="Retry"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <ProvenanceGraph
                  key={refreshKey}
                  cid={cid}
                  depth={20}
                  height={600}
                />
              </div>
            </div>
          )}

          {tab === "session" && sessionId && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Interconnected provenance flow for this conversation — each resource is linked
                to the action that produced it, showing how each message led to the next.
                Session:{" "}
                <code className="font-mono text-[10px]">{sessionId}</code>
              </p>
              <SessionFlowDiagram sessionId={sessionId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
