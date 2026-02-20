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
  IVectorStorage,
  IEncryptedVectorStorage,
  EntityFilter,
  ResourceFilter,
  ActionFilter,
  AttributionFilter,
  OwnershipState,
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
  insert(data: unknown | unknown[], options?: Record<string, unknown>): SupabaseQueryBuilder<T>;
  upsert(data: unknown | unknown[], options?: Record<string, unknown>): SupabaseQueryBuilder<T>;
  update(data: unknown): SupabaseQueryBuilder<T>;
  delete(): SupabaseQueryBuilder<T>;
  eq(column: string, value: unknown): SupabaseQueryBuilder<T>;
  gt(column: string, value: unknown): SupabaseQueryBuilder<T>;
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

  /**
   * When true, attempts to create tables via supabase.rpc('pk_exec_sql').
   * Requires a helper function to be set up in the Supabase SQL editor:
   *
   * ```sql
   * CREATE OR REPLACE FUNCTION pk_exec_sql(sql text)
   * RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
   * BEGIN EXECUTE sql; END; $$;
   * ```
   *
   * Default: false
   */
  autoMigrate?: boolean;
}

/*-----------------------------------------------------------------*\
 | Supabase Storage Implementation                                   |
\*-----------------------------------------------------------------*/

/**
 * Supabase storage adapter.
 *
 * Note: The Supabase JS client does not expose PostgreSQL transaction
 * primitives, so `ITransactionalStorage` is not implemented. If you need
 * real transactions, use the PostgreSQL adapter with a direct connection
 * or create a Supabase Edge Function that wraps operations in a
 * BEGIN/COMMIT block.
 */
