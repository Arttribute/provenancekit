"use client";

/**
 * SessionFlowDiagram
 *
 * Renders the session provenance as an interconnected flow graph:
 *   User prompt ──provide──> [Prompt resource]
 *                                │
 *                 gpt-4o ──generate──> [Text response]
 *                                │
 *          dall-e (tool) ──generate──> [Image]
 *
 * Uses the /api/pk-proxy/session/:id/provenance endpoint.
 */

import { useState, useEffect } from "react";
import { FileText, Image as ImageIcon, ArrowDown, User, Bot, Wrench, ExternalLink, Loader2 } from "lucide-react";

interface CidRef { ref: string; size?: number; scheme?: string }
interface ActionData {
  id: string;
  type: string;
  performedBy: string;
  timestamp: string;
  inputs: CidRef[];
  outputs: CidRef[];
  extensions?: Record<string, unknown>;
}
interface ResourceData {
  address: CidRef;
  type: string;
  extensions?: Record<string, unknown>;
}
interface EntityData {
  id: string;
  role: string;
  name?: string;
  extensions?: Record<string, unknown>;
}
interface SessionData {
  sessionId: string;
  actions: ActionData[];
  resources: ResourceData[];
  entities: EntityData[];
  summary: { actions: number; resources: number; entities: number };
}

interface Turn {
  userAction: ActionData;
  aiActions: ActionData[];
}

