/**
 * ProvenanceKit API — Integration Tests
 *
 * Tests all major API routes using in-memory storage adapters.
 * No external services (Supabase, Pinata, Xenova) are required.
 *
 * Strategy:
 * - vi.mock("../context.js") provides a MemoryDbStorage-backed context
 * - vi.mock("../embedding/service.js") prevents ML model loading
 * - createApp({ authProviders: [] }) disables auth for all tests
 * - Hono's app.request() drives HTTP without a real server
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryDbStorage } from "@provenancekit/storage/adapters/db/memory";
import { MemoryFileStorage } from "@provenancekit/storage/adapters/files/memory";
import { cidRef } from "@provenancekit/eaa-types";
import type { IProvenanceStorage, IVectorStorage } from "@provenancekit/storage";

// ─── Mock Setup ──────────────────────────────────────────────────────────────

// vi.hoisted runs before module evaluation so the mock factory can reference it
const { mockGetContext } = vi.hoisted(() => ({
  mockGetContext: vi.fn(),
}));

// Mock context — replaces Supabase + Pinata with in-memory adapters
vi.mock("../context.js", () => ({
  getContext: mockGetContext,
  initializeContext: vi.fn().mockResolvedValue({}),
  closeContext: vi.fn().mockResolvedValue(undefined),
}));

// Mock embedding service — prevents Xenova transformer model downloads
vi.mock("../embedding/service.js", () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({
    vector: vi.fn().mockResolvedValue(new Array(512).fill(0)),
    store: vi.fn().mockResolvedValue(undefined),
    storeEncrypted: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── App Import (after mocks are registered) ─────────────────────────────────

// Dynamic import ensures mocks are in place before module code runs
const { createApp } = await import("../index.js");

// ─── Test Context Factory ─────────────────────────────────────────────────────

function makeTestContext(
  memDb: MemoryDbStorage,
  memFile: MemoryFileStorage
) {
  return {
    // Cast: tests don't invoke vector-search paths so the missing methods are fine
    dbStorage: memDb as unknown as IProvenanceStorage & IVectorStorage,
    fileStorage: memFile,
    encryptedStorage: {
      upload: vi.fn().mockResolvedValue({ cid: "bafy-encrypted", url: "ipfs://bafy-encrypted" }),
      download: vi.fn().mockResolvedValue(Buffer.from("data")),
    },
    ipfsGateway: "http://localhost:8080",
    supabase: {} as never,
    generateKey: () => new Uint8Array(32),
    serverSigningKey: undefined,
    serverPublicKey: undefined,
    blockchain: undefined,
    attestationProvider: undefined,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("ProvenanceKit API", () => {
  let app: ReturnType<typeof createApp>;
  let memDb: MemoryDbStorage;
  let memFile: MemoryFileStorage;

  beforeEach(async () => {
    memDb = new MemoryDbStorage();
    await memDb.initialize();
    memFile = new MemoryFileStorage();
    await memFile.initialize();
    mockGetContext.mockReturnValue(makeTestContext(memDb, memFile));
    // No auth providers → all routes are public in test mode
    app = createApp({ authProviders: [] });
  });

  // ─── Health ───────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns ok", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });
  });

  // ─── Entity ───────────────────────────────────────────────────────────────

  describe("POST /entity", () => {
    it("creates a human entity and returns 201", async () => {
      const res = await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "human", name: "Alice" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.entity).toBeDefined();
      const entity = body.entity as Record<string, unknown>;
      expect(entity.role).toBe("human");
      expect(entity.name).toBe("Alice");
      expect(typeof entity.id).toBe("string");
    });

    it("creates entity with explicit id", async () => {
      const res = await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human", name: "Alice" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect((body.entity as Record<string, unknown>).id).toBe("alice");
    });

    it("creates an AI agent entity", async () => {
      const res = await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "gpt4o-agent",
          role: "ai",
          name: "GPT-4o",
          aiAgent: {
            model: { provider: "openai", model: "gpt-4o" },
            autonomyLevel: "supervised",
          },
        }),
      });
      expect(res.status).toBe(201);
      // POST returns the entity object; GET /entity/:id returns { entity, isAIAgent }
      const getRes = await app.request("/entity/gpt4o-agent");
      const body = await getRes.json() as Record<string, unknown>;
      expect(body.isAIAgent).toBe(true);
    });

    it("returns 400 when role is missing", async () => {
      const res = await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alice" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as Record<string, unknown>;
      expect((body.error as Record<string, unknown>).code).toBe("MissingField");
    });

    it("returns 400 when AI agent is missing model fields", async () => {
      const res = await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "ai",
          aiAgent: { model: { provider: "openai" } }, // missing model.model
        }),
      });
      expect(res.status).toBe(400);
    });

    it("upserts an existing entity", async () => {
      // Create
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human", name: "Alice" }),
      });
      // Update
      const res = await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human", name: "Alice Smith" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect((body.entity as Record<string, unknown>).name).toBe("Alice Smith");
    });
  });

  describe("GET /entity/:id", () => {
    it("returns entity by id", async () => {
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human", name: "Alice" }),
      });
      const res = await app.request("/entity/alice");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect((body.entity as Record<string, unknown>).id).toBe("alice");
      expect(body.isAIAgent).toBe(false);
    });

    it("returns 404 for non-existent entity", async () => {
      const res = await app.request("/entity/nobody");
      expect(res.status).toBe(404);
      const body = await res.json() as Record<string, unknown>;
      expect((body.error as Record<string, unknown>).code).toBe("NotFound");
    });

    it("returns AI agent data for AI entities", async () => {
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "gpt4",
          role: "ai",
          aiAgent: { model: { provider: "openai", model: "gpt-4o" } },
        }),
      });
      const res = await app.request("/entity/gpt4");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.isAIAgent).toBe(true);
      expect(body.aiAgent).toBeDefined();
    });
  });

  describe("GET /entities", () => {
    it("returns empty list when no entities", async () => {
      const res = await app.request("/entities");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(Array.isArray(body.entities)).toBe(true);
      expect(body.count).toBe(0);
    });

    it("returns all entities", async () => {
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human" }),
      });
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "bob", role: "human" }),
      });
      const res = await app.request("/entities");
      const body = await res.json() as Record<string, unknown>;
      expect(body.count).toBe(2);
    });

    it("filters by role", async () => {
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human" }),
      });
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "gpt4",
          role: "ai",
          aiAgent: { model: { provider: "openai", model: "gpt-4o" } },
        }),
      });
      const res = await app.request("/entities?role=human");
      const body = await res.json() as Record<string, unknown>;
      expect(body.count).toBe(1);
      expect(((body.entities as Record<string, unknown>[])[0]).role).toBe("human");
    });
  });

  // ─── AI Agent endpoint ─────────────────────────────────────────────────────

  describe("GET /entity/:id/ai-agent", () => {
    it("returns agent data for AI entity", async () => {
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "gpt4",
          role: "ai",
          aiAgent: { model: { provider: "openai", model: "gpt-4o" } },
        }),
      });
      const res = await app.request("/entity/gpt4/ai-agent");
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent entity", async () => {
      const res = await app.request("/entity/nobody/ai-agent");
      expect(res.status).toBe(404);
    });

    it("returns error for non-AI entity", async () => {
      await app.request("/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "alice", role: "human" }),
      });
      const res = await app.request("/entity/alice/ai-agent");
      // "Unsupported" error code maps to HTTP 415
      expect(res.status).toBe(415);
    });
  });

  // ─── Bundle / Provenance ──────────────────────────────────────────────────

  describe("GET /bundle/:cid", () => {
    it("returns 404 when resource does not exist", async () => {
      const res = await app.request("/bundle/bafynonexistent");
      expect(res.status).toBe(404);
      const body = await res.json() as Record<string, unknown>;
      expect((body.error as Record<string, unknown>).code).toBe("NotFound");
    });

    it("returns bundle for existing resource", async () => {
      // Pre-seed storage with a resource
      await memDb.createResource({
        address: cidRef("bafytest123"),
        type: "image",
        locations: [],
        createdAt: "2025-01-15T10:00:00Z",
        createdBy: "alice",
        rootAction: "action-1",
      });
      const res = await app.request("/bundle/bafytest123");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      // ProvenanceBundle has shape: { context, entities, resources, actions, attributions }
      expect(Array.isArray(body.resources)).toBe(true);
      expect((body.resources as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe("GET /provenance/:cid", () => {
    it("returns 404 for non-existent resource", async () => {
      const res = await app.request("/provenance/bafynonexistent");
      expect(res.status).toBe(404);
    });

    it("returns same data as /bundle/:cid", async () => {
      await memDb.createResource({
        address: cidRef("bafytest123"),
        type: "text",
        locations: [],
        createdAt: "2025-01-15T10:00:00Z",
        createdBy: "alice",
        rootAction: "action-1",
      });
      const [bundleRes, provRes] = await Promise.all([
        app.request("/bundle/bafytest123"),
        app.request("/provenance/bafytest123"),
      ]);
      expect(bundleRes.status).toBe(200);
      expect(provRes.status).toBe(200);
      const [bundleBody, provBody] = await Promise.all([bundleRes.json(), provRes.json()]);
      expect(bundleBody).toEqual(provBody);
    });
  });

  // ─── Graph ────────────────────────────────────────────────────────────────

  describe("GET /graph/:cid", () => {
    it("returns empty graph for non-existent resource", async () => {
      const res = await app.request("/graph/bafynonexistent");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.nodes).toEqual([]);
      expect(body.edges).toEqual([]);
    });

    it("returns graph nodes for existing resource", async () => {
      await memDb.upsertEntity({ id: "alice", name: "Alice", role: "human" });
      await memDb.createResource({
        address: cidRef("bafytest123"),
        type: "image",
        locations: [],
        createdAt: "2025-01-15T10:00:00Z",
        createdBy: "alice",
        rootAction: "action-1",
      });
      await memDb.createAction({
        id: "action-1",
        type: "create",
        performedBy: "alice",
        timestamp: "2025-01-15T10:00:00Z",
        inputs: [],
        outputs: [cidRef("bafytest123")],
      });
      const res = await app.request("/graph/bafytest123");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect((body.nodes as unknown[]).length).toBeGreaterThan(0);
      expect((body.edges as unknown[]).length).toBeGreaterThan(0);
    });

    it("rejects invalid depth", async () => {
      const res = await app.request("/graph/bafytest?depth=-1");
      expect(res.status).toBe(400);
    });
  });

  // ─── Session Provenance ───────────────────────────────────────────────────

  describe("GET /session/:id/provenance", () => {
    it("returns empty provenance for a new session", async () => {
      const res = await app.request("/session/sess-001/provenance");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(Array.isArray(body.actions)).toBe(true);
      expect(Array.isArray(body.resources)).toBe(true);
      expect(Array.isArray(body.entities)).toBe(true);
      expect(body.actions).toHaveLength(0);
    });

    it("requires a session id", async () => {
      // The route needs an id, but sending empty path segment results in 404
      const res = await app.request("/session//provenance");
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── Ownership ────────────────────────────────────────────────────────────

  describe("GET /resource/:cid/ownership", () => {
    it("returns 404 when resource does not exist", async () => {
      const res = await app.request("/resource/bafynonexistent/ownership");
      expect(res.status).toBe(404);
    });

    it("returns ownership state for existing resource", async () => {
      await memDb.upsertEntity({ id: "alice", name: "Alice", role: "human" });
      await memDb.createResource({
        address: cidRef("bafytest123"),
        type: "image",
        locations: [],
        createdAt: "2025-01-15T10:00:00Z",
        createdBy: "alice",
        rootAction: "action-1",
      });
      await memDb.initOwnershipState("bafytest123", "alice");

      const res = await app.request("/resource/bafytest123/ownership");
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.resourceRef).toBe("bafytest123");
      expect(body.neverTransferred).toBe(true);
    });
  });

  describe("POST /resource/:cid/ownership/claim", () => {
    it("records an ownership claim and returns 201", async () => {
      // Pre-seed resource (claim does not require it to exist in some workflows)
      await memDb.upsertEntity({ id: "alice", name: "Alice", role: "human" });
      await memDb.createResource({
        address: cidRef("bafytest123"),
        type: "image",
        locations: [],
        createdAt: "2025-01-15T10:00:00Z",
        createdBy: "alice",
        rootAction: "action-1",
      });

      const res = await app.request("/resource/bafytest123/ownership/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: { id: "alice", role: "human" },
          evidenceType: "self-declaration",
          note: "I created this content",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.action).toBeDefined();
      // Action type uses ext namespace format set by the ownership service
      expect((body.action as Record<string, unknown>).type).toBe("ext:ownership:claim@1.0.0");
    });
  });

  describe("POST /resource/:cid/ownership/transfer", () => {
    it("transfers ownership to a new entity", async () => {
      await memDb.upsertEntity({ id: "alice", name: "Alice", role: "human" });
      await memDb.upsertEntity({ id: "bob", name: "Bob", role: "human" });
      await memDb.createResource({
        address: cidRef("bafytest123"),
        type: "image",
        locations: [],
        createdAt: "2025-01-15T10:00:00Z",
        createdBy: "alice",
        rootAction: "action-1",
      });
      await memDb.initOwnershipState("bafytest123", "alice");

      const res = await app.request("/resource/bafytest123/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performedBy: { id: "alice", role: "human" },
          toEntityId: "bob",
          transferType: "voluntary",
        }),
      });
      // Transfer handler returns 200 (not 201 — no new resource created)
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.action).toBeDefined();
      expect((body.action as Record<string, unknown>).type).toBe("ext:ownership:transfer@1.0.0");
    });
  });

  // ─── Unknown Routes ───────────────────────────────────────────────────────

  describe("unknown routes", () => {
    it("returns 404 for unknown GET route", async () => {
      const res = await app.request("/nonexistent-route");
      expect(res.status).toBe(404);
      const body = await res.json() as Record<string, unknown>;
      expect((body.error as Record<string, unknown>).code).toBe("NotFound");
    });

    it("returns 404 for unknown POST route", async () => {
      const res = await app.request("/nonexistent-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });
});
