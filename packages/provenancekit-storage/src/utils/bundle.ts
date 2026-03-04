/**
 * Provenance Bundle Operations
 *
 * Utilities for working with ProvenanceBundle objects.
 * Enables bulk storage and retrieval of complete provenance records.
 */

import type {
  ProvenanceBundle,
  Entity,
  Resource,
  Action,
  Attribution,
} from "@provenancekit/eaa-types";
import { CONTEXT_URI } from "@provenancekit/eaa-types";

import type { IProvenanceStorage } from "../db/interface";
import { supportsTransactions } from "../db/interface";

/*-----------------------------------------------------------------*\
 | Types                                                             |
\*-----------------------------------------------------------------*/

/**
 * Options for storing bundles
 */
export interface StoreBundleOptions {
  /** Skip entities that already exist (default: false, will upsert) */
  skipExistingEntities?: boolean;
  /** Skip resources that already exist (default: true) */
  skipExistingResources?: boolean;
  /** Use transaction if available (default: true) */
  useTransaction?: boolean;
}

/**
 * Result of a bundle store operation
 */
export interface StoreBundleResult {
  /** Number of entities stored */
  entitiesStored: number;
  /** Number of resources stored */
  resourcesStored: number;
  /** Number of actions stored */
  actionsStored: number;
  /** Number of attributions stored */
  attributionsStored: number;
  /** Resources that were skipped (already exist) */
  skippedResources: string[];
}

/**
 * Options for retrieving bundles
 */
export interface GetBundleOptions {
  /** Include entity details (default: true) */
  includeEntities?: boolean;
  /** Include attributions (default: true) */
  includeAttributions?: boolean;
  /** Maximum lineage depth (default: 10) */
  maxDepth?: number;
}

/*-----------------------------------------------------------------*\
 | Bundle Operations                                                 |
\*-----------------------------------------------------------------*/

/**
 * Store a complete ProvenanceBundle to storage.
 * Stores entities, resources, actions, and attributions.
 *
 * @param storage - The storage backend
 * @param bundle - The ProvenanceBundle to store
 * @param options - Storage options
 * @returns Result with counts of stored items
 *
 * @example
 * ```typescript
 * const result = await storeBundle(storage, bundle);
 * console.log(`Stored ${result.resourcesStored} resources`);
 * ```
 */
export async function storeBundle(
  storage: IProvenanceStorage,
  bundle: ProvenanceBundle,
  options?: StoreBundleOptions
): Promise<StoreBundleResult> {
  const opts = {
    skipExistingEntities: options?.skipExistingEntities ?? false,
    skipExistingResources: options?.skipExistingResources ?? true,
    useTransaction: options?.useTransaction ?? true,
  };

  const storeOperation = async (
    s: IProvenanceStorage
  ): Promise<StoreBundleResult> => {
    const result: StoreBundleResult = {
      entitiesStored: 0,
      resourcesStored: 0,
      actionsStored: 0,
      attributionsStored: 0,
      skippedResources: [],
    };

    // Store entities first (other items depend on them)
    for (const entity of bundle.entities) {
      if (opts.skipExistingEntities && (await s.entityExists(entity.id))) {
        continue;
      }
      await s.upsertEntity(entity);
      result.entitiesStored++;
    }

    // Store actions (resources depend on rootAction)
    for (const action of bundle.actions) {
      try {
        await s.createAction(action);
        result.actionsStored++;
      } catch {
        // Action might already exist, skip
      }
    }

    // Store resources
    for (const resource of bundle.resources) {
      if (
        opts.skipExistingResources &&
        (await s.resourceExists(resource.address.ref))
      ) {
        result.skippedResources.push(resource.address.ref);
        continue;
      }
      try {
        await s.createResource(resource);
        result.resourcesStored++;
      } catch {
        // Resource might already exist
        result.skippedResources.push(resource.address.ref);
      }
    }

    // Store attributions
    for (const attribution of bundle.attributions) {
      try {
        await s.createAttribution(attribution);
        result.attributionsStored++;
      } catch {
        // Attribution might already exist
      }
    }

    return result;
  };

  // Use transaction if available and requested
  if (opts.useTransaction && supportsTransactions(storage)) {
    return storage.transaction(storeOperation);
  }

  return storeOperation(storage);
}

