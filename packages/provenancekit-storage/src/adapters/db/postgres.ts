/**
 * PostgreSQL Database Adapter
 *
 * A PostgreSQL implementation of IProvenanceStorage.
 * Uses raw SQL for flexibility - works with any PostgreSQL client.
 *
 * This adapter is database-agnostic in terms of client library.
 * You provide a query function, it handles the rest.
 *
 * @example
 * ```typescript
 * import { PostgresStorage } from "@provenancekit/storage/adapters/db/postgres";
 * import postgres from "postgres";
 *
 * const sql = postgres(process.env.DATABASE_URL);
 * const storage = new PostgresStorage({
 *   query: async (text, params) => {
 *     const result = await sql.unsafe(text, params);
 *     return result;
 *   },
 * });
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
 * Query function signature.
 * Implementations should return rows as an array of objects.
 */
export type QueryFn = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
) => Promise<T[]>;

/**
 * Transaction function signature.
 * Wraps operations in a database transaction.
 */
export type TransactionFn = <T>(
  fn: (query: QueryFn) => Promise<T>
) => Promise<T>;

/**
 * PostgreSQL adapter configuration.
 */
export interface PostgresStorageConfig {
  /** Query function for executing SQL */
  query: QueryFn;

  /** Optional transaction wrapper */
  transaction?: TransactionFn;

  /** Table name prefix (default: "pk_") */
  tablePrefix?: string;

  /** Whether to auto-create tables on initialize (default: true) */
  autoMigrate?: boolean;
}

/*-----------------------------------------------------------------*\
 | PostgreSQL Storage Implementation                                 |
\*-----------------------------------------------------------------*/

