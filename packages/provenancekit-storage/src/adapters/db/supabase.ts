/**
 * Supabase Database Adapter
 *
 * A Supabase implementation of IProvenanceStorage with optional vector search.
 * Builds on PostgreSQL with Supabase's JS client.
 *
 * @example
 * ```typescript
 * import { SupabaseStorage } from "@provenancekit/storage/adapters/db/supabase";
 * import { createClient } from "@supabase/supabase-js";
 *
 * const supabase = createClient(
 *   process.env.SUPABASE_URL!,
 *   process.env.SUPABASE_ANON_KEY!
 * );
 * const storage = new SupabaseStorage({ client: supabase });
 * await storage.initialize();
 * ```
 */

import type {
  Entity,
  Resource,
  Action,
  Attribution,
  ContentReference,
} from "@arttribute/eaa-types";

import type {
  IProvenanceStorage,
  ITransactionalStorage,
  IVectorStorage,
  ResourceFilter,
  ActionFilter,
  AttributionFilter,
} from "../../db/interface";

import {
  AlreadyExistsError,
  DbNotInitializedError,
  QueryError,
  ConnectionError,
} from "../../db/errors";

/*-----------------------------------------------------------------*\
 | Configuration Types                                               |
\*-----------------------------------------------------------------*/

/**
 * Supabase query response
 */
export interface SupabaseResponse<T = unknown> {
  data: T | null;
  error: { message: string; code: string } | null;
  count?: number;
}

/**
 * Supabase query builder interface (matches @supabase/supabase-js)
 */
export interface SupabaseQueryBuilder<T = unknown> {
  select(columns?: string): SupabaseQueryBuilder<T>;
  insert(data: unknown | unknown[]): SupabaseQueryBuilder<T>;
  upsert(data: unknown | unknown[]): SupabaseQueryBuilder<T>;
  update(data: unknown): SupabaseQueryBuilder<T>;
  delete(): SupabaseQueryBuilder<T>;
  eq(column: string, value: unknown): SupabaseQueryBuilder<T>;
  contains(column: string, value: unknown): SupabaseQueryBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): SupabaseQueryBuilder<T>;
  range(from: number, to: number): SupabaseQueryBuilder<T>;
  limit(count: number): SupabaseQueryBuilder<T>;
  single(): Promise<SupabaseResponse<T>>;
  then<R>(
    resolve: (value: SupabaseResponse<T[]>) => R
  ): Promise<R>;
}

/**
 * Supabase client interface (matches @supabase/supabase-js)
 */
export interface SupabaseClient {
  from<T = unknown>(table: string): SupabaseQueryBuilder<T>;
  rpc<T = unknown>(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<SupabaseResponse<T>>;
}

/**
 * Supabase adapter configuration.
 */
export interface SupabaseStorageConfig {
  /** Supabase client instance */
  client: SupabaseClient;

  /** Table name prefix (default: "pk_") */
  tablePrefix?: string;

  /** Enable vector search (requires pgvector extension) */
  enableVectors?: boolean;

  /** Vector embedding dimension (default: 1536 for OpenAI) */
  vectorDimension?: number;
}

/*-----------------------------------------------------------------*\
 | Supabase Storage Implementation                                   |
\*-----------------------------------------------------------------*/

export class SupabaseStorage
  implements IProvenanceStorage, ITransactionalStorage, IVectorStorage
{
  private client: SupabaseClient;
  private prefix: string;
  private enableVectors: boolean;
  private initialized = false;

  // Table names
  private t: {
    entity: string;
    resource: string;
    action: string;
    attribution: string;
    embedding: string;
  };

  constructor(config: SupabaseStorageConfig) {
    this.client = config.client;
    this.prefix = config.tablePrefix ?? "pk_";
    this.enableVectors = config.enableVectors ?? false;

    this.t = {
      entity: `${this.prefix}entity`,
      resource: `${this.prefix}resource`,
      action: `${this.prefix}action`,
      attribution: `${this.prefix}attribution`,
      embedding: `${this.prefix}embedding`,
    };
  }

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    try {
      // Test connection by querying entities
      const result = await this.client
        .from(this.t.entity)
        .select("id")
        .limit(1);
      if (result.error && result.error.code !== "PGRST116") {
        // PGRST116 = table doesn't exist, which is fine
        throw new Error(result.error.message);
      }
      this.initialized = true;
    } catch (error) {
      throw new ConnectionError(
        "Failed to initialize Supabase storage",
        error
      );
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new DbNotInitializedError();
    }
  }

