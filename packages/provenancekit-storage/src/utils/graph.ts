/**
 * Provenance Graph Traversal Utilities
 *
 * Helper functions for traversing the provenance graph.
 * These are storage-agnostic and work with any IProvenanceStorage implementation.
 */

import type {
  Resource,
  Action,
  Attribution,
  ContentReference,
} from "@arttribute/eaa-types";

import type { IProvenanceStorage } from "../db/interface";

/*-----------------------------------------------------------------*\
 | Types                                                             |
\*-----------------------------------------------------------------*/

/**
 * A node in the provenance chain
 */
export interface ProvenanceNode {
  /** The resource at this node */
  resource: Resource;
  /** The action that created this resource (if known) */
  action?: Action;
  /** Attributions for this resource */
  attributions: Attribution[];
  /** Input resources (parents in the lineage) */
  inputs: ContentReference[];
}

/**
 * Complete lineage information for a resource
 */
export interface Lineage {
  /** The target resource */
  target: Resource;
  /** Chain of provenance nodes from root to target */
  chain: ProvenanceNode[];
  /** All unique entities involved */
  entityIds: string[];
  /** Total depth of the lineage */
  depth: number;
}

/**
 * Options for lineage traversal
 */
export interface LineageOptions {
  /** Maximum depth to traverse (default: 10) */
  maxDepth?: number;
  /** Whether to include attributions (default: true) */
  includeAttributions?: boolean;
}

/*-----------------------------------------------------------------*\
 | Graph Traversal Functions                                         |
\*-----------------------------------------------------------------*/

/**
 * Get the complete provenance chain for a resource.
 * Traverses backwards through inputs to find all ancestors.
 *
 * @param storage - The storage backend
 * @param ref - The content reference of the target resource
 * @param options - Traversal options
 * @returns Array of provenance nodes from oldest ancestor to target
 *
 * @example
 * ```typescript
 * const chain = await getProvenanceChain(storage, "bafy...");
 * for (const node of chain) {
 *   console.log(`${node.resource.type}: ${node.resource.address.ref}`);
 *   console.log(`  Created by action: ${node.action?.id}`);
 *   console.log(`  Inputs: ${node.inputs.length}`);
 * }
 * ```
 */
export async function getProvenanceChain(
  storage: IProvenanceStorage,
  ref: string,
  options?: LineageOptions
): Promise<ProvenanceNode[]> {
  const maxDepth = options?.maxDepth ?? 10;
  const includeAttributions = options?.includeAttributions ?? true;

  const visited = new Set<string>();
  const chain: ProvenanceNode[] = [];

  async function traverse(currentRef: string, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(currentRef)) {
      return;
    }

    visited.add(currentRef);

    const resource = await storage.getResource(currentRef);
    if (!resource) {
      return;
    }

    // Find the action that created this resource
    const actions = await storage.getActionsByOutput(currentRef);
    const action = actions[0]; // Typically one action creates a resource

    // Get attributions if requested
    const attributions = includeAttributions
      ? await storage.getAttributionsByResource(currentRef)
      : [];

    // Get inputs from the action
    const inputs = action?.inputs ?? [];

    // Recursively traverse inputs (depth-first)
    for (const input of inputs) {
      await traverse(input.ref, depth + 1);
    }

    // Add this node to the chain (after inputs, so chain is ordered oldest-first)
    chain.push({
      resource,
      action,
      attributions,
      inputs,
    });
  }

  await traverse(ref, 0);
  return chain;
}

/**
 * Get the complete lineage for a resource.
 * Provides a structured view of the provenance graph.
 *
 * @param storage - The storage backend
 * @param ref - The content reference of the target resource
 * @param options - Traversal options
 * @returns Lineage object with chain, entities, and metadata
 *
 * @example
 * ```typescript
 * const lineage = await getLineage(storage, "bafy...");
 * console.log(`Depth: ${lineage.depth}`);
 * console.log(`Entities involved: ${lineage.entityIds.join(", ")}`);
 * ```
 */
export async function getLineage(
  storage: IProvenanceStorage,
  ref: string,
  options?: LineageOptions
): Promise<Lineage | null> {
  const resource = await storage.getResource(ref);
  if (!resource) {
    return null;
  }

  const chain = await getProvenanceChain(storage, ref, options);

  // Collect all unique entity IDs
  const entityIds = new Set<string>();
  for (const node of chain) {
    entityIds.add(node.resource.createdBy);
    if (node.action) {
      entityIds.add(node.action.performedBy);
    }
    for (const attr of node.attributions) {
      entityIds.add(attr.entityId);
    }
  }

  return {
    target: resource,
    chain,
    entityIds: Array.from(entityIds),
    depth: chain.length,
  };
}

/**
 * Get all resources derived from a given resource.
 * Traverses forward through outputs to find all descendants.
 *
 * @param storage - The storage backend
 * @param ref - The content reference of the source resource
 * @param maxDepth - Maximum depth to traverse (default: 10)
 * @returns Array of derived resource refs
 *
 * @example
 * ```typescript
 * const derived = await getDerivedResources(storage, "bafy...");
 * console.log(`${derived.length} resources derived from this`);
 * ```
 */
export async function getDerivedResources(
  storage: IProvenanceStorage,
  ref: string,
  maxDepth = 10
): Promise<string[]> {
  const visited = new Set<string>();
  const derived: string[] = [];

  async function traverse(currentRef: string, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(currentRef)) {
      return;
    }

    visited.add(currentRef);

    // Find actions that used this resource as input
    const actions = await storage.getActionsByInput(currentRef);

    for (const action of actions) {
      for (const output of action.outputs) {
        if (!visited.has(output.ref)) {
          derived.push(output.ref);
          await traverse(output.ref, depth + 1);
        }
      }
    }
  }

  await traverse(ref, 0);
  return derived;
}

/**
 * Get all attributions in the lineage of a resource.
 * Aggregates attributions from the resource and all its ancestors.
 *
 * @param storage - The storage backend
 * @param ref - The content reference of the target resource
 * @param maxDepth - Maximum depth to traverse (default: 10)
 * @returns Array of all attributions in the lineage
 */
export async function getLineageAttributions(
  storage: IProvenanceStorage,
  ref: string,
  maxDepth = 10
): Promise<Attribution[]> {
  const chain = await getProvenanceChain(storage, ref, {
    maxDepth,
    includeAttributions: true,
  });

  return chain.flatMap((node) => node.attributions);
}