export class SupabaseStorage
  implements IProvenanceStorage, IVectorStorage, IEncryptedVectorStorage
{
  private client: SupabaseClient;
  private prefix: string;
  private enableVectors: boolean;
  private vectorDimension: number;
  private autoMigrate: boolean;
  private initialized = false;

  // Table names
  private t: {
    entity: string;
    resource: string;
    action: string;
    attribution: string;
    embedding: string;
    encryptedEmbedding: string;
    ownershipState: string;
  };

  constructor(config: SupabaseStorageConfig) {
    this.client = config.client;
    this.prefix = config.tablePrefix ?? "pk_";
    this.enableVectors = config.enableVectors ?? false;
    this.vectorDimension = config.vectorDimension ?? 1536;
    this.autoMigrate = config.autoMigrate ?? false;

    this.t = {
      entity: `${this.prefix}entity`,
      resource: `${this.prefix}resource`,
      action: `${this.prefix}action`,
      attribution: `${this.prefix}attribution`,
      embedding: `${this.prefix}embedding`,
      encryptedEmbedding: `${this.prefix}encrypted_embedding`,
      ownershipState: `${this.prefix}ownership_state`,
    };
  }

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    try {
      if (this.autoMigrate) {
        await this.runAutoMigrate();
      }

      // Verify tables exist by querying entity table
      const result = await this.client
        .from(this.t.entity)
        .select("id")
        .limit(1);

      if (result.error) {
        if (result.error.code === "PGRST116" || result.error.code === "42P01") {
          throw new ConnectionError(
            `ProvenanceKit tables not found (${this.t.entity}). ` +
              `Run SupabaseStorage.generateSchema() to get the migration SQL, ` +
              `then execute it in the Supabase SQL Editor. ` +
              `Or set autoMigrate: true (requires pk_exec_sql function).`,
            result.error
          );
        }
        throw new Error(result.error.message);
      }

      this.initialized = true;
    } catch (error) {
      if (error instanceof ConnectionError) throw error;
      throw new ConnectionError(
        "Failed to initialize Supabase storage",
        error
      );
    }
  }

  private async runAutoMigrate(): Promise<void> {
    const schema = SupabaseStorage.generateSchema({
      tablePrefix: this.prefix,
      enableVectors: this.enableVectors,
      vectorDimension: this.vectorDimension,
    });

    // Split into individual statements and execute via RPC
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 0 &&
          !s.startsWith("--") &&
          !s.startsWith("/*") &&
          !/^\s*$/.test(s)
      );

    for (const stmt of statements) {
      const result = await this.client.rpc("pk_exec_sql", {
        sql: stmt + ";",
      });
      if (result.error) {
        throw new ConnectionError(
          `autoMigrate failed. Ensure the pk_exec_sql function exists in your Supabase database. ` +
            `Error: ${result.error.message}`,
          result.error
        );
      }
    }
  }

  /**
   * Generate the SQL schema for ProvenanceKit tables.
   *
   * Use this to set up your Supabase database:
   * 1. Call `SupabaseStorage.generateSchema()` to get the SQL
   * 2. Paste into the Supabase SQL Editor
   * 3. Run it
   *
   * @param options Configuration (prefix, vectors, dimension)
   * @returns SQL migration script as a string
   */
  static generateSchema(options?: {
    tablePrefix?: string;
    enableVectors?: boolean;
    vectorDimension?: number;
  }): string {
    const prefix = options?.tablePrefix ?? "pk_";
    const vectors = options?.enableVectors ?? false;
    const dim = options?.vectorDimension ?? 1536;

    const t = {
      entity: `${prefix}entity`,
      resource: `${prefix}resource`,
      action: `${prefix}action`,
      attribution: `${prefix}attribution`,
      embedding: `${prefix}embedding`,
      encryptedEmbedding: `${prefix}encrypted_embedding`,
    };

    let sql = `-- ProvenanceKit Schema Migration
-- Generated by @provenancekit/storage SupabaseStorage.generateSchema()
-- Run this in the Supabase SQL Editor

`;

    sql += `CREATE TABLE IF NOT EXISTS ${t.entity} (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT,
  public_key TEXT,
  metadata JSONB DEFAULT '{}',
  extensions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS ${t.resource} (
  ref TEXT PRIMARY KEY,
  scheme TEXT NOT NULL,
  integrity TEXT,
  size INTEGER,
  type TEXT NOT NULL,
  locations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES ${t.entity}(id),
  root_action TEXT NOT NULL,
  extensions JSONB DEFAULT '{}'
);\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS ${t.action} (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  performed_by TEXT NOT NULL REFERENCES ${t.entity}(id),
  timestamp TIMESTAMPTZ NOT NULL,
  inputs JSONB DEFAULT '[]',
  outputs JSONB DEFAULT '[]',
  proof TEXT,
  extensions JSONB DEFAULT '{}'
);\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS ${t.attribution} (
  id TEXT PRIMARY KEY,
  resource_ref TEXT,
  resource_scheme TEXT,
  action_id TEXT,
  entity_id TEXT NOT NULL REFERENCES ${t.entity}(id),
  role TEXT NOT NULL,
  note TEXT,
  extensions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT attr_target_check CHECK (resource_ref IS NOT NULL OR action_id IS NOT NULL)
);\n\n`;

    sql += `CREATE INDEX IF NOT EXISTS idx_${prefix}resource_type ON ${t.resource}(type);
CREATE INDEX IF NOT EXISTS idx_${prefix}resource_created_by ON ${t.resource}(created_by);
CREATE INDEX IF NOT EXISTS idx_${prefix}action_type ON ${t.action}(type);
CREATE INDEX IF NOT EXISTS idx_${prefix}action_performed_by ON ${t.action}(performed_by);
CREATE INDEX IF NOT EXISTS idx_${prefix}attribution_resource ON ${t.attribution}(resource_ref);
CREATE INDEX IF NOT EXISTS idx_${prefix}attribution_action ON ${t.attribution}(action_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}attribution_entity ON ${t.attribution}(entity_id);

CREATE INDEX IF NOT EXISTS idx_${prefix}resource_extensions ON ${t.resource} USING GIN (extensions);
CREATE INDEX IF NOT EXISTS idx_${prefix}action_extensions ON ${t.action} USING GIN (extensions);\n\n`;

    if (vectors) {
      sql += `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ${t.embedding} (
  id SERIAL PRIMARY KEY,
  ref TEXT NOT NULL REFERENCES ${t.resource}(ref),
  embedding vector(${dim}),
  kind TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_${prefix}embedding_ref ON ${t.embedding}(ref);

CREATE OR REPLACE FUNCTION pk_match_embeddings(
  query_embedding vector(${dim}),
  match_threshold float,
  match_count int,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (ref text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT e.ref, 1 - (e.embedding <=> query_embedding) AS similarity
  FROM ${t.embedding} e
  LEFT JOIN ${t.resource} r ON e.ref = r.ref
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (filter_type IS NULL OR r.type = filter_type)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;\n\n`;
    }

    // Encrypted embedding table — stores opaque encrypted vector blobs.
    // The server cannot read or search these; only the key holder can
    // decrypt them client-side for local similarity search.
    if (vectors) {
      sql += `CREATE TABLE IF NOT EXISTS ${t.encryptedEmbedding} (
  ref TEXT PRIMARY KEY REFERENCES ${t.resource}(ref),
  blob TEXT NOT NULL,
  kind TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_${prefix}encrypted_embedding_created
  ON ${t.encryptedEmbedding}(created_at);\n\n`;
    }

    return sql;
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

    // Check for publicKey immutability violation
    const existing = await this.getEntity(entity.id);
    if (existing?.publicKey && entity.publicKey && existing.publicKey !== entity.publicKey) {
      throw new QueryError(
        `Cannot change publicKey for entity "${entity.id}": ` +
        `public keys are immutable after first registration`
      );
    }

    const result = await this.client.from(this.t.entity).upsert({
      id: entity.id,
      role: entity.role,
      name: entity.name ?? null,
      public_key: existing?.publicKey ?? entity.publicKey ?? null,
      metadata: { ...(existing?.metadata ?? {}), ...(entity.metadata ?? {}) },
      extensions: { ...(existing?.extensions ?? {}), ...(entity.extensions ?? {}) },
    });

    this.handleError(result, "upsert entity");
    return entity;
  }

  async updateEntity(
    id: string,
    update: Partial<Pick<Entity, "name" | "metadata" | "extensions">>
  ): Promise<Entity | null> {
    this.ensureInitialized();

    const existing = await this.getEntity(id);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {};
    if (update.name !== undefined) updateData.name = update.name;
    if (update.metadata !== undefined) {
      updateData.metadata = { ...existing.metadata, ...update.metadata };
    }
    if (update.extensions !== undefined) {
      updateData.extensions = { ...existing.extensions, ...update.extensions };
    }

    if (Object.keys(updateData).length === 0) return existing;

    const result = await this.client
      .from(this.t.entity)
      .update(updateData)
      .eq("id", id);

    this.handleError(result, "update entity");
    return this.getEntity(id);
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

  async listEntities(filter?: EntityFilter): Promise<Entity[]> {
    this.ensureInitialized();

    let query = this.client.from<EntityRow>(this.t.entity).select("*");

    if (filter?.role) query = query.eq("role", filter.role);

    if (filter?.offset && filter?.limit) {
      query = query.range(filter.offset, filter.offset + filter.limit - 1);
    } else if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const result = await query;
    this.handleError(result, "list entities");

    const rows = (result.data as EntityRow[] | null) ?? [];
    return rows.map((r) => this.rowToEntity(r));
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
    if (filter?.extensions) query = query.contains("extensions", filter.extensions);

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
    if (filter?.extensions) query = query.contains("extensions", filter.extensions);

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

  async updateAction(
    id: string,
    update: Partial<Pick<Action, "extensions" | "proof">>
  ): Promise<Action | null> {
    this.ensureInitialized();

    const updateData: Record<string, unknown> = {};
    if (update.extensions !== undefined) {
      // Merge with existing extensions
      const existing = await this.getAction(id);
      if (!existing) return null;
      updateData.extensions = { ...existing.extensions, ...update.extensions };
    }
    if (update.proof !== undefined) {
      updateData.proof = update.proof;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getAction(id);
    }

    const result = await this.client
      .from(this.t.action)
      .update(updateData)
      .eq("id", id);

    this.handleError(result, "update action");

    return this.getAction(id);
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
   | Ownership Operations
   --------------------------------------------------------------*/

  async initOwnershipState(resourceRef: string, ownerId: string): Promise<void> {
    this.ensureInitialized();

    // Only insert if no record exists yet (insert-if-not-exists semantics)
    const existing = await this.getOwnershipState(resourceRef);
    if (existing) return;

    const result = await this.client.from(this.t.ownershipState).insert({
      resource_ref: resourceRef,
      current_owner_id: ownerId,
      last_transfer_id: null,
      updated_at: new Date().toISOString(),
    });

    this.handleError(result, "init ownership state");
  }

  async getOwnershipState(resourceRef: string): Promise<OwnershipState | null> {
    this.ensureInitialized();

    const result = await this.client
      .from<OwnershipStateRow>(this.t.ownershipState)
      .select("*")
      .eq("resource_ref", resourceRef)
      .single();

    if (result.error?.code === "PGRST116") return null;
    this.handleError(result, "get ownership state");

    if (!result.data) return null;
    return this.rowToOwnershipState(result.data as OwnershipStateRow);
  }

  async transferOwnershipState(
    resourceRef: string,
    newOwnerId: string,
    transferActionId: string
  ): Promise<void> {
    this.ensureInitialized();

    const result = await this.client
      .from(this.t.ownershipState)
      .update({
        current_owner_id: newOwnerId,
        last_transfer_id: transferActionId,
        updated_at: new Date().toISOString(),
      })
      .eq("resource_ref", resourceRef);

    this.handleError(result, "transfer ownership state");
  }

  async getOwnershipHistory(resourceRef: string): Promise<Action[]> {
    this.ensureInitialized();

    // Fetch actions of ownership types that list this resource as an input.
    // Supabase does not support LIKE on JSONB arrays directly, so we use
    // the `contains` filter on the inputs array with the ref field.
    const claimResult = await this.client
      .from<ActionRow>(this.t.action)
      .select("*")
      .eq("type", "ext:ownership:claim@1.0.0")
      .contains("inputs", [{ ref: resourceRef }])
      .order("timestamp", { ascending: true });

    this.handleError(claimResult, "get ownership history (claims)");

    const transferResult = await this.client
      .from<ActionRow>(this.t.action)
      .select("*")
      .eq("type", "ext:ownership:transfer@1.0.0")
      .contains("inputs", [{ ref: resourceRef }])
      .order("timestamp", { ascending: true });

    this.handleError(transferResult, "get ownership history (transfers)");

    const claimRows = (claimResult.data as ActionRow[] | null) ?? [];
    const transferRows = (transferResult.data as ActionRow[] | null) ?? [];

    return [...claimRows, ...transferRows]
      .map((r) => this.rowToAction(r))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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

  async getEmbedding(ref: string): Promise<number[] | null> {
    if (!this.enableVectors) {
      throw new QueryError("Vector search not enabled");
    }
    this.ensureInitialized();

    const result = await this.client
      .from(this.t.embedding)
      .select("embedding")
      .eq("ref", ref)
      .single();

    if (result.error?.code === "PGRST116") return null;
    this.handleError(result, "get embedding");

    const data = result.data as { embedding: number[] } | null;
    return data?.embedding ?? null;
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
   | Encrypted Vector Storage
   |
   | Stores embedding vectors as opaque encrypted blobs.
   | The server never sees plaintext vectors for encrypted resources —
   | only the key holder can decrypt and search them client-side.
   --------------------------------------------------------------*/

  async storeEncryptedEmbedding(
    ref: string,
    blob: string,
    kind?: string
  ): Promise<void> {
    this.ensureInitialized();

    const result = await this.client
      .from(this.t.encryptedEmbedding)
      .upsert({ ref, blob, kind });

    this.handleError(result, "store encrypted embedding");
  }

  async getEncryptedEmbedding(
    ref: string
  ): Promise<{ blob: string; kind?: string } | null> {
    this.ensureInitialized();

    const result = await this.client
      .from(this.t.encryptedEmbedding)
      .select("blob, kind")
      .eq("ref", ref)
      .single();

    if (result.error?.code === "PGRST116") return null;
    this.handleError(result, "get encrypted embedding");

    const data = result.data as { blob: string; kind?: string } | null;
    return data ?? null;
  }

  async listEncryptedEmbeddings(
    opts?: { since?: string; kind?: string; limit?: number }
  ): Promise<
    Array<{ ref: string; blob: string; kind?: string; createdAt: string }>
  > {
    this.ensureInitialized();

    type Row = { ref: string; blob: string; kind: string | null; created_at: string };

    let query = this.client
      .from<Row>(this.t.encryptedEmbedding)
      .select("ref, blob, kind, created_at");

    if (opts?.since) query = query.gt("created_at", opts.since);
    if (opts?.kind) query = query.eq("kind", opts.kind);

    query = query
      .order("created_at", { ascending: true })
      .limit(opts?.limit ?? 1000);

    const result = await query;
    this.handleError(result, "list encrypted embeddings");

    const rows = (result.data as Row[] | null) ?? [];
    return rows.map((r) => ({
      ref: r.ref,
      blob: r.blob,
      kind: r.kind ?? undefined,
      createdAt: r.created_at,
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

  private rowToOwnershipState(row: OwnershipStateRow): OwnershipState {
    return {
      resourceRef: row.resource_ref,
      currentOwnerId: row.current_owner_id,
      lastTransferId: row.last_transfer_id ?? null,
      updatedAt: row.updated_at,
    };
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

interface OwnershipStateRow {
  resource_ref: string;
  current_owner_id: string;
  last_transfer_id: string | null;
  updated_at: string;
}