/** Group actions into conversation turns by following the CID dependency graph. */
function buildTurns(session: SessionData): Turn[] {
  const sorted = [...session.actions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Map: output CID → actions that consume it as input
  const cidConsumers = new Map<string, ActionData[]>();
  for (const action of sorted) {
    for (const input of action.inputs ?? []) {
      if (!input.ref) continue;
      if (!cidConsumers.has(input.ref)) cidConsumers.set(input.ref, []);
      cidConsumers.get(input.ref)!.push(action);
    }
  }

  const turns: Turn[] = [];
  const assigned = new Set<string>();

  for (const action of sorted) {
    if (action.type !== "provide" || assigned.has(action.id)) continue;

    const turn: Turn = { userAction: action, aiActions: [] };
    assigned.add(action.id);

    // BFS: follow outputs → consumers to find all actions in this turn
    const queue = (action.outputs ?? []).map((o) => o.ref).filter(Boolean);
    while (queue.length > 0) {
      const cid = queue.shift()!;
      for (const consumer of cidConsumers.get(cid) ?? []) {
        if (!assigned.has(consumer.id)) {
          assigned.add(consumer.id);
          turn.aiActions.push(consumer);
          queue.push(...(consumer.outputs ?? []).map((o) => o.ref).filter(Boolean));
        }
      }
    }

    turns.push(turn);
  }

  return turns;
}

function formatBytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function shortCid(cid: string): string {
  return cid.length > 20 ? `${cid.slice(0, 8)}…${cid.slice(-4)}` : cid;
}

/**
 * Returns the aiTool only when it's a *different* model from the entity performing the action.
 * e.g. gpt-4o calling dall-e-3 → returns {provider:"openai",model:"dall-e-3"}
 * e.g. gpt-4o responding with aiTool=gpt-4o (self-metadata) → returns null (not a tool call)
 */
function getAITool(action: ActionData, entity?: EntityData): { provider: string; model: string } | null {
  const ai = action.extensions?.["ext:ai@1.0.0"] as { tool?: { provider: string; model: string } } | undefined;
  if (!ai?.tool) return null;
  // Treat as a tool call only when the aiTool model differs from the entity's own model
  const entityFullName = entity?.name ?? "";
  const toolFullName = `${ai.tool.provider}/${ai.tool.model}`;
  if (entityFullName === toolFullName) return null;
  return ai.tool;
}

function ResourcePill({
  cid,
  resource,
  ipfsGateway,
}: {
  cid: string;
  resource: ResourceData | undefined;
  ipfsGateway: string;
}) {
  const isImage = resource?.type === "image";
  const storage = resource?.extensions?.["ext:storage@1.0.0"] as { contentType?: string } | undefined;
  const size = resource?.address?.size;
  const href = `${ipfsGateway}/${cid}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-card hover:bg-accent text-xs font-mono transition-colors group"
      title={cid}
    >
      {isImage ? (
        <ImageIcon className="h-3 w-3 text-amber-500 shrink-0" />
      ) : (
        <FileText className="h-3 w-3 text-blue-500 shrink-0" />
      )}
      <span className="text-muted-foreground">{shortCid(cid)}</span>
      {size && <span className="text-muted-foreground/60">· {formatBytes(size)}</span>}
      {storage?.contentType && (
        <span className="text-muted-foreground/50 hidden sm:inline">· {storage.contentType.split("/")[1]}</span>
      )}
      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
    </a>
  );
}

function ActionRow({
  action,
  entityMap,
  resourceMap,
  ipfsGateway,
  isLast,
}: {
  action: ActionData;
  entityMap: Map<string, EntityData>;
  resourceMap: Map<string, ResourceData>;
  ipfsGateway: string;
  isLast: boolean;
}) {
  const entity = entityMap.get(action.performedBy);
  const tool = getAITool(action, entity);
  const isHuman = entity?.role === "human" || action.type === "provide";
  const outputs = action.outputs ?? [];

  // Entity display name: prefer tool model name over entity name
  const entityName = tool
    ? `${tool.provider}/${tool.model}`
    : entity?.name
    ? entity.name.includes("/") || entity.name.startsWith("did:")
      ? entity.name.split("/").pop() ?? entity.name
      : entity.name
    : entity?.role ?? "unknown";

  return (
    <div className="relative">
      {/* Connector line from above */}
      {!isHuman && (
        <div className="flex items-center gap-2 mb-1.5 pl-1">
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-border" />
            <ArrowDown className="h-3 w-3 text-muted-foreground/50 -mt-0.5" />
          </div>
        </div>
      )}

      {/* Action card */}
      <div
        className={`rounded-lg border px-3 py-2.5 ${
          isHuman
            ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20"
            : tool
            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
            : "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20"
        }`}
      >
        {/* Header: entity + action type */}
        <div className="flex items-center gap-2 mb-2">
          {isHuman ? (
            <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          ) : tool ? (
            <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-green-500 shrink-0" />
          )}
          <span className="text-xs font-medium">{entityName}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{action.type}</span>
          {tool && !isHuman && (
            <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
              tool
            </span>
          )}
        </div>

        {/* Output resources */}
        {outputs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {outputs.map((out) => (
              <ResourcePill
                key={out.ref}
                cid={out.ref}
                resource={resourceMap.get(out.ref)}
                ipfsGateway={ipfsGateway}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom connector */}
      {!isLast && (
        <div className="flex items-center gap-2 mt-1.5 pl-1">
          <div className="w-px h-2 bg-border ml-[3px]" />
        </div>
      )}
    </div>
  );
}

function TurnCard({
  turn,
  turnIndex,
  entityMap,
  resourceMap,
  ipfsGateway,
}: {
  turn: Turn;
  turnIndex: number;
  entityMap: Map<string, EntityData>;
  resourceMap: Map<string, ResourceData>;
  ipfsGateway: string;
}) {
  const allActions = [turn.userAction, ...turn.aiActions];

  return (
    <div className="rounded-xl border bg-card/30 p-3 space-y-0">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
        Turn {turnIndex + 1}
      </p>
      {allActions.map((action, i) => (
        <ActionRow
          key={action.id}
          action={action}
          entityMap={entityMap}
          resourceMap={resourceMap}
          ipfsGateway={ipfsGateway}
          isLast={i === allActions.length - 1}
        />
      ))}
    </div>
  );
}

export function SessionFlowDiagram({
  sessionId,
  apiProxyBase = "/api/pk-proxy",
}: {
  sessionId: string;
  apiProxyBase?: string;
}) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ipfsGateway = (
    process.env.NEXT_PUBLIC_PK_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs"
  ).replace(/\/$/, "");

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    fetch(`${apiProxyBase}/session/${encodeURIComponent(sessionId)}/provenance`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId, apiProxyBase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading provenance flow…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!session || session.actions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        No provenance records in this session yet.
      </div>
    );
  }

  const entityMap = new Map(session.entities.map((e) => [e.id, e]));
  const resourceMap = new Map(session.resources.map((r) => [r.address.ref, r]));
  const turns = buildTurns(session);

  // Deduplicated entities for the legend
  const uniqueEntities = session.entities.filter(
    (e, i, arr) => arr.findIndex((x) => x.name === e.name && x.role === e.role) === i
  );

  return (
    <div className="space-y-4">
      {/* Entity legend */}
      <div className="rounded-lg border bg-card px-3 py-2 flex flex-wrap gap-3 text-xs">
        <span className="text-muted-foreground font-medium">Participants:</span>
        {uniqueEntities.map((e) => (
          <span key={e.id} className="flex items-center gap-1">
            {e.role === "human" ? (
              <User className="h-3 w-3 text-blue-500" />
            ) : (
              <Bot className="h-3 w-3 text-green-500" />
            )}
            <span className="text-foreground">
              {e.name?.includes("/") ? e.name.split("/").pop() : e.name ?? e.role}
            </span>
            <span className="text-muted-foreground">({e.role})</span>
          </span>
        ))}
        <span className="ml-auto text-muted-foreground">
          {session.summary.actions} actions · {session.summary.resources} resources
        </span>
      </div>

      {/* Flow turns */}
      <div className="space-y-3">
        {turns.map((turn, i) => (
          <TurnCard
            key={turn.userAction.id}
            turn={turn}
            turnIndex={i}
            entityMap={entityMap}
            resourceMap={resourceMap}
            ipfsGateway={ipfsGateway}
          />
        ))}
      </div>
    </div>
  );
}
