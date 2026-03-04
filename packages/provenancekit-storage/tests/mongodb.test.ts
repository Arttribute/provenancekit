/**
 * MongoDB Storage Adapter Tests
 *
 * Uses a mock MongoDB implementation that satisfies the MongoDb/MongoCollection
 * interfaces. No real MongoDB connection required.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cidRef } from "@provenancekit/eaa-types";
import type { Entity, Resource, Action, Attribution } from "@provenancekit/eaa-types";
import {
  MongoDBStorage,
  type MongoDb,
  type MongoCollection,
  type MongoCursor,
} from "../src/adapters/db/mongodb";
import { AlreadyExistsError, DbNotInitializedError } from "../src/db/errors";

// ─── Mock MongoDB Implementation ─────────────────────────────────────────────

class MockCursor<T> implements MongoCursor<T> {
  private data: T[];

  constructor(data: T[]) {
    this.data = [...data];
  }

  skip(n: number): MongoCursor<T> {
    return new MockCursor(this.data.slice(n));
  }

  limit(n: number): MongoCursor<T> {
    return new MockCursor(this.data.slice(0, n));
  }

  sort(sortSpec: Record<string, 1 | -1>): MongoCursor<T> {
    const [field, dir] = Object.entries(sortSpec)[0];
    const sorted = [...this.data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[field] as string;
      const bv = (b as Record<string, unknown>)[field] as string;
      if (av === undefined || bv === undefined) return 0;
      return dir === 1 ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return new MockCursor(sorted);
  }

  async toArray(): Promise<T[]> {
    return this.data;
  }
}

class MockCollection<T = unknown> implements MongoCollection<T> {
  protected store: Map<string, T & { _id?: string }> = new Map();
  protected uniqueKeys: (string | string[])[] = [];
  private idKey = "_id";

  constructor(private getDocId: (doc: T) => string = (doc) => {
    return (doc as Record<string, unknown>)["id"] as string ?? String(Date.now());
  }) {}

  async insertOne(doc: T): Promise<{ insertedId: unknown }> {
    const id = this.getDocId(doc);
    if (this.store.has(id)) {
      throw new Error(`Duplicate key error: ${id}`);
    }
    this.store.set(id, { ...(doc as Record<string, unknown>) } as T & { _id?: string });
    return { insertedId: id };
  }

  async findOne(filter: Record<string, unknown>): Promise<T | null> {
    const match = this.matchFilter(filter);
    return match ? { ...match } as T : null;
  }

  find(filter: Record<string, unknown>): MongoCursor<T> {
    const matches = Array.from(this.store.values()).filter(doc =>
      this.docMatchesFilter(doc, filter)
    );
    return new MockCursor(matches.map(d => ({ ...d }) as T));
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { upsert?: boolean }
  ): Promise<unknown> {
    // Find the existing entry AND its actual store key (avoids re-computing an
    // inconsistent key from the document's fields on update)
    let existingKey: string | null = null;
    let existing: (T & { _id?: string }) | null = null;
    for (const [key, doc] of this.store.entries()) {
      if (this.docMatchesFilter(doc, filter)) {
        existingKey = key;
        existing = doc;
        break;
      }
    }

    const $set = (update["$set"] ?? {}) as Record<string, unknown>;
    const $setOnInsert = (update["$setOnInsert"] ?? {}) as Record<string, unknown>;

    if (existing && existingKey) {
      // Update existing — preserve the original store key
      const updated = { ...existing, ...$set };
      this.store.set(existingKey, updated as T & { _id?: string });
    } else if (options?.upsert) {
      // Insert new
      const doc = { ...$setOnInsert, ...$set } as T;
      const id = this.getDocId(doc) ?? `auto_${Math.random().toString(36).slice(2)}`;
      this.store.set(id, doc as T & { _id?: string });
    }
    return {};
  }

  async countDocuments(filter: Record<string, unknown>): Promise<number> {
    return Array.from(this.store.values()).filter(doc =>
      this.docMatchesFilter(doc, filter)
    ).length;
  }

  async createIndex(_keys: Record<string, 1 | -1>, _options?: { unique?: boolean }): Promise<string> {
    return "index_created";
  }

  private matchFilter(filter: Record<string, unknown>): (T & { _id?: string }) | null {
    const results = Array.from(this.store.values()).filter(doc =>
      this.docMatchesFilter(doc, filter)
    );
    return results[0] ?? null;
  }

  private docMatchesFilter(doc: unknown, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(([k, v]) => {
      if (k === "$or" && Array.isArray(v)) {
        return v.some(subFilter => this.docMatchesFilter(doc, subFilter as Record<string, unknown>));
      }
      // Support dot notation (e.g. "address.ref", "outputs.ref")
      const val = getNestedValue(doc as Record<string, unknown>, k);
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        // Simple object match
        return val !== null && typeof val === "object" && matchNested(val as Record<string, unknown>, v as Record<string, unknown>);
      }
      // MongoDB array element matching: if getNestedValue returned an array of
      // sub-field values (e.g. outputs[*].ref), check if `v` is among them.
      if (Array.isArray(val)) {
        return val.includes(v);
      }
      return val === v;
    });
  }
}

class MockAttributionCollection extends MockCollection<Attribution> {
  constructor() {
    super((doc) => (doc as Attribution).id ?? `attr_${Math.random().toString(36).slice(2)}`);
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      // MongoDB array element matching: collect values at `part` from each element.
      // The caller can then check if the query value appears in the resulting array.
      return cur.map(item => {
        if (item === null || typeof item !== "object") return undefined;
        return (item as Record<string, unknown>)[part];
      });
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function matchNested(obj: Record<string, unknown>, pattern: Record<string, unknown>): boolean {
  return Object.entries(pattern).every(([k, v]) => obj[k] === v);
}

function createMockDb(): MongoDb {
  const collections = new Map<string, MockCollection<unknown>>();

  return {
    collection<T = unknown>(name: string): MongoCollection<T> {
      if (!collections.has(name)) {
        if (name.endsWith("attributions")) {
          // Attribution uses a generated id
          collections.set(name, new MockAttributionCollection() as unknown as MockCollection<unknown>);
        } else if (name.endsWith("resources")) {
          // Resources are keyed by address.ref (no top-level `id` field)
          collections.set(name, new MockCollection<unknown>((doc) => {
            const d = doc as Record<string, unknown>;
            return ((d["address"] as Record<string, unknown>)?.["ref"] as string) ?? String(Date.now());
          }));
        } else if (name.endsWith("ownership_state") || name.endsWith("ownershipState")) {
          // Ownership state is keyed by resourceRef
          collections.set(name, new MockCollection<unknown>((doc) => {
            return (doc as Record<string, unknown>)["resourceRef"] as string ?? String(Date.now());
          }));
        } else {
          collections.set(name, new MockCollection<unknown>());
        }
      }
      return collections.get(name)! as MongoCollection<T>;
    },
    async command(_command: Record<string, unknown>): Promise<unknown> {
      return {};
    },
  };
}

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const makeEntity = (id = "alice"): Entity => ({
  id,
  name: "Alice",
  role: "human",
});

const makeResource = (ref = "bafytest123"): Resource => ({
  address: cidRef(ref),
  type: "image",
  locations: [],
  createdAt: "2025-01-15T10:00:00Z",
  createdBy: "alice",
  rootAction: "action-1",
});

const makeAction = (id = "action-1"): Action => ({
  id,
  type: "create",
  performedBy: "alice",
  timestamp: "2025-01-15T10:00:00Z",
  inputs: [],
  outputs: [cidRef("bafytest123")],
});

const makeAttribution = (): Attribution => ({
  resourceRef: cidRef("bafytest123"),
  entityId: "alice",
  role: "creator",
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MongoDBStorage", () => {
  let storage: MongoDBStorage;
  let mockDb: MongoDb;

  beforeEach(async () => {
    mockDb = createMockDb();
    storage = new MongoDBStorage({ db: mockDb });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  describe("lifecycle", () => {
    it("initializes successfully", async () => {
      const db = createMockDb();
      const s = new MongoDBStorage({ db });
      await s.initialize();
      expect(await s.entityExists("test")).toBe(false);
    });

    it("throws DbNotInitializedError when not initialized", async () => {
      const db = createMockDb();
      const s = new MongoDBStorage({ db });
      await expect(s.entityExists("test")).rejects.toThrow(DbNotInitializedError);
    });

    it("uses custom collection prefix", async () => {
      const db = createMockDb();
      const s = new MongoDBStorage({ db, collectionPrefix: "myapp_" });
      await s.initialize();
      const entity = makeEntity();
      await s.upsertEntity(entity);
      expect(await s.entityExists("alice")).toBe(true);
    });

    it("can be closed and reopened", async () => {
      await storage.upsertEntity(makeEntity());
      await storage.close();
      // After close, operations should throw
      await expect(storage.entityExists("alice")).rejects.toThrow(DbNotInitializedError);
    });
  });

  // ─── Entity Operations ──────────────────────────────────────────────────

  describe("entity operations", () => {
    it("creates and retrieves an entity", async () => {
      const entity = makeEntity();
      await storage.upsertEntity(entity);
      const result = await storage.getEntity("alice");
      expect(result?.id).toBe("alice");
      expect(result?.name).toBe("Alice");
      expect(result?.role).toBe("human");
    });

    it("upserts (updates) existing entity", async () => {
      await storage.upsertEntity(makeEntity());
      await storage.upsertEntity({ id: "alice", name: "Alice Smith", role: "human" });
      const result = await storage.getEntity("alice");
      expect(result?.name).toBe("Alice Smith");
    });

    it("returns null for non-existent entity", async () => {
      expect(await storage.getEntity("nobody")).toBeNull();
    });

    it("checks entity existence correctly", async () => {
      expect(await storage.entityExists("alice")).toBe(false);
      await storage.upsertEntity(makeEntity());
      expect(await storage.entityExists("alice")).toBe(true);
    });

    it("preserves publicKey immutability", async () => {
      await storage.upsertEntity({ ...makeEntity(), publicKey: "pk1" });
      await expect(
        storage.upsertEntity({ ...makeEntity(), publicKey: "pk2" })
      ).rejects.toThrow(/publicKey.*immutable/i);
    });

    it("allows updating entity without changing publicKey", async () => {
      await storage.upsertEntity({ ...makeEntity(), publicKey: "pk1" });
      const updated = await storage.upsertEntity({ id: "alice", name: "New Name", role: "human" });
      expect(updated.name).toBe("New Name");
    });

    it("lists entities without filter", async () => {
      await storage.upsertEntity(makeEntity("alice"));
      await storage.upsertEntity(makeEntity("bob"));
      const list = await storage.listEntities();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("filters entities by role", async () => {
      await storage.upsertEntity({ id: "alice", role: "human" });
      await storage.upsertEntity({ id: "bot", role: "ai" });
      const humans = await storage.listEntities({ role: "human" });
      expect(humans.every(e => e.role === "human")).toBe(true);
    });

    it("updateEntity updates name, metadata, extensions", async () => {
      await storage.upsertEntity(makeEntity());
      const updated = await storage.updateEntity("alice", {
        name: "Alice Updated",
        metadata: { foo: "bar" },
      });
      expect(updated?.name).toBe("Alice Updated");
      expect((updated?.metadata as Record<string, string>)?.foo).toBe("bar");
    });

    it("updateEntity returns null for non-existent entity", async () => {
      expect(await storage.updateEntity("nobody", { name: "Test" })).toBeNull();
    });
  });

  // ─── Resource Operations ─────────────────────────────────────────────────

  describe("resource operations", () => {
    it("creates and retrieves a resource by ref", async () => {
      const resource = makeResource();
      await storage.createResource(resource);
      const result = await storage.getResource("bafytest123");
      expect(result?.address.ref).toBe("bafytest123");
      expect(result?.type).toBe("image");
    });

    it("throws AlreadyExistsError when creating duplicate resource", async () => {
      await storage.createResource(makeResource());
      await expect(storage.createResource(makeResource())).rejects.toThrow(AlreadyExistsError);
    });

    it("returns null for non-existent resource", async () => {
      expect(await storage.getResource("nonexistent")).toBeNull();
    });

    it("checks resource existence", async () => {
      expect(await storage.resourceExists("bafytest123")).toBe(false);
      await storage.createResource(makeResource());
      expect(await storage.resourceExists("bafytest123")).toBe(true);
    });

    it("lists resources without filter", async () => {
      await storage.createResource(makeResource("bafya"));
      await storage.createResource(makeResource("bafyb"));
      const list = await storage.listResources();
      expect(list.length).toBe(2);
    });

    it("filters resources by type", async () => {
      await storage.createResource({ ...makeResource("bafya"), type: "image" });
      await storage.createResource({ ...makeResource("bafyb"), type: "text" });
      const images = await storage.listResources({ type: "image" });
      expect(images.length).toBe(1);
      expect(images[0]!.type).toBe("image");
    });

    it("filters resources by createdBy", async () => {
      await storage.createResource({ ...makeResource("bafya"), createdBy: "alice" });
      await storage.createResource({ ...makeResource("bafyb"), createdBy: "bob" });
      const alices = await storage.listResources({ createdBy: "alice" });
      expect(alices.length).toBe(1);
      expect(alices[0]!.createdBy).toBe("alice");
    });

    it("applies limit and offset to listResources", async () => {
      for (let i = 0; i < 5; i++) {
        await storage.createResource(makeResource(`bafytest${i}`));
      }
      const page = await storage.listResources({ limit: 2, offset: 1 });
      expect(page.length).toBe(2);
    });
  });

  // ─── Action Operations ───────────────────────────────────────────────────

  describe("action operations", () => {
    it("creates and retrieves an action", async () => {
      const action = makeAction();
      await storage.createAction(action);
      const result = await storage.getAction("action-1");
      expect(result?.id).toBe("action-1");
      expect(result?.type).toBe("create");
    });

    it("returns null for non-existent action", async () => {
      expect(await storage.getAction("nonexistent")).toBeNull();
    });

    it("lists actions by type filter", async () => {
      await storage.createAction({ ...makeAction("a1"), type: "create" });
      await storage.createAction({ ...makeAction("a2"), type: "transform" });
      const creates = await storage.listActions({ type: "create" });
      expect(creates.length).toBe(1);
      expect(creates[0]!.type).toBe("create");
    });

    it("lists actions by performedBy filter", async () => {
      await storage.createAction({ ...makeAction("a1"), performedBy: "alice" });
      await storage.createAction({ ...makeAction("a2"), performedBy: "bob" });
      const alices = await storage.listActions({ performedBy: "alice" });
      expect(alices.every(a => a.performedBy === "alice")).toBe(true);
    });

    it("gets actions by output ref", async () => {
      const action = makeAction();
      await storage.createAction(action);
      const results = await storage.getActionsByOutput("bafytest123");
      expect(results.length).toBe(1);
      expect(results[0]!.id).toBe("action-1");
    });

    it("gets actions by input ref", async () => {
      const action: Action = {
        ...makeAction("a2"),
        inputs: [cidRef("bafy-input")],
        outputs: [],
      };
      await storage.createAction(action);
      const results = await storage.getActionsByInput("bafy-input");
      expect(results.length).toBe(1);
    });

    it("updates action extensions and proof", async () => {
      await storage.createAction(makeAction());
      const updated = await storage.updateAction("action-1", {
        proof: "sig:abc",
        extensions: { "ext:onchain@1.0.0": { txHash: "0xabc" } },
      });
      expect(updated?.proof).toBe("sig:abc");
      expect((updated?.extensions?.["ext:onchain@1.0.0"] as Record<string, unknown>)?.txHash).toBe("0xabc");
    });

    it("updateAction returns null for non-existent action", async () => {
      expect(await storage.updateAction("nobody", { proof: "x" })).toBeNull();
    });
  });

  // ─── Attribution Operations ───────────────────────────────────────────────

  describe("attribution operations", () => {
    it("creates and retrieves attribution by resource ref", async () => {
      const attr = makeAttribution();
      await storage.createAttribution(attr);
      const results = await storage.getAttributionsByResource("bafytest123");
      expect(results.length).toBe(1);
      expect(results[0]!.entityId).toBe("alice");
    });

    it("creates attribution by action ID", async () => {
      const attr: Attribution = {
        actionId: "action-1",
        entityId: "bob",
        role: "contributor",
      };
      await storage.createAttribution(attr);
      const results = await storage.getAttributionsByAction("action-1");
      expect(results.length).toBe(1);
      expect(results[0]!.entityId).toBe("bob");
    });

    it("retrieves attributions by entity", async () => {
      await storage.createAttribution(makeAttribution());
      await storage.createAttribution({
        resourceRef: cidRef("bafy-other"),
        entityId: "alice",
        role: "contributor",
      });
      const results = await storage.getAttributionsByEntity("alice");
      expect(results.length).toBe(2);
    });

    it("filters attributions by role", async () => {
      await storage.createAttribution({ resourceRef: cidRef("bafy1"), entityId: "alice", role: "creator" });
      await storage.createAttribution({ resourceRef: cidRef("bafy2"), entityId: "alice", role: "contributor" });
      const creators = await storage.getAttributionsByEntity("alice", { role: "creator" });
      expect(creators.every(a => a.role === "creator")).toBe(true);
    });

    it("auto-generates ID when none provided", async () => {
      const attr = makeAttribution(); // no id field
      const saved = await storage.createAttribution(attr);
      expect(saved.id).toBeDefined();
    });
  });

  // ─── Ownership Operations ────────────────────────────────────────────────

  describe("ownership operations", () => {
    it("initializes and retrieves ownership state", async () => {
      await storage.initOwnershipState("bafytest123", "alice");
      const state = await storage.getOwnershipState("bafytest123");
      expect(state?.currentOwnerId).toBe("alice");
      expect(state?.lastTransferId).toBeNull();
    });

    it("returns null for non-existent ownership state", async () => {
      expect(await storage.getOwnershipState("nonexistent")).toBeNull();
    });

    it("does not overwrite existing ownership on re-init", async () => {
      await storage.initOwnershipState("bafytest123", "alice");
      await storage.initOwnershipState("bafytest123", "bob"); // should not overwrite
      const state = await storage.getOwnershipState("bafytest123");
      expect(state?.currentOwnerId).toBe("alice");
    });

    it("transfers ownership", async () => {
      await storage.initOwnershipState("bafytest123", "alice");
      await storage.transferOwnershipState("bafytest123", "bob", "transfer-action-1");
      const state = await storage.getOwnershipState("bafytest123");
      expect(state?.currentOwnerId).toBe("bob");
      expect(state?.lastTransferId).toBe("transfer-action-1");
    });
  });

  // ─── Transaction Support ─────────────────────────────────────────────────

  describe("transaction", () => {
    it("executes operations within transaction callback", async () => {
      const result = await storage.transaction(async (s) => {
        await s.upsertEntity(makeEntity());
        return s.getEntity("alice");
      });
      expect(result?.id).toBe("alice");
    });
  });
});