/**
 * Retrieve a ProvenanceBundle for a resource.
 * Builds a bundle containing the resource and its complete lineage.
 *
 * @param storage - The storage backend
 * @param ref - The content reference of the target resource
 * @param options - Retrieval options
 * @returns ProvenanceBundle or null if resource not found
 *
 * @example
 * ```typescript
 * const bundle = await getBundle(storage, "bafy...");
 * if (bundle) {
 *   console.log(`Bundle has ${bundle.resources.length} resources`);
 *   console.log(`Created by ${bundle.entities.length} entities`);
 * }
 * ```
 */
export async function getBundle(
  storage: IProvenanceStorage,
  ref: string,
  options?: GetBundleOptions
): Promise<ProvenanceBundle | null> {
  const opts = {
    includeEntities: options?.includeEntities ?? true,
    includeAttributions: options?.includeAttributions ?? true,
    maxDepth: options?.maxDepth ?? 10,
  };

  const resource = await storage.getResource(ref);
  if (!resource) {
    return null;
  }

  const entities = new Map<string, Entity>();
  const resources = new Map<string, Resource>();
  const actions = new Map<string, Action>();
  const attributions: Attribution[] = [];

  const visited = new Set<string>();

  async function collectLineage(
    currentRef: string,
    depth: number
  ): Promise<void> {
    if (depth > opts.maxDepth || visited.has(currentRef)) {
      return;
    }

    visited.add(currentRef);

    const res = await storage.getResource(currentRef);
    if (!res) return;

    resources.set(res.address.ref, res);

    // Collect entity
    if (opts.includeEntities) {
      const entity = await storage.getEntity(res.createdBy);
      if (entity) {
        entities.set(entity.id, entity);
      }
    }

    // Collect action
    const resActions = await storage.getActionsByOutput(currentRef);
    for (const action of resActions) {
      if (!actions.has(action.id)) {
        actions.set(action.id, action);

        // Collect action performer
        if (opts.includeEntities) {
          const performer = await storage.getEntity(action.performedBy);
          if (performer) {
            entities.set(performer.id, performer);
          }
        }

        // Recurse into inputs
        for (const input of action.inputs) {
          await collectLineage(input.ref, depth + 1);
        }
      }
    }

    // Collect attributions
    if (opts.includeAttributions) {
      const attrs = await storage.getAttributionsByResource(currentRef);
      for (const attr of attrs) {
        attributions.push(attr);

        // Collect attributed entity
        if (opts.includeEntities) {
          const attrEntity = await storage.getEntity(attr.entityId);
          if (attrEntity) {
            entities.set(attrEntity.id, attrEntity);
          }
        }
      }
    }
  }

  await collectLineage(ref, 0);

  return {
    context: CONTEXT_URI,
    entities: Array.from(entities.values()),
    resources: Array.from(resources.values()),
    actions: Array.from(actions.values()),
    attributions,
  };
}

/**
 * Merge multiple bundles into one.
 * Deduplicates entities, resources, and actions by ID/ref.
 *
 * @param bundles - Array of bundles to merge
 * @returns Merged ProvenanceBundle
 */
export function mergeBundles(bundles: ProvenanceBundle[]): ProvenanceBundle {
  const entities = new Map<string, Entity>();
  const resources = new Map<string, Resource>();
  const actions = new Map<string, Action>();
  const attributionSet = new Set<string>();
  const attributions: Attribution[] = [];

  for (const bundle of bundles) {
    for (const entity of bundle.entities) {
      entities.set(entity.id, entity);
    }
    for (const resource of bundle.resources) {
      resources.set(resource.address.ref, resource);
    }
    for (const action of bundle.actions) {
      actions.set(action.id, action);
    }
    for (const attr of bundle.attributions) {
      // Dedupe attributions by a composite key
      const key = `${attr.resourceRef?.ref ?? attr.actionId}:${attr.entityId}:${attr.role}`;
      if (!attributionSet.has(key)) {
        attributionSet.add(key);
        attributions.push(attr);
      }
    }
  }

  return {
    context: CONTEXT_URI,
    entities: Array.from(entities.values()),
    resources: Array.from(resources.values()),
    actions: Array.from(actions.values()),
    attributions,
  };
}
