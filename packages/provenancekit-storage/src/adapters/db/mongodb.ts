/**
 * MongoDB Database Adapter
 *
 * A MongoDB implementation of IProvenanceStorage.
 * Uses abstract interfaces to work with any MongoDB-compatible client.
 *
 * @example
 * ```typescript
 * import { MongoDBStorage } from "@provenancekit/storage/adapters/db/mongodb";
 * import { MongoClient } from "mongodb";
 *
 * const client = new MongoClient(process.env.MONGODB_URI!);
 * const storage = new MongoDBStorage({
 *   db: client.db("provenance"),
 * });
 * await storage.initialize();
 * ```
 */

import type {
  Entity,
  Resource,
  Action,
  Attribution,
} from "@provenancekit/eaa-types";

import type {
  IProvenanceStorage,
  ITransactionalStorage,
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
 * MongoDB cursor interface (matches mongodb.FindCursor)
 */
export interface MongoCursor<T> {
  skip(n: number): MongoCursor<T>;
  limit(n: number): MongoCursor<T>;
  sort(sort: Record<string, 1 | -1>): MongoCursor<T>;
  toArray(): Promise<T[]>;
}

/**
 * MongoDB collection interface (matches mongodb.Collection)
 */
export interface MongoCollection<T = unknown> {
  insertOne(doc: T): Promise<{ insertedId: unknown }>;
  findOne(filter: Record<string, unknown>): Promise<T | null>;
  find(filter: Record<string, unknown>): MongoCursor<T>;
  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { upsert?: boolean }
  ): Promise<unknown>;
  countDocuments(filter: Record<string, unknown>): Promise<number>;
  createIndex(
    keys: Record<string, 1 | -1>,
    options?: { unique?: boolean }
  ): Promise<string>;
}

/**
 * MongoDB database interface (matches mongodb.Db)
 */
export interface MongoDb {
  collection<T = unknown>(name: string): MongoCollection<T>;
  command(command: Record<string, unknown>): Promise<unknown>;
}

/**
 * MongoDB adapter configuration.
 */
export interface MongoDBStorageConfig {
  /** MongoDB database instance */
  db: MongoDb;

  /** Collection name prefix (default: "pk_") */
  collectionPrefix?: string;

  /** Whether to auto-create indexes on initialize (default: true) */
  autoIndex?: boolean;
}

/*-----------------------------------------------------------------*\
 | MongoDB Storage Implementation                                    |
\*-----------------------------------------------------------------*/

