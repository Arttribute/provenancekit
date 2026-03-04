import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { getOrgBySlug, getProjectBySlug } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GitBranch,
  Info,
  Database,
  Zap,
  User,
  Bot,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { createPK } from "@/lib/pk-api";
import type { ProvenanceGraph, GraphNode, GraphEdge } from "@provenancekit/sdk";

interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
  searchParams: Promise<{ cid?: string; depth?: string }>;
}

export const metadata: Metadata = { title: "Provenance Graph" };

const nodeTypeConfig = {
  resource: {
    icon: Database,
    label: "Resource",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700",
  },
  action: {
    icon: Zap,
    label: "Action",
    dotClass: "bg-purple-500",
    textClass: "text-purple-700",
  },
  entity: {
    icon: User,
    label: "Entity",
    dotClass: "bg-green-500",
    textClass: "text-green-700",
  },
};

const edgeTypeLabel: Record<string, string> = {
  produces: "produces",
  consumes: "consumes",
  tool: "uses tool",
  performedBy: "performed by",
};

function NodeCard({ node }: { node: GraphNode }) {
  const cfg = nodeTypeConfig[node.type] ?? nodeTypeConfig.resource;
  const Icon = cfg.icon;
  const isAI = node.type === "entity" && node.data?.role === "ai";

  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-2 w-2 rounded-full shrink-0 ${cfg.dotClass}`} />
        {isAI ? (
          <Bot className="h-3.5 w-3.5 text-purple-600 shrink-0" />
        ) : (
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold truncate flex-1">{node.label}</span>
        <span className={`text-[10px] font-medium ${cfg.textClass} shrink-0`}>{cfg.label}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5 pl-5">
        {Object.entries(node.data)
          .filter(([, v]) => v != null && typeof v !== "object")
          .slice(0, 4)
          .map(([k, v]) => (
            <div key={k} className="flex gap-1.5 min-w-0">
              <span className="text-muted-foreground/60 shrink-0">{k}:</span>
              <span className="truncate font-mono text-[10px]">{String(v)}</span>
            </div>
          ))}
        {Object.keys(node.data)
          .filter((k) => k.startsWith("ext:"))
          .slice(0, 2)
          .map((k) => (
            <div key={k} className="font-mono text-[10px] text-purple-600/70">
              {k}
            </div>
          ))}
      </div>
    </div>
  );
}

export default async function ProvenancePage({ params, searchParams }: Props) {
  const { orgSlug, projectSlug } = await params;
  const { cid, depth = "5" } = await searchParams;

  const user = await getServerUser();
  if (!user) redirect("/login");

  const orgData = await getOrgBySlug(orgSlug, user.privyDid);
  if (!orgData) notFound();

  const project = await getProjectBySlug(String(orgData.org._id), projectSlug);
  if (!project) notFound();

  let graph: ProvenanceGraph | null = null;
  let fetchError: string | null = null;

  if (cid?.trim()) {
    try {
      const pk = createPK();
      graph = await pk.graph(cid.trim(), parseInt(depth, 10));
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Failed to fetch provenance graph";
    }
  }

  const resourceNodes = graph?.nodes.filter((n) => n.type === "resource") ?? [];
  const actionNodes = graph?.nodes.filter((n) => n.type === "action") ?? [];
  const entityNodes = graph?.nodes.filter((n) => n.type === "entity") ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provenance Graph</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualize attribution chains for any resource CID
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          Enter a resource CID to trace its full provenance graph — entities, actions, inputs,
          outputs, and attribution across the entire lineage.
        </p>
      </div>

      {/* Search form */}
      <form method="GET" className="flex gap-2">
        <Input
          name="cid"
          defaultValue={cid ?? ""}
          placeholder="bafy… or any resource CID"
          className="font-mono flex-1"
          autoComplete="off"
        />
        <input type="hidden" name="depth" value={depth} />
        <Button type="submit">
          <GitBranch className="h-4 w-4 mr-1.5" />
          Explore
        </Button>
      </form>

      {/* Error */}
      {fetchError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive">Failed to load graph</p>
            <p className="text-muted-foreground mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Graph results */}
      {graph && (
        <div className="space-y-6">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Graph for</span>
            <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{cid}</code>
            <Badge variant="outline" className="text-blue-700 border-blue-200">
              {resourceNodes.length} resource{resourceNodes.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-purple-700 border-purple-200">
              {actionNodes.length} action{actionNodes.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-green-700 border-green-200">
              {entityNodes.length} {entityNodes.length !== 1 ? "entities" : "entity"}
            </Badge>
          </div>

          {graph.nodes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12 text-sm text-muted-foreground">
                No provenance data found for this CID.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {/* Resources column */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  <h3 className="text-sm font-semibold">Resources</h3>
                  <span className="text-xs text-muted-foreground">({resourceNodes.length})</span>
                </div>
                {resourceNodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-4">None</p>
                ) : (
                  resourceNodes.map((n) => <NodeCard key={n.id} node={n} />)
                )}
              </div>

              {/* Actions column */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                  <h3 className="text-sm font-semibold">Actions</h3>
                  <span className="text-xs text-muted-foreground">({actionNodes.length})</span>
                </div>
                {actionNodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-4">None</p>
                ) : (
                  actionNodes.map((n) => <NodeCard key={n.id} node={n} />)
                )}
              </div>

              {/* Entities column */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <h3 className="text-sm font-semibold">Entities</h3>
                  <span className="text-xs text-muted-foreground">({entityNodes.length})</span>
                </div>
                {entityNodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-4">None</p>
                ) : (
                  entityNodes.map((n) => <NodeCard key={n.id} node={n} />)
                )}
              </div>
            </div>
          )}

          {/* Edge list */}
          {graph.edges.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Connections{" "}
                  <span className="text-muted-foreground font-normal">
                    ({graph.edges.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {graph.edges.map((edge, i) => {
                    const fromNode = graph!.nodes.find((n) => n.id === edge.from);
                    const toNode = graph!.nodes.find((n) => n.id === edge.to);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs rounded border bg-muted/20 px-3 py-1.5"
                      >
                        <span className="font-mono text-muted-foreground truncate max-w-[140px]">
                          {fromNode?.label ?? edge.from.slice(0, 12) + "…"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                        <span className="italic text-muted-foreground/60 shrink-0">
                          {edgeTypeLabel[edge.type] ?? edge.type}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                        <span className="font-mono text-muted-foreground truncate max-w-[140px]">
                          {toNode?.label ?? edge.to.slice(0, 12) + "…"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!cid && !graph && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 space-y-3">
              <GitBranch className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-medium">Enter a CID above to explore the provenance graph</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The graph walks backwards through the provenance chain, showing every entity,
                action, and resource in the lineage.
              </p>
              <div className="flex justify-center gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                  Resources
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" />
                  Actions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  Entities
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