  private handleError(
    result: SupabaseResponse<unknown>,
    operation: string
  ): void {
    if (result.error) {
      if (result.error.code === "23505") {
        // Unique violation
        throw new AlreadyExistsError("Record", operation);
      }
      throw new QueryError(`Failed to ${operation}: ${result.error.message}`);
    }
  }

  /*--------------------------------------------------------------
   | Entity Operations
   --------------------------------------------------------------*/

  async upsertEntity(entity: Entity): Promise<Entity> {
    this.ensureInitialized();

    const result = await this.client.from(this.t.entity).upsert({
      id: entity.id,
      role: entity.role,
      name: entity.name ?? null,
      public_key: entity.publicKey ?? null,
      metadata: entity.metadata ?? {},
      extensions: entity.extensions ?? {},
    });

    this.handleError(result, "upsert entity");
    return entity;
  }

  async getEntity(id: string): Promise<Entity | null> {
    this.ensureInitialized();

    const result = await this.client
      .from<EntityRow>(this.t.entity)
      .select("*")
      .eq("id", id)
      .single();

    if (result.error?.code === "PGRST116") return null;
    this.handleError(result, "get entity");

    return result.data ? this.rowToEntity(result.data) : null;
  }

  async entityExists(id: string): Promise<boolean> {
    this.ensureInitialized();
    const entity = await this.getEntity(id);
    return entity !== null;
  }

  /*--------------------------------------------------------------
   | Resource Operations
   --------------------------------------------------------------*/

  async createResource(resource: Resource): Promise<Resource> {
    this.ensureInitialized();

    if (await this.resourceExists(resource.address.ref)) {
      throw new AlreadyExistsError("Resource", resource.address.ref);
    }

    const result = await this.client.from(this.t.resource).insert({
      ref: resource.address.ref,
      scheme: resource.address.scheme,
      integrity: resource.address.integrity ?? null,
      size: resource.address.size ?? null,
      type: resource.type,
      locations: resource.locations,
      created_at: resource.createdAt,
      created_by: resource.createdBy,
      root_action: resource.rootAction,
      extensions: resource.extensions ?? {},
    });

    this.handleError(result, "create resource");
    return resource;
  }

  async getResource(ref: string): Promise<Resource | null> {
    this.ensureInitialized();

    const result = await this.client
      .from<ResourceRow>(this.t.resource)
      .select("*")
      .eq("ref", ref)
      .single();

    if (result.error?.code === "PGRST116") return null;
    this.handleError(result, "get resource");

    return result.data ? this.rowToResource(result.data) : null;
  }

  async resourceExists(ref: string): Promise<boolean> {
    this.ensureInitialized();
    const resource = await this.getResource(ref);
    return resource !== null;
  }

  async listResources(filter?: ResourceFilter): Promise<Resource[]> {
    this.ensureInitialized();

    let query = this.client.from<ResourceRow>(this.t.resource).select("*");

    if (filter?.type) query = query.eq("type", filter.type);
    if (filter?.createdBy) query = query.eq("created_by", filter.createdBy);

    query = query.order("created_at", { ascending: false });

    if (filter?.offset && filter?.limit) {
      query = query.range(filter.offset, filter.offset + filter.limit - 1);
    } else if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const result = await query;
    this.handleError(result, "list resources");

    const rows = (result.data as ResourceRow[] | null) ?? [];
    return rows.map((r) => this.rowToResource(r));
  }

  /*--------------------------------------------------------------
   | Action Operations
   --------------------------------------------------------------*/

  async createAction(action: Action): Promise<Action> {
    this.ensureInitialized();

    const result = await this.client.from(this.t.action).insert({
      id: action.id,
      type: action.type,
      performed_by: action.performedBy,
      timestamp: action.timestamp,
      inputs: action.inputs,
      outputs: action.outputs,
      proof: action.proof ?? null,
      extensions: action.extensions ?? {},
    });

    this.handleError(result, "create action");
    return action;
  }