export class MongoDBStorage
  implements IProvenanceStorage, ITransactionalStorage
{
  private db: MongoDb;
  private prefix: string;
  private autoIndex: boolean;
  private initialized = false;

  // Collection names
  private c: {
    entity: string;
    resource: string;
    action: string;
    attribution: string;
    ownershipState: string;
  };

  constructor(config: MongoDBStorageConfig) {
    this.db = config.db;
    this.prefix = config.collectionPrefix ?? "pk_";
    this.autoIndex = config.autoIndex ?? true;

    this.c = {
      entity: `${this.prefix}entities`,
      resource: `${this.prefix}resources`,
      action: `${this.prefix}actions`,
      attribution: `${this.prefix}attributions`,
      ownershipState: `${this.prefix}ownership_state`,
    };
  }

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    try {
      if (this.autoIndex) {
        await this.createIndexes();
      }
      this.initialized = true;
    } catch (error) {
      throw new ConnectionError("Failed to initialize MongoDB storage", error);
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

  private async createIndexes(): Promise<void> {
    // Entity indexes
    await this.db
      .collection(this.c.entity)
      .createIndex({ id: 1 }, { unique: true });

    // Resource indexes
    await this.db
      .collection(this.c.resource)
      .createIndex({ "address.ref": 1 }, { unique: true });
    await this.db.collection(this.c.resource).createIndex({ type: 1 });
    await this.db.collection(this.c.resource).createIndex({ createdBy: 1 });

    // Action indexes
    await this.db
      .collection(this.c.action)
      .createIndex({ id: 1 }, { unique: true });
    await this.db.collection(this.c.action).createIndex({ type: 1 });
    await this.db.collection(this.c.action).createIndex({ performedBy: 1 });
    await this.db.collection(this.c.action).createIndex({ "inputs.ref": 1 });
    await this.db.collection(this.c.action).createIndex({ "outputs.ref": 1 });

    // Attribution indexes
    await this.db
      .collection(this.c.attribution)
      .createIndex({ "resourceRef.ref": 1 });
    await this.db.collection(this.c.attribution).createIndex({ actionId: 1 });
    await this.db.collection(this.c.attribution).createIndex({ entityId: 1 });
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

    try {
      await this.db.collection<Entity>(this.c.entity).updateOne(
        { id: entity.id },
        {
          $set: {
            ...entity,
            // Preserve existing publicKey if already set
            publicKey: existing?.publicKey ?? entity.publicKey,
          },
          $setOnInsert: { id: entity.id },
        },
        { upsert: true }
      );
      return entity;
    } catch (error) {
      throw new QueryError("Failed to upsert entity", error);
    }
  }

  async updateEntity(
    id: string,
    update: Partial<Pick<Entity, "name" | "metadata" | "extensions">>
  ): Promise<Entity | null> {
    this.ensureInitialized();

    const existing = await this.getEntity(id);
    if (!existing) return null;

    const setFields: Record<string, unknown> = {};
    if (update.name !== undefined) setFields.name = update.name;
    if (update.metadata !== undefined) {
      setFields.metadata = { ...existing.metadata, ...update.metadata };
    }
    if (update.extensions !== undefined) {
      setFields.extensions = { ...existing.extensions, ...update.extensions };
    }

    if (Object.keys(setFields).length === 0) return existing;

    await this.db.collection<Entity>(this.c.entity).updateOne(
      { id },
      { $set: setFields }
    );

    return this.getEntity(id);
  }

  async getEntity(id: string): Promise<Entity | null> {
    this.ensureInitialized();
    return this.db.collection<Entity>(this.c.entity).findOne({ id });
  }

  async entityExists(id: string): Promise<boolean> {
    this.ensureInitialized();
    const count = await this.db
      .collection(this.c.entity)
      .countDocuments({ id });
    return count > 0;
  }

  async listEntities(filter?: EntityFilter): Promise<Entity[]> {
    this.ensureInitialized();

    const query: Record<string, unknown> = {};
    if (filter?.role) query.role = filter.role;

    let cursor = this.db.collection<Entity>(this.c.entity).find(query);

    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    return cursor.toArray();
  }

  /*--------------------------------------------------------------
   | Resource Operations
   --------------------------------------------------------------*/

  async createResource(resource: Resource): Promise<Resource> {
    this.ensureInitialized();

    const ref = resource.address.ref;

    if (await this.resourceExists(ref)) {
      throw new AlreadyExistsError("Resource", ref);
    }

    try {
      await this.db.collection<Resource>(this.c.resource).insertOne(resource);
      return resource;
    } catch (error) {
      throw new QueryError("Failed to create resource", error);
    }
  }

  async getResource(ref: string): Promise<Resource | null> {
    this.ensureInitialized();
    return this.db
      .collection<Resource>(this.c.resource)
      .findOne({ "address.ref": ref });
  }

  async resourceExists(ref: string): Promise<boolean> {
    this.ensureInitialized();
    const count = await this.db
      .collection(this.c.resource)
      .countDocuments({ "address.ref": ref });
    return count > 0;
  }

  async listResources(filter?: ResourceFilter): Promise<Resource[]> {
    this.ensureInitialized();

    const query: Record<string, unknown> = {};
    if (filter?.type) query.type = filter.type;
    if (filter?.createdBy) query.createdBy = filter.createdBy;

    let cursor = this.db
      .collection<Resource>(this.c.resource)
      .find(query)
      .sort({ createdAt: -1 });

    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    return cursor.toArray();
  }

  /*--------------------------------------------------------------
   | Action Operations
   --------------------------------------------------------------*/

  async createAction(action: Action): Promise<Action> {
    this.ensureInitialized();

    try {
      await this.db.collection<Action>(this.c.action).insertOne(action);
      return action;
    } catch (error) {
      throw new QueryError("Failed to create action", error);
    }
  }

  async getAction(id: string): Promise<Action | null> {
    this.ensureInitialized();
    return this.db.collection<Action>(this.c.action).findOne({ id });
  }

  async getActionsByOutput(ref: string): Promise<Action[]> {
    this.ensureInitialized();
    return this.db
      .collection<Action>(this.c.action)
      .find({ "outputs.ref": ref })
      .toArray();
  }

  async getActionsByInput(ref: string): Promise<Action[]> {
    this.ensureInitialized();
    return this.db
      .collection<Action>(this.c.action)
      .find({ "inputs.ref": ref })
      .toArray();
  }

  async listActions(filter?: ActionFilter): Promise<Action[]> {
    this.ensureInitialized();

    const query: Record<string, unknown> = {};
    if (filter?.type) query.type = filter.type;
    if (filter?.performedBy) query.performedBy = filter.performedBy;

    let cursor = this.db
      .collection<Action>(this.c.action)
      .find(query)
      .sort({ timestamp: -1 });

    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    return cursor.toArray();
  }

  async updateAction(
    id: string,
    update: Partial<Pick<Action, "extensions" | "proof">>
  ): Promise<Action | null> {
    this.ensureInitialized();

    const existing = await this.getAction(id);
    if (!existing) return null;

    const setFields: Record<string, unknown> = {};
    if (update.extensions !== undefined) {
      // Merge extensions
      const merged = { ...existing.extensions, ...update.extensions };
      setFields.extensions = merged;
    }
    if (update.proof !== undefined) {
      setFields.proof = update.proof;
    }

    if (Object.keys(setFields).length === 0) return existing;

    try {
      await this.db
        .collection<Action>(this.c.action)
        .updateOne({ id }, { $set: setFields });
      return this.getAction(id);
    } catch (error) {
      throw new QueryError("Failed to update action", error);
    }
  }

  /*--------------------------------------------------------------
   | Attribution Operations
   --------------------------------------------------------------*/

  async createAttribution(attribution: Attribution): Promise<Attribution> {
    this.ensureInitialized();

    const id =
      attribution.id ??
      `attr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const attrWithId = { ...attribution, id };

    try {
      await this.db
        .collection<Attribution>(this.c.attribution)
        .insertOne(attrWithId);
      return attrWithId;
    } catch (error) {
      throw new QueryError("Failed to create attribution", error);
    }
  }

  async getAttributionsByResource(ref: string): Promise<Attribution[]> {
    this.ensureInitialized();
    return this.db
      .collection<Attribution>(this.c.attribution)
      .find({ "resourceRef.ref": ref })
      .toArray();
  }

  async getAttributionsByAction(actionId: string): Promise<Attribution[]> {
    this.ensureInitialized();
    return this.db
      .collection<Attribution>(this.c.attribution)
      .find({ actionId })
      .toArray();
  }

  async getAttributionsByEntity(
    entityId: string,
    filter?: AttributionFilter
  ): Promise<Attribution[]> {
    this.ensureInitialized();

    const query: Record<string, unknown> = { entityId };
    if (filter?.role) query.role = filter.role;

    let cursor = this.db
      .collection<Attribution>(this.c.attribution)
      .find(query);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    return cursor.toArray();
  }

  /*--------------------------------------------------------------
   | Ownership Operations
   --------------------------------------------------------------*/

  async initOwnershipState(resourceRef: string, ownerId: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.db.collection(this.c.ownershipState).updateOne(
        { resourceRef },
        {
          $setOnInsert: {
            resourceRef,
            currentOwnerId: ownerId,
            lastTransferId: null,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      throw new QueryError("Failed to init ownership state", error);
    }
  }

  async getOwnershipState(resourceRef: string): Promise<import("../../db/interface").OwnershipState | null> {
    this.ensureInitialized();
    const doc = await this.db
      .collection<import("../../db/interface").OwnershipState>(this.c.ownershipState)
      .findOne({ resourceRef });
    return doc ?? null;
  }

  async transferOwnershipState(
    resourceRef: string,
    newOwnerId: string,
    transferActionId: string
  ): Promise<void> {
    this.ensureInitialized();
    try {
      await this.db.collection(this.c.ownershipState).updateOne(
        { resourceRef },
        {
          $set: {
            currentOwnerId: newOwnerId,
            lastTransferId: transferActionId,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: { resourceRef },
        },
        { upsert: true }
      );
    } catch (error) {
      throw new QueryError("Failed to transfer ownership state", error);
    }
  }

  async getOwnershipHistory(resourceRef: string): Promise<Action[]> {
    this.ensureInitialized();
    // Query actions whose inputs contain this ref and type is an ownership action
    const results = await this.db
      .collection<Action>(this.c.action)
      .find({
        $or: [
          { type: "ext:ownership:claim@1.0.0" },
          { type: "ext:ownership:transfer@1.0.0" },
        ],
        "inputs.ref": resourceRef,
      })
      .sort({ timestamp: 1 })
      .toArray();
    return results;
  }

  /*--------------------------------------------------------------
   | Transaction Support
   --------------------------------------------------------------*/

  async transaction<T>(
    fn: (storage: IProvenanceStorage) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();
    // MongoDB transactions require replica sets
    // For simplicity, run directly (no transaction isolation)
    // Users who need transactions should use a session wrapper
    return fn(this);
  }
}
