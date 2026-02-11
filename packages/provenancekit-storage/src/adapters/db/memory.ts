/**
 * In-Memory Database Adapter
 *
 * A simple in-memory implementation of IProvenanceStorage.
 * Useful for testing, development, and lightweight use cases.
 *
 * Note: Data is lost when the process exits.
 *
 * @example
 * ```typescript
 * import { MemoryDbStorage } from "@provenancekit/storage/adapters/db/memory";
 *
 * const storage = new MemoryDbStorage();
 * await storage.initialize();
 * ```
 */

import type {
  Entity,
  Resource,
  Action,
  Attribution,
} from "@arttribute/eaa-types";

import type {
  IProvenanceStorage,
  ITransactionalStorage,
  ResourceFilter,
  ActionFilter,
  AttributionFilter,
} from "../../db/interface";

import { AlreadyExistsError, DbNotInitializedError } from "../../db/errors";

export class MemoryDbStorage implements IProvenanceStorage, ITransactionalStorage {
  private entities = new Map<string, Entity>();
  private resources = new Map<string, Resource>();
  private actions = new Map<string, Action>();
  private attributions: Attribution[] = [];
  private initialized = false;

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.entities.clear();
    this.resources.clear();
    this.actions.clear();
    this.attributions = [];
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new DbNotInitializedError();
    }
  }

  /*--------------------------------------------------------------
   | Entity Operations
   --------------------------------------------------------------*/

  async upsertEntity(entity: Entity): Promise<Entity> {
    this.ensureInitialized();
    this.entities.set(entity.id, { ...entity });
    return entity;
  }

  async getEntity(id: string): Promise<Entity | null> {
    this.ensureInitialized();
    const entity = this.entities.get(id);
    return entity ? { ...entity } : null;
  }

  async entityExists(id: string): Promise<boolean> {
    this.ensureInitialized();
    return this.entities.has(id);
  }

  /*--------------------------------------------------------------
   | Resource Operations
   --------------------------------------------------------------*/

  async createResource(resource: Resource): Promise<Resource> {
    this.ensureInitialized();
    const ref = resource.address.ref;

    if (this.resources.has(ref)) {
      throw new AlreadyExistsError("Resource", ref);
    }

    this.resources.set(ref, { ...resource });
    return resource;
  }

  async getResource(ref: string): Promise<Resource | null> {
    this.ensureInitialized();
    const resource = this.resources.get(ref);
    return resource ? { ...resource } : null;
  }

  async resourceExists(ref: string): Promise<boolean> {
    this.ensureInitialized();
    return this.resources.has(ref);
  }

  async listResources(filter?: ResourceFilter): Promise<Resource[]> {
    this.ensureInitialized();
    let results = Array.from(this.resources.values());

    if (filter?.type) {
      results = results.filter((r) => r.type === filter.type);
    }
    if (filter?.createdBy) {
      results = results.filter((r) => r.createdBy === filter.createdBy);
    }
    if (filter?.extensions) {
      results = results.filter((r) => matchExtensions(r.extensions, filter.extensions!));
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? results.length;

    return results.slice(offset, offset + limit).map((r) => ({ ...r }));
  }

  /*--------------------------------------------------------------
   | Action Operations
   --------------------------------------------------------------*/

  async createAction(action: Action): Promise<Action> {
    this.ensureInitialized();

    if (this.actions.has(action.id)) {
      throw new AlreadyExistsError("Action", action.id);
    }

    this.actions.set(action.id, { ...action });
    return action;
  }

  async getAction(id: string): Promise<Action | null> {
    this.ensureInitialized();
    const action = this.actions.get(id);
    return action ? { ...action } : null;
  }

  async getActionsByOutput(ref: string): Promise<Action[]> {
    this.ensureInitialized();
    return Array.from(this.actions.values())
      .filter((a) => a.outputs.some((o) => o.ref === ref))
      .map((a) => ({ ...a }));
  }

  async getActionsByInput(ref: string): Promise<Action[]> {
    this.ensureInitialized();
    return Array.from(this.actions.values())
      .filter((a) => a.inputs.some((i) => i.ref === ref))
      .map((a) => ({ ...a }));
  }

  async listActions(filter?: ActionFilter): Promise<Action[]> {
    this.ensureInitialized();
    let results = Array.from(this.actions.values());

    if (filter?.type) {
      results = results.filter((a) => a.type === filter.type);
    }
    if (filter?.performedBy) {
      results = results.filter((a) => a.performedBy === filter.performedBy);
    }
    if (filter?.extensions) {
      results = results.filter((a) => matchExtensions(a.extensions, filter.extensions!));
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? results.length;

    return results.slice(offset, offset + limit).map((a) => ({ ...a }));
  }

  /*--------------------------------------------------------------
   | Attribution Operations
   --------------------------------------------------------------*/

  async createAttribution(attribution: Attribution): Promise<Attribution> {
    this.ensureInitialized();
    this.attributions.push({ ...attribution });
    return attribution;
  }

  async getAttributionsByResource(ref: string): Promise<Attribution[]> {
    this.ensureInitialized();
    return this.attributions
      .filter((a) => a.resourceRef?.ref === ref)
      .map((a) => ({ ...a }));
  }

  async getAttributionsByAction(actionId: string): Promise<Attribution[]> {
    this.ensureInitialized();
    return this.attributions
      .filter((a) => a.actionId === actionId)
      .map((a) => ({ ...a }));
  }

  async getAttributionsByEntity(
    entityId: string,
    filter?: AttributionFilter
  ): Promise<Attribution[]> {
    this.ensureInitialized();
    let results = this.attributions.filter((a) => a.entityId === entityId);

    if (filter?.role) {
      results = results.filter((a) => a.role === filter.role);
    }

    const limit = filter?.limit ?? results.length;
    return results.slice(0, limit).map((a) => ({ ...a }));
  }

  /*--------------------------------------------------------------
   | Transaction Support
   --------------------------------------------------------------*/

  async transaction<T>(
    fn: (storage: IProvenanceStorage) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();

    // Snapshot current state
    const entitiesSnapshot = new Map(this.entities);
    const resourcesSnapshot = new Map(this.resources);
    const actionsSnapshot = new Map(this.actions);
    const attributionsSnapshot = [...this.attributions];

    try {
      return await fn(this);
    } catch (error) {
      // Rollback on error
      this.entities = entitiesSnapshot;
      this.resources = resourcesSnapshot;
      this.actions = actionsSnapshot;
      this.attributions = attributionsSnapshot;
      throw error;
    }
  }

  /*--------------------------------------------------------------
   | Utility Methods (not part of interface)
   --------------------------------------------------------------*/

  /**
   * Clear all data (useful for testing).
   */
  clear(): void {
    this.entities.clear();
    this.resources.clear();
    this.actions.clear();
    this.attributions = [];
  }

  /**
   * Get counts for debugging.
   */
  stats(): {
    entities: number;
    resources: number;
    actions: number;
    attributions: number;
  } {
    return {
      entities: this.entities.size,
      resources: this.resources.size,
      actions: this.actions.size,
      attributions: this.attributions.length,
    };
  }
}

/**
 * Check if an object's extensions contain all expected key-value pairs.
 * Supports nested objects for namespaced extensions like:
 *   { "ext:session@1.0.0": { sessionId: "abc" } }
 */
function matchExtensions(
  extensions: Record<string, unknown> | undefined,
  expected: Record<string, unknown>
): boolean {
  if (!extensions) return false;
  return Object.entries(expected).every(([k, v]) => {
    const actual = extensions[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      // Deep contains check for nested objects
      if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
      return matchExtensions(
        actual as Record<string, unknown>,
        v as Record<string, unknown>
      );
    }
    return actual === v;
  });
}