  async getAction(id: string): Promise<Action | null> {
    this.ensureInitialized();

    const result = await this.client
      .from<ActionRow>(this.t.action)
      .select("*")
      .eq("id", id)
      .single();

    if (result.error?.code === "PGRST116") return null;
    this.handleError(result, "get action");

    return result.data ? this.rowToAction(result.data) : null;
  }

  async getActionsByOutput(ref: string): Promise<Action[]> {
    this.ensureInitialized();

    const result = await this.client
      .from<ActionRow>(this.t.action)
      .select("*")
      .contains("outputs", [{ ref }]);

    this.handleError(result, "get actions by output");

    const rows = (result.data as ActionRow[] | null) ?? [];
    return rows.map((r) => this.rowToAction(r));
  }

  async getActionsByInput(ref: string): Promise<Action[]> {
    this.ensureInitialized();

    const result = await this.client
      .from<ActionRow>(this.t.action)
      .select("*")
      .contains("inputs", [{ ref }]);

    this.handleError(result, "get actions by input");

    const rows = (result.data as ActionRow[] | null) ?? [];
    return rows.map((r) => this.rowToAction(r));
  }

  async listActions(filter?: ActionFilter): Promise<Action[]> {
    this.ensureInitialized();

    let query = this.client.from<ActionRow>(this.t.action).select("*");

    if (filter?.type) query = query.eq("type", filter.type);
    if (filter?.performedBy)
      query = query.eq("performed_by", filter.performedBy);

    query = query.order("timestamp", { ascending: false });

    if (filter?.offset && filter?.limit) {
      query = query.range(filter.offset, filter.offset + filter.limit - 1);
    } else if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const result = await query;
    this.handleError(result, "list actions");

    const rows = (result.data as ActionRow[] | null) ?? [];
    return rows.map((r) => this.rowToAction(r));
  }

  /*--------------------------------------------------------------
   | Attribution Operations
   --------------------------------------------------------------*/

