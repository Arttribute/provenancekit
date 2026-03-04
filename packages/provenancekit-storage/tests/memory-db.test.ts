import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cidRef } from "@provenancekit/eaa-types";
import type { Entity, Resource, Action, Attribution } from "@provenancekit/eaa-types";
import { MemoryDbStorage } from "../src/adapters/db/memory";
import { AlreadyExistsError, DbNotInitializedError } from "../src/db/errors";

describe("MemoryDbStorage", () => {
  let storage: MemoryDbStorage;

  beforeEach(async () => {
    storage = new MemoryDbStorage();
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe("lifecycle", () => {
    it("initializes successfully", async () => {
      const newStorage = new MemoryDbStorage();
      await newStorage.initialize();
      // Should not throw
      expect(await newStorage.entityExists("test")).toBe(false);
    });

    it("throws when not initialized", async () => {
      const newStorage = new MemoryDbStorage();
      await expect(newStorage.entityExists("test")).rejects.toThrow(
        DbNotInitializedError
      );
    });

    it("clears data on close", async () => {
      const entity: Entity = { id: "test", name: "Test", role: "human" };
      await storage.upsertEntity(entity);
      expect(await storage.entityExists("test")).toBe(true);

      await storage.close();
      await storage.initialize();

      expect(await storage.entityExists("test")).toBe(false);
    });
  });

  describe("entity operations", () => {
    it("creates and retrieves an entity", async () => {
      const entity: Entity = {
        id: "alice",
        name: "Alice",
        role: "human",
      };

      await storage.upsertEntity(entity);
      const retrieved = await storage.getEntity("alice");

      expect(retrieved).toEqual(entity);
    });

    it("updates an existing entity", async () => {
      const entity: Entity = { id: "alice", name: "Alice", role: "human" };
      await storage.upsertEntity(entity);

      const updated: Entity = { id: "alice", name: "Alice Smith", role: "human" };
      await storage.upsertEntity(updated);

      const retrieved = await storage.getEntity("alice");
      expect(retrieved?.name).toBe("Alice Smith");
    });

    it("returns null for non-existent entity", async () => {
      const result = await storage.getEntity("nonexistent");
      expect(result).toBeNull();
    });

    it("checks entity existence", async () => {
      const entity: Entity = { id: "alice", name: "Alice", role: "human" };
      await storage.upsertEntity(entity);

      expect(await storage.entityExists("alice")).toBe(true);
      expect(await storage.entityExists("bob")).toBe(false);
    });
  });

  describe("resource operations", () => {
    it("creates and retrieves a resource", async () => {
      const resource: Resource = {
        address: cidRef("bafytest123"),
        type: "image",
      };

      await storage.createResource(resource);
      const retrieved = await storage.getResource("bafytest123");

      expect(retrieved).toEqual(resource);
    });

    it("throws when creating duplicate resource", async () => {
      const resource: Resource = {
        address: cidRef("bafytest123"),
        type: "image",
      };

      await storage.createResource(resource);
      await expect(storage.createResource(resource)).rejects.toThrow(
        AlreadyExistsError
      );
    });

    it("returns null for non-existent resource", async () => {
      const result = await storage.getResource("nonexistent");
      expect(result).toBeNull();
    });

    it("checks resource existence", async () => {
      const resource: Resource = {
        address: cidRef("bafytest123"),
        type: "image",
      };
      await storage.createResource(resource);

      expect(await storage.resourceExists("bafytest123")).toBe(true);
      expect(await storage.resourceExists("nonexistent")).toBe(false);
    });

    it("lists resources with filtering", async () => {
      const resources: Resource[] = [
        { address: cidRef("bafy1"), type: "image", createdBy: "alice" },
        { address: cidRef("bafy2"), type: "text", createdBy: "alice" },
        { address: cidRef("bafy3"), type: "image", createdBy: "bob" },
      ];

      for (const r of resources) {
        await storage.createResource(r);
      }

      // Filter by type
      const images = await storage.listResources({ type: "image" });
      expect(images).toHaveLength(2);

      // Filter by creator
      const aliceResources = await storage.listResources({ createdBy: "alice" });
      expect(aliceResources).toHaveLength(2);

      // Combined filter
      const aliceImages = await storage.listResources({
        type: "image",
        createdBy: "alice",
      });
      expect(aliceImages).toHaveLength(1);
    });

    it("supports pagination", async () => {
      const resources: Resource[] = Array.from({ length: 10 }, (_, i) => ({
        address: cidRef(`bafy${i}`),
        type: "image",
      }));

      for (const r of resources) {
        await storage.createResource(r);
      }

      const page1 = await storage.listResources({ limit: 3 });
      expect(page1).toHaveLength(3);

      const page2 = await storage.listResources({ offset: 3, limit: 3 });
      expect(page2).toHaveLength(3);
      expect(page2[0].address.ref).not.toBe(page1[0].address.ref);
    });
  });

  describe("action operations", () => {
    it("creates and retrieves an action", async () => {
      const action: Action = {
        id: "action-1",
        type: "create",
        performedBy: "alice",
        timestamp: new Date().toISOString(),
        inputs: [],
        outputs: [cidRef("bafy-output")],
      };

      await storage.createAction(action);
      const retrieved = await storage.getAction("action-1");

      expect(retrieved).toEqual(action);
    });

    it("throws when creating duplicate action", async () => {
      const action: Action = {
        id: "action-1",
        type: "create",
        performedBy: "alice",
        timestamp: new Date().toISOString(),
        inputs: [],
        outputs: [],
      };

      await storage.createAction(action);
      await expect(storage.createAction(action)).rejects.toThrow(
        AlreadyExistsError
      );
    });

    it("gets actions by output", async () => {
      const action1: Action = {
        id: "action-1",
        type: "create",
        performedBy: "alice",
        timestamp: new Date().toISOString(),
        inputs: [],
        outputs: [cidRef("bafy-output")],
      };
      const action2: Action = {
        id: "action-2",
        type: "transform",
        performedBy: "bob",
        timestamp: new Date().toISOString(),
        inputs: [cidRef("bafy-output")],
        outputs: [cidRef("bafy-derived")],
      };

      await storage.createAction(action1);
      await storage.createAction(action2);

      const byOutput = await storage.getActionsByOutput("bafy-output");
      expect(byOutput).toHaveLength(1);
      expect(byOutput[0].id).toBe("action-1");
    });

    it("gets actions by input", async () => {
      const action: Action = {
        id: "action-1",
        type: "transform",
        performedBy: "alice",
        timestamp: new Date().toISOString(),
        inputs: [cidRef("bafy-input")],
        outputs: [cidRef("bafy-output")],
      };

      await storage.createAction(action);

      const byInput = await storage.getActionsByInput("bafy-input");
      expect(byInput).toHaveLength(1);
      expect(byInput[0].id).toBe("action-1");
    });

    it("lists actions with filtering", async () => {
      const actions: Action[] = [
        {
          id: "a1",
          type: "create",
          performedBy: "alice",
          timestamp: new Date().toISOString(),
          inputs: [],
          outputs: [],
        },
        {
          id: "a2",
          type: "transform",
          performedBy: "alice",
          timestamp: new Date().toISOString(),
          inputs: [],
          outputs: [],
        },
        {
          id: "a3",
          type: "create",
          performedBy: "bob",
          timestamp: new Date().toISOString(),
          inputs: [],
          outputs: [],
        },
      ];

      for (const a of actions) {
        await storage.createAction(a);
      }

      const creates = await storage.listActions({ type: "create" });
      expect(creates).toHaveLength(2);

      const aliceActions = await storage.listActions({ performedBy: "alice" });
      expect(aliceActions).toHaveLength(2);
    });
  });

  describe("attribution operations", () => {
    it("creates and retrieves attributions by resource", async () => {
      const attr: Attribution = {
        resourceRef: cidRef("bafy-resource"),
        entityId: "alice",
        role: "creator",
      };

      await storage.createAttribution(attr);
      const retrieved = await storage.getAttributionsByResource("bafy-resource");

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(attr);
    });

    it("gets attributions by action", async () => {
      const attr: Attribution = {
        actionId: "action-123",
        entityId: "alice",
        role: "contributor",
      };

      await storage.createAttribution(attr);
      const retrieved = await storage.getAttributionsByAction("action-123");

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].actionId).toBe("action-123");
    });

    it("gets attributions by entity", async () => {
      const attrs: Attribution[] = [
        { resourceRef: cidRef("bafy1"), entityId: "alice", role: "creator" },
        { resourceRef: cidRef("bafy2"), entityId: "alice", role: "contributor" },
        { resourceRef: cidRef("bafy3"), entityId: "bob", role: "creator" },
      ];

      for (const a of attrs) {
        await storage.createAttribution(a);
      }

      const aliceAttrs = await storage.getAttributionsByEntity("alice");
      expect(aliceAttrs).toHaveLength(2);

      const aliceCreator = await storage.getAttributionsByEntity("alice", {
        role: "creator",
      });
      expect(aliceCreator).toHaveLength(1);
    });
  });

  describe("transaction support", () => {
    it("commits successful transaction", async () => {
      await storage.transaction(async (tx) => {
        await tx.upsertEntity({ id: "alice", name: "Alice", role: "human" });
        await tx.createResource({ address: cidRef("bafy1"), type: "image" });
      });

      expect(await storage.entityExists("alice")).toBe(true);
      expect(await storage.resourceExists("bafy1")).toBe(true);
    });

    it("rolls back failed transaction", async () => {
      await storage.upsertEntity({ id: "existing", name: "Existing", role: "human" });

      try {
        await storage.transaction(async (tx) => {
          await tx.upsertEntity({ id: "alice", name: "Alice", role: "human" });
          throw new Error("Intentional failure");
        });
      } catch (e) {
        // Expected
      }

      // Alice should not exist after rollback
      expect(await storage.entityExists("alice")).toBe(false);
      // Existing should still be there
      expect(await storage.entityExists("existing")).toBe(true);
    });
  });

  describe("utility methods", () => {
    it("clears all data", async () => {
      await storage.upsertEntity({ id: "alice", name: "Alice", role: "human" });
      await storage.createResource({ address: cidRef("bafy1"), type: "image" });

      storage.clear();

      expect(await storage.entityExists("alice")).toBe(false);
      expect(await storage.resourceExists("bafy1")).toBe(false);
    });

    it("returns stats", async () => {
      await storage.upsertEntity({ id: "alice", name: "Alice", role: "human" });
      await storage.createResource({ address: cidRef("bafy1"), type: "image" });
      await storage.createAction({
        id: "a1",
        type: "create",
        performedBy: "alice",
        timestamp: new Date().toISOString(),
        inputs: [],
        outputs: [],
      });
      await storage.createAttribution({
        resourceRef: cidRef("bafy1"),
        entityId: "alice",
        role: "creator",
      });

      const stats = storage.stats();

      expect(stats.entities).toBe(1);
      expect(stats.resources).toBe(1);
      expect(stats.actions).toBe(1);
      expect(stats.attributions).toBe(1);
    });
  });
});
