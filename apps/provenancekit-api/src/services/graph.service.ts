/**
 * Graph Service
 *
 * Builds provenance graphs for visualization.
 *
 * Uses BFS traversal to build a graph from inputs to outputs,
 * showing how resources were created and transformed.
 *
 * Uses:
 * - @provenancekit/storage: Database queries
 */

import { getContext } from "../context.js";

/*─────────────────────────────────────────────────────────────*\
 | Graph Types                                                  |
\*─────────────────────────────────────────────────────────────*/

export type NodeType = "resource" | "action" | "entity";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "produces" | "consumes" | "tool" | "performedBy";
}

export interface ProvenanceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/*─────────────────────────────────────────────────────────────*\
 | Graph Building                                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Build a provenance graph starting from a resource CID.
 *
 * Uses BFS to traverse the provenance chain:
 * - For each resource, finds actions that produced it
 * - For each action, adds input resources to the queue
 * - Continues until maxDepth or no more inputs
 *
 * @param rootCid - Starting resource CID
 * @param maxDepth - Maximum traversal depth (default: 10)
 */
export async function buildProvenanceGraph(
  rootCid: string,
  maxDepth = 10
): Promise<ProvenanceGraph> {
  const { dbStorage } = getContext();

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const queue: Array<{ cid: string; depth: number }> = [{ cid: rootCid, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { cid, depth } = item;

    if (visited.has(cid) || depth > maxDepth) continue;
    visited.add(cid);

    // Get the resource
    const resource = await dbStorage.getResource(cid);
    if (!resource) continue;

    const resourceRef = resource.address?.ref;
    if (!resourceRef) continue;

    // Add resource node
    const resNodeId = `res:${resourceRef}`;
    if (!nodes.has(resNodeId)) {
      nodes.set(resNodeId, {
        id: resNodeId,
        type: "resource",
        label: resourceRef.slice(0, 8) + "…",
        data: {
          ref: resourceRef,
          type: resource.type ?? "unknown",
          createdAt: resource.createdAt,
          createdBy: resource.createdBy,
        },
      });
    }

    // Get actions that produced this resource
    const actions = await dbStorage.getActionsByOutput(cid);

    for (const action of actions) {
      if (!action.id) continue;

      const actNodeId = `act:${action.id}`;

      // Add action node
      if (!nodes.has(actNodeId)) {
        nodes.set(actNodeId, {
          id: actNodeId,
          type: "action",
          label: action.type ?? "action",
          data: {
            id: action.id,
            type: action.type,
            timestamp: action.timestamp,
            performedBy: action.performedBy,
          },
        });
      }

      // Edge: action → resource (produces)
      edges.push({ from: actNodeId, to: resNodeId, type: "produces" });

      // Add performer entity
      const performerId = action.performedBy;
      if (performerId) {
        const entNodeId = `ent:${performerId}`;

        if (!nodes.has(entNodeId)) {
          const entity = await dbStorage.getEntity(performerId);
          nodes.set(entNodeId, {
            id: entNodeId,
            type: "entity",
            label: entity?.name ?? performerId.slice(0, 6) + "…",
            data: entity ?? { id: performerId },
          });
        }

        // Edge: entity → action (performedBy)
        edges.push({ from: entNodeId, to: actNodeId, type: "performedBy" });
      }

      // Process input resources
      const inputs = action.inputs ?? [];
      for (const input of inputs) {
        const inputRef = input.ref;
        if (!inputRef) continue;

        // Edge: input resource → action (consumes)
        edges.push({ from: `res:${inputRef}`, to: actNodeId, type: "consumes" });

        // Add to queue for traversal
        queue.push({ cid: inputRef, depth: depth + 1 });
      }

      // Process tool reference (from extensions)
      const toolCid = action.extensions?.toolCid as string | undefined;
      if (toolCid) {
        edges.push({ from: `res:${toolCid}`, to: actNodeId, type: "tool" });
        queue.push({ cid: toolCid, depth: depth + 1 });
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}