  async createAttribution(attribution: Attribution): Promise<Attribution> {
    this.ensureInitialized();

    const id =
      attribution.id ??
      `attr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const result = await this.client.from(this.t.attribution).insert({
      id,
      resource_ref: attribution.resourceRef?.ref ?? null,
      resource_scheme: attribution.resourceRef?.scheme ?? null,
      action_id: attribution.actionId ?? null,
      entity_id: attribution.entityId,
      role: attribution.role,
      note: attribution.note ?? null,
      extensions: attribution.extensions ?? {},
    });

    this.handleError(result, "create attribution");
    return { ...attribution, id };
  }

  async getAttributionsByResource(ref: string): Promise<Attribution[]> {
    this.ensureInitialized();

    const result = await this.client
      .from<AttributionRow>(this.t.attribution)
      .select("*")
      .eq("resource_ref", ref);

    this.handleError(result, "get attributions by resource");

    const rows = (result.data as AttributionRow[] | null) ?? [];
    return rows.map((r) => this.rowToAttribution(r));
  }

  async getAttributionsByAction(actionId: string): Promise<Attribution[]> {
    this.ensureInitialized();

    const result = await this.client
      .from<AttributionRow>(this.t.attribution)
      .select("*")
      .eq("action_id", actionId);

    this.handleError(result, "get attributions by action");

    const rows = (result.data as AttributionRow[] | null) ?? [];
    return rows.map((r) => this.rowToAttribution(r));
  }

  async getAttributionsByEntity(
    entityId: string,
    filter?: AttributionFilter
  ): Promise<Attribution[]> {
    this.ensureInitialized();

    let query = this.client
      .from<AttributionRow>(this.t.attribution)
      .select("*")
      .eq("entity_id", entityId);

    if (filter?.role) query = query.eq("role", filter.role);
    if (filter?.limit) query = query.limit(filter.limit);

    const result = await query;
    this.handleError(result, "get attributions by entity");

    const rows = (result.data as AttributionRow[] | null) ?? [];
    return rows.map((r) => this.rowToAttribution(r));
  }

  /*--------------------------------------------------------------
   | Transaction Support
   --------------------------------------------------------------*/

  async transaction<T>(
    fn: (storage: IProvenanceStorage) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();
    // Supabase doesn't expose direct transaction control
    // Run directly (no isolation)
    return fn(this);
  }

  /*--------------------------------------------------------------
   | Vector Search (IVectorStorage)
   --------------------------------------------------------------*/

  async storeEmbedding(ref: string, vector: number[]): Promise<void> {
    if (!this.enableVectors) {
      throw new QueryError("Vector search not enabled");
    }
    this.ensureInitialized();

    const result = await this.client.from(this.t.embedding).upsert({
      ref,
      embedding: vector,
    });

    this.handleError(result, "store embedding");
  }

  async findSimilar(
    vector: number[],
    options?: { limit?: number; minScore?: number; type?: string }
  ): Promise<Array<{ ref: string; score: number }>> {
    if (!this.enableVectors) {
      throw new QueryError("Vector search not enabled");
    }
    this.ensureInitialized();

    // Use Supabase RPC for vector similarity search
    const result = await this.client.rpc<
      Array<{ ref: string; similarity: number }>
    >("pk_match_embeddings", {
      query_embedding: vector,
      match_threshold: options?.minScore ?? 0.5,
      match_count: options?.limit ?? 10,
      filter_type: options?.type ?? null,
    });

    this.handleError(result, "find similar");

    return (result.data ?? []).map((r) => ({
      ref: r.ref,
      score: r.similarity,
    }));
  }

  /*--------------------------------------------------------------
   | Row Conversion Helpers
   --------------------------------------------------------------*/

  private rowToEntity(row: EntityRow): Entity {
    return {
      id: row.id,
      role: row.role,
      name: row.name ?? undefined,
      publicKey: row.public_key ?? undefined,
      metadata: row.metadata ?? undefined,
      extensions: row.extensions ?? undefined,
    };
  }

  private rowToResource(row: ResourceRow): Resource {
    return {
      address: {
        ref: row.ref,
        scheme: row.scheme as ContentReference["scheme"],
        integrity: row.integrity ?? undefined,
        size: row.size ?? undefined,
      },
      type: row.type,
      locations: row.locations ?? [],
      createdAt: row.created_at,
      createdBy: row.created_by,
      rootAction: row.root_action,
      extensions: row.extensions ?? undefined,
    };
  }

  private rowToAction(row: ActionRow): Action {
    return {
      id: row.id,
      type: row.type,
      performedBy: row.performed_by,
      timestamp: row.timestamp,
      inputs: row.inputs ?? [],
      outputs: row.outputs ?? [],
      proof: row.proof ?? undefined,
      extensions: row.extensions ?? undefined,
    };
  }

  private rowToAttribution(row: AttributionRow): Attribution {
    const attr: Attribution = {
      id: row.id,
      entityId: row.entity_id,
      role: row.role as Attribution["role"],
      note: row.note ?? undefined,
      extensions: row.extensions ?? undefined,
    };

    if (row.resource_ref) {
      attr.resourceRef = {
        ref: row.resource_ref,
        scheme: (row.resource_scheme ?? "cid") as ContentReference["scheme"],
      };
    }

    if (row.action_id) {
      attr.actionId = row.action_id;
    }

    return attr;
  }
}

/*-----------------------------------------------------------------*\
 | Row Types (internal)                                              |
\*-----------------------------------------------------------------*/

interface EntityRow {
  id: string;
  role: string;
  name: string | null;
  public_key: string | null;
  metadata: Record<string, unknown> | null;
  extensions: Record<string, unknown> | null;
}

interface ResourceRow {
  ref: string;
  scheme: string;
  integrity: string | null;
  size: number | null;
  type: string;
  locations: Array<{ uri: string; provider?: string }> | null;
  created_at: string;
  created_by: string;
  root_action: string;
  extensions: Record<string, unknown> | null;
}

interface ActionRow {
  id: string;
  type: string;
  performed_by: string;
  timestamp: string;
  inputs: ContentReference[] | null;
  outputs: ContentReference[] | null;
  proof: string | null;
  extensions: Record<string, unknown> | null;
}

interface AttributionRow {
  id: string;
  resource_ref: string | null;
  resource_scheme: string | null;
  action_id: string | null;
  entity_id: string;
  role: string;
  note: string | null;
  extensions: Record<string, unknown> | null;
}