export class PostgresStorage
  implements IProvenanceStorage, ITransactionalStorage
{
  private query: QueryFn;
  private txFn?: TransactionFn;
  private prefix: string;
  private autoMigrate: boolean;
  private initialized = false;

  // Table names
  private t: {
    entity: string;
    resource: string;
    action: string;
    attribution: string;
  };

  constructor(config: PostgresStorageConfig) {
    this.query = config.query;
    this.txFn = config.transaction;
    this.prefix = config.tablePrefix ?? "pk_";
    this.autoMigrate = config.autoMigrate ?? true;

    this.t = {
      entity: `${this.prefix}entity`,
      resource: `${this.prefix}resource`,
      action: `${this.prefix}action`,
      attribution: `${this.prefix}attribution`,
    };
  }

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    try {
      if (this.autoMigrate) {
        await this.createTables();
      }
      this.initialized = true;
    } catch (error) {
      throw new ConnectionError("Failed to initialize PostgreSQL storage", error);
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

  private async createTables(): Promise<void> {
    // Entity table
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.t.entity} (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        name TEXT,
        public_key TEXT,
        metadata JSONB DEFAULT '{}',
        extensions JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Resource table
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.t.resource} (
        ref TEXT PRIMARY KEY,
        scheme TEXT NOT NULL,
        integrity TEXT,
        size INTEGER,
        type TEXT NOT NULL,
        locations JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL,
        created_by TEXT NOT NULL REFERENCES ${this.t.entity}(id),
        root_action TEXT NOT NULL,
        extensions JSONB DEFAULT '{}'
      )
    `);

    // Action table
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.t.action} (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        performed_by TEXT NOT NULL REFERENCES ${this.t.entity}(id),
        timestamp TIMESTAMPTZ NOT NULL,
        inputs JSONB DEFAULT '[]',
        outputs JSONB DEFAULT '[]',
        proof TEXT,
        extensions JSONB DEFAULT '{}'
      )
    `);

    // Attribution table
    await this.query(`
      CREATE TABLE IF NOT EXISTS ${this.t.attribution} (
        id TEXT PRIMARY KEY,
        resource_ref TEXT,
        resource_scheme TEXT,
        action_id TEXT,
        entity_id TEXT NOT NULL REFERENCES ${this.t.entity}(id),
        role TEXT NOT NULL,
        note TEXT,
        extensions JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT attr_target_check CHECK (resource_ref IS NOT NULL OR action_id IS NOT NULL)
      )
    `);

    // Indexes for common queries
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}resource_type ON ${this.t.resource}(type)
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}resource_created_by ON ${this.t.resource}(created_by)
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}action_type ON ${this.t.action}(type)
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}action_performed_by ON ${this.t.action}(performed_by)
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}attribution_resource ON ${this.t.attribution}(resource_ref)
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}attribution_action ON ${this.t.attribution}(action_id)
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.prefix}attribution_entity ON ${this.t.attribution}(entity_id)
    `);
  }

  /*--------------------------------------------------------------
   | Entity Operations
   --------------------------------------------------------------*/

  async upsertEntity(entity: Entity): Promise<Entity> {
    this.ensureInitialized();

    try {
      await this.query(
        `
        INSERT INTO ${this.t.entity} (id, role, name, public_key, metadata, extensions)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          name = EXCLUDED.name,
          public_key = EXCLUDED.public_key,
          metadata = EXCLUDED.metadata,
          extensions = EXCLUDED.extensions
        `,
        [
          entity.id,
          entity.role,
          entity.name ?? null,
          entity.publicKey ?? null,
          JSON.stringify(entity.metadata ?? {}),
          JSON.stringify(entity.extensions ?? {}),
        ]
      );
      return entity;
    } catch (error) {
      throw new QueryError("Failed to upsert entity", error);
    }
  }

  async getEntity(id: string): Promise<Entity | null> {
    this.ensureInitialized();

    const rows = await this.query<EntityRow>(
      `SELECT * FROM ${this.t.entity} WHERE id = $1`,
      [id]
    );

    return rows.length > 0 ? this.rowToEntity(rows[0]) : null;
  }

  async entityExists(id: string): Promise<boolean> {
    this.ensureInitialized();

    const rows = await this.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.t.entity} WHERE id = $1) as exists`,
      [id]
    );

    return rows[0]?.exists ?? false;
  }

  /*--------------------------------------------------------------
   | Resource Operations
   --------------------------------------------------------------*/

  async createResource(resource: Resource): Promise<Resource> {
    this.ensureInitialized();

    const ref = resource.address.ref;

    // Check for duplicate
    if (await this.resourceExists(ref)) {
      throw new AlreadyExistsError("Resource", ref);
    }

    try {
      await this.query(
        `
        INSERT INTO ${this.t.resource}
        (ref, scheme, integrity, size, type, locations, created_at, created_by, root_action, extensions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          ref,
          resource.address.scheme,
          resource.address.integrity ?? null,
          resource.address.size ?? null,
          resource.type,
          JSON.stringify(resource.locations),
          resource.createdAt,
          resource.createdBy,
          resource.rootAction,
          JSON.stringify(resource.extensions ?? {}),
        ]
      );
      return resource;
    } catch (error) {
      throw new QueryError("Failed to create resource", error);
    }
  }

  async getResource(ref: string): Promise<Resource | null> {
    this.ensureInitialized();

    const rows = await this.query<ResourceRow>(
      `SELECT * FROM ${this.t.resource} WHERE ref = $1`,
      [ref]
    );

    return rows.length > 0 ? this.rowToResource(rows[0]) : null;
  }

  async resourceExists(ref: string): Promise<boolean> {
    this.ensureInitialized();

    const rows = await this.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.t.resource} WHERE ref = $1) as exists`,
      [ref]
    );

    return rows[0]?.exists ?? false;
  }

  async listResources(filter?: ResourceFilter): Promise<Resource[]> {
    this.ensureInitialized();

    let sql = `SELECT * FROM ${this.t.resource} WHERE 1=1`;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter?.type) {
      sql += ` AND type = $${paramIdx++}`;
      params.push(filter.type);
    }
    if (filter?.createdBy) {
      sql += ` AND created_by = $${paramIdx++}`;
      params.push(filter.createdBy);
    }

    sql += ` ORDER BY created_at DESC`;

    if (filter?.limit) {
      sql += ` LIMIT $${paramIdx++}`;
      params.push(filter.limit);
    }
    if (filter?.offset) {
      sql += ` OFFSET $${paramIdx++}`;
      params.push(filter.offset);
    }

    const rows = await this.query<ResourceRow>(sql, params);
    return rows.map((r) => this.rowToResource(r));
  }

  /*--------------------------------------------------------------
   | Action Operations
   --------------------------------------------------------------*/

  async createAction(action: Action): Promise<Action> {
    this.ensureInitialized();

    try {
      await this.query(
        `
        INSERT INTO ${this.t.action}
        (id, type, performed_by, timestamp, inputs, outputs, proof, extensions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          action.id,
          action.type,
          action.performedBy,
          action.timestamp,
          JSON.stringify(action.inputs),
          JSON.stringify(action.outputs),
          action.proof ?? null,
          JSON.stringify(action.extensions ?? {}),
        ]
      );
      return action;
    } catch (error) {
      throw new QueryError("Failed to create action", error);
    }
  }

  async getAction(id: string): Promise<Action | null> {
    this.ensureInitialized();

    const rows = await this.query<ActionRow>(
      `SELECT * FROM ${this.t.action} WHERE id = $1`,
      [id]
    );

    return rows.length > 0 ? this.rowToAction(rows[0]) : null;
  }

  async getActionsByOutput(ref: string): Promise<Action[]> {
    this.ensureInitialized();

    // Query actions where outputs JSONB array contains an object with matching ref
    const rows = await this.query<ActionRow>(
      `
      SELECT * FROM ${this.t.action}
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(outputs) AS o
        WHERE o->>'ref' = $1
      )
      `,
      [ref]
    );

    return rows.map((r) => this.rowToAction(r));
  }

  async getActionsByInput(ref: string): Promise<Action[]> {
    this.ensureInitialized();

    const rows = await this.query<ActionRow>(
      `
      SELECT * FROM ${this.t.action}
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(inputs) AS i
        WHERE i->>'ref' = $1
      )
      `,
      [ref]
    );

    return rows.map((r) => this.rowToAction(r));
  }

  async listActions(filter?: ActionFilter): Promise<Action[]> {
    this.ensureInitialized();

    let sql = `SELECT * FROM ${this.t.action} WHERE 1=1`;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter?.type) {
      sql += ` AND type = $${paramIdx++}`;
      params.push(filter.type);
    }
    if (filter?.performedBy) {
      sql += ` AND performed_by = $${paramIdx++}`;
      params.push(filter.performedBy);
    }

    sql += ` ORDER BY timestamp DESC`;

    if (filter?.limit) {
      sql += ` LIMIT $${paramIdx++}`;
      params.push(filter.limit);
    }
    if (filter?.offset) {
      sql += ` OFFSET $${paramIdx++}`;
      params.push(filter.offset);
    }

    const rows = await this.query<ActionRow>(sql, params);
    return rows.map((r) => this.rowToAction(r));
  }

  /*--------------------------------------------------------------
   | Attribution Operations
   --------------------------------------------------------------*/

  async createAttribution(attribution: Attribution): Promise<Attribution> {
    this.ensureInitialized();

    // Generate ID if not provided
    const id = attribution.id ?? `attr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await this.query(
        `
        INSERT INTO ${this.t.attribution}
        (id, resource_ref, resource_scheme, action_id, entity_id, role, note, extensions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          id,
          attribution.resourceRef?.ref ?? null,
          attribution.resourceRef?.scheme ?? null,
          attribution.actionId ?? null,
          attribution.entityId,
          attribution.role,
          attribution.note ?? null,
          JSON.stringify(attribution.extensions ?? {}),
        ]
      );
      return { ...attribution, id };
    } catch (error) {
      throw new QueryError("Failed to create attribution", error);
    }
  }

  async getAttributionsByResource(ref: string): Promise<Attribution[]> {
    this.ensureInitialized();

    const rows = await this.query<AttributionRow>(
      `SELECT * FROM ${this.t.attribution} WHERE resource_ref = $1`,
      [ref]
    );

    return rows.map((r) => this.rowToAttribution(r));
  }

  async getAttributionsByAction(actionId: string): Promise<Attribution[]> {
    this.ensureInitialized();

    const rows = await this.query<AttributionRow>(
      `SELECT * FROM ${this.t.attribution} WHERE action_id = $1`,
      [actionId]
    );

    return rows.map((r) => this.rowToAttribution(r));
  }

  async getAttributionsByEntity(
    entityId: string,
    filter?: AttributionFilter
  ): Promise<Attribution[]> {
    this.ensureInitialized();

    let sql = `SELECT * FROM ${this.t.attribution} WHERE entity_id = $1`;
    const params: unknown[] = [entityId];
    let paramIdx = 2;

    if (filter?.role) {
      sql += ` AND role = $${paramIdx++}`;
      params.push(filter.role);
    }

    if (filter?.limit) {
      sql += ` LIMIT $${paramIdx++}`;
      params.push(filter.limit);
    }

    const rows = await this.query<AttributionRow>(sql, params);
    return rows.map((r) => this.rowToAttribution(r));
  }

  /*--------------------------------------------------------------
   | Transaction Support
   --------------------------------------------------------------*/

  async transaction<T>(
    fn: (storage: IProvenanceStorage) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();

    if (!this.txFn) {
      // No transaction support - just run directly
      return fn(this);
    }

    return this.txFn(async (txQuery) => {
      // Create a new storage instance with the transaction query
      const txStorage = new PostgresStorage({
        query: txQuery,
        tablePrefix: this.prefix,
        autoMigrate: false,
      });
      txStorage.initialized = true;
      return fn(txStorage);
    });
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
