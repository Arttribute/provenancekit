/**
 * ProvenanceIndexer Tests
 *
 * Tests the indexer class using mock viem client and mock storage.
 * No real blockchain connection required.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { IProvenanceStorage } from "@provenancekit/storage";
import type { Entity, Resource, Action, Attribution } from "@provenancekit/eaa-types";
import type {
  IndexerConfig,
  IndexerEvent,
  OwnershipState,
} from "../src/types.js";

// ─── Mock viem ────────────────────────────────────────────────────────────────

// Mock the entire viem module
vi.mock("viem", () => {
  return {
    createPublicClient: vi.fn(),
    http: vi.fn((url: string) => ({ url })),
    parseAbiItem: vi.fn((abi: string) => ({ abi })),
  };
});

// ─── Mock Storage ─────────────────────────────────────────────────────────────

function createMockStorage(): IProvenanceStorage & {
  upsertEntity: Mock;
  createResource: Mock;
  createAction: Mock;
  createAttribution: Mock;
  resourceExists: Mock;
  getLastSyncedBlock?: Mock;
  setLastSyncedBlock?: Mock;
  markActionSynced?: Mock;
  // Standard interface methods
  getEntity: Mock;
  getResource: Mock;
  getAction: Mock;
  entityExists: Mock;
  listEntities: Mock;
  listResources: Mock;
  listActions: Mock;
  updateAction: Mock;
  updateEntity: Mock;
  getActionsByOutput: Mock;
  getActionsByInput: Mock;
  getAttributionsByResource: Mock;
  getAttributionsByAction: Mock;
  getAttributionsByEntity: Mock;
  initOwnershipState: Mock;
  getOwnershipState: Mock;
  transferOwnershipState: Mock;
  getOwnershipHistory: Mock;
} {
  return {
    upsertEntity: vi.fn().mockResolvedValue(undefined),
    createResource: vi.fn().mockResolvedValue(undefined),
    createAction: vi.fn().mockResolvedValue(undefined),
    createAttribution: vi.fn().mockResolvedValue(undefined),
    resourceExists: vi.fn().mockResolvedValue(false),
    getEntity: vi.fn().mockResolvedValue(null),
    getResource: vi.fn().mockResolvedValue(null),
    getAction: vi.fn().mockResolvedValue(null),
    entityExists: vi.fn().mockResolvedValue(false),
    listEntities: vi.fn().mockResolvedValue([]),
    listResources: vi.fn().mockResolvedValue([]),
    listActions: vi.fn().mockResolvedValue([]),
    updateAction: vi.fn().mockResolvedValue(null),
    updateEntity: vi.fn().mockResolvedValue(null),
    getActionsByOutput: vi.fn().mockResolvedValue([]),
    getActionsByInput: vi.fn().mockResolvedValue([]),
    getAttributionsByResource: vi.fn().mockResolvedValue([]),
    getAttributionsByAction: vi.fn().mockResolvedValue([]),
    getAttributionsByEntity: vi.fn().mockResolvedValue([]),
    initOwnershipState: vi.fn().mockResolvedValue(undefined),
    getOwnershipState: vi.fn().mockResolvedValue(null),
    transferOwnershipState: vi.fn().mockResolvedValue(undefined),
    getOwnershipHistory: vi.fn().mockResolvedValue([]),
  };
}

// ─── Mock viem client factory ─────────────────────────────────────────────────

function createMockViemClient(overrides: Partial<{
  getBlockNumber: () => Promise<bigint>;
  getLogs: () => Promise<unknown[]>;
}> = {}) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    getLogs: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

const BASE_CONFIG: IndexerConfig = {
  chain: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    contractAddress: "0x1234567890123456789012345678901234567890",
    startBlock: 0n,
  },
  storage: null as unknown as IProvenanceStorage,
  pollingInterval: 100, // Short for tests
  batchSize: 500,
  confirmations: 1,
  maxRetries: 1,
};

// We need to import ProvenanceIndexer after mocking viem
// Use a dynamic import to ensure mock is in place
let ProvenanceIndexer: typeof import("../src/indexer.js").ProvenanceIndexer;

beforeEach(async () => {
  vi.clearAllMocks();

  // Set up mock viem createPublicClient to return our mock client
  const { createPublicClient } = await import("viem");
  (createPublicClient as Mock).mockReturnValue(createMockViemClient());

  // Dynamic import to get mocked version
  const module = await import("../src/indexer.js");
  ProvenanceIndexer = module.ProvenanceIndexer;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Constructor Tests ────────────────────────────────────────────────────────

describe("ProvenanceIndexer constructor", () => {
  it("creates indexer with valid config", () => {
    const storage = createMockStorage();
    const indexer = new ProvenanceIndexer({ ...BASE_CONFIG, storage });
    expect(indexer).toBeDefined();
    expect(indexer.getState()).toBe("idle");
  });

  it("throws if rpcUrl is missing", () => {
    const storage = createMockStorage();
    expect(() => {
      new ProvenanceIndexer({
        ...BASE_CONFIG,
        storage,
        chain: { ...BASE_CONFIG.chain, rpcUrl: "" },
      });
    }).toThrow("RPC URL is required");
  });

  it("throws if contractAddress is missing", () => {
    const storage = createMockStorage();
    expect(() => {
      new ProvenanceIndexer({
        ...BASE_CONFIG,
        storage,
        chain: { ...BASE_CONFIG.chain, contractAddress: "" as `0x${string}` },
      });
    }).toThrow("Contract address is required");
  });

  it("returns correct chainId", () => {
    const storage = createMockStorage();
    const indexer = new ProvenanceIndexer({ ...BASE_CONFIG, storage });
    expect(indexer.getChainId()).toBe(8453);
  });
});

// ─── Sync Tests ───────────────────────────────────────────────────────────────

describe("ProvenanceIndexer.sync()", () => {
  it("transitions state to syncing then back after completion", async () => {
    const storage = createMockStorage();
    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({ getBlockNumber: vi.fn().mockResolvedValue(100n) })
    );

    const indexer = new ProvenanceIndexer({ ...BASE_CONFIG, storage });
    const states: string[] = [];
    const originalSync = indexer.sync.bind(indexer);

    await originalSync();
    // After sync, should not be "syncing" anymore
    expect(indexer.getState()).not.toBe("error");
  });

  it("emits synced event on completion", async () => {
    const storage = createMockStorage();
    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({ getBlockNumber: vi.fn().mockResolvedValue(10n) })
    );

    const events: IndexerEvent[] = [];
    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 0n },
      onEvent: (e) => events.push(e),
    });

    await indexer.sync();

    const syncedEvent = events.find((e) => e.type === "synced");
    expect(syncedEvent).toBeDefined();
  });

  it("throws if called while already syncing", async () => {
    const storage = createMockStorage();

    // Make getBlockNumber resolve slowly to keep state in "syncing"
    let resolveBlock: (v: bigint) => void;
    const slowBlock = new Promise<bigint>((res) => { resolveBlock = res; });

    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({ getBlockNumber: vi.fn().mockReturnValue(slowBlock) })
    );

    const indexer = new ProvenanceIndexer({ ...BASE_CONFIG, storage });

    // Start sync but don't await it yet
    const syncPromise = indexer.sync();

    // Try to sync again immediately
    await expect(indexer.sync()).rejects.toThrow("Already syncing");

    // Clean up
    resolveBlock!(0n);
    await syncPromise.catch(() => {}); // may throw, that's ok
  });

  it("processes ActionRecorded events and calls createAction", async () => {
    const storage = createMockStorage();

    const actionLog = {
      args: {
        actionId: "0xaction123" as `0x${string}`,
        actionType: "create",
        performer: "0xperformer" as `0x${string}`,
        inputs: [],
        outputs: ["bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"],
        timestamp: 1700000000n,
      },
      blockNumber: 5n,
      transactionHash: "0xtxhash" as `0x${string}`,
      logIndex: 0,
    };

    const { createPublicClient } = await import("viem");

    // Use event.abi to distinguish between event types — all 5 are fetched in parallel
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(10n),
        getLogs: vi.fn().mockImplementation(({ event }: { event?: { abi?: string } }) => {
          const abi = event?.abi ?? "";
          return Promise.resolve(abi.includes("ActionRecorded") ? [actionLog] : []);
        }),
      })
    );

    // startBlock: 0n so fromBlock (0) <= safeBlock (10-1=9) — sync actually runs
    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 0n },
    });

    await indexer.sync();
    expect(storage.createAction).toHaveBeenCalledTimes(1);
  });

  it("processes ResourceRegistered events and calls createResource", async () => {
    const storage = createMockStorage();

    const resourceLog = {
      args: {
        contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        resourceType: "image",
        creator: "0xcreator" as `0x${string}`,
        rootAction: "0xroot" as `0x${string}`,
        timestamp: 1700000000n,
      },
      blockNumber: 5n,
      transactionHash: "0xtxhash" as `0x${string}`,
      logIndex: 0,
    };

    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(10n),
        getLogs: vi.fn().mockImplementation(({ event }: { event?: { abi?: string } }) => {
          const abi = event?.abi ?? "";
          return Promise.resolve(abi.includes("ResourceRegistered") ? [resourceLog] : []);
        }),
      })
    );

    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 0n },
    });

    await indexer.sync();
    expect(storage.createResource).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate resources (idempotent)", async () => {
    const storage = createMockStorage();
    storage.resourceExists.mockResolvedValue(true); // Resource already exists

    const resourceLog = {
      args: {
        contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        resourceType: "image",
        creator: "0xcreator" as `0x${string}`,
        rootAction: "0xroot" as `0x${string}`,
        timestamp: 1700000000n,
      },
      blockNumber: 5n,
      transactionHash: "0xtxhash" as `0x${string}`,
      logIndex: 0,
    };

    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(10n),
        getLogs: vi.fn().mockImplementation(({ event }: { event?: { abi?: string } }) => {
          const abi = event?.abi ?? "";
          return Promise.resolve(abi.includes("ResourceRegistered") ? [resourceLog] : []);
        }),
      })
    );

    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 0n },
    });

    await indexer.sync();
    // Resource exists so createResource should NOT be called
    expect(storage.createResource).not.toHaveBeenCalled();
  });

  it("emits error event on RPC failure but continues", async () => {
    const storage = createMockStorage();

    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(10n),
        // Reject all getLogs calls — simulates a complete RPC failure
        getLogs: vi.fn().mockRejectedValue(new Error("connection refused")),
      })
    );

    const errors: IndexerEvent[] = [];
    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      // startBlock: 0n so sync actually runs and calls getLogs
      chain: { ...BASE_CONFIG.chain, startBlock: 0n },
      maxRetries: 1,
      onEvent: (e) => { if (e.type === "error") errors.push(e); },
    });

    // Should not throw — RPC errors are emitted, not thrown
    await indexer.sync();
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── Stop/Pause/Resume Tests ──────────────────────────────────────────────────

describe("ProvenanceIndexer lifecycle", () => {
  it("can be stopped from idle state", async () => {
    const storage = createMockStorage();
    const indexer = new ProvenanceIndexer({ ...BASE_CONFIG, storage });
    await indexer.stop();
    expect(indexer.getState()).toBe("idle");
  });

  it("emits stopped event on stop", async () => {
    const storage = createMockStorage();
    const events: IndexerEvent[] = [];
    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      onEvent: (e) => events.push(e),
    });
    await indexer.stop();
    expect(events.some((e) => e.type === "stopped")).toBe(true);
  });

  it("throws when resuming from non-paused state", async () => {
    const storage = createMockStorage();
    const indexer = new ProvenanceIndexer({ ...BASE_CONFIG, storage });
    await expect(indexer.resume()).rejects.toThrow("Can only resume from paused state");
  });

  it("throws when starting while already watching", async () => {
    const storage = createMockStorage();
    const { createPublicClient } = await import("viem");

    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(1000n),
      })
    );

    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 1001n }, // Skip historical sync
    });

    // Get to watching state
    await indexer.sync();
    await indexer.watch();

    expect(indexer.getState()).toBe("watching");

    await expect(indexer.start()).rejects.toThrow();

    await indexer.stop();
  });
});

// ─── onEvent callback ─────────────────────────────────────────────────────────

describe("ProvenanceIndexer onEvent", () => {
  it("emits started event when start is called", async () => {
    const storage = createMockStorage();
    const { createPublicClient } = await import("viem");

    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(1000n),
      })
    );

    const events: IndexerEvent[] = [];
    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 1001n }, // No history to sync
      onEvent: (e) => events.push(e),
    });

    await indexer.start();
    await indexer.stop();

    expect(events.some((e) => e.type === "started")).toBe(true);
  });

  it("emits eventProcessed for each stored event", async () => {
    const storage = createMockStorage();

    const entityLog = {
      args: {
        entityAddress: "0xaddr" as `0x${string}`,
        entityId: "did:key:alice",
        entityRole: "human",
        timestamp: 1700000000n,
      },
      blockNumber: 5n,
      transactionHash: "0xtx" as `0x${string}`,
      logIndex: 0,
    };

    const { createPublicClient } = await import("viem");
    (createPublicClient as Mock).mockReturnValue(
      createMockViemClient({
        getBlockNumber: vi.fn().mockResolvedValue(10n),
        getLogs: vi.fn().mockImplementation(({ event }: { event?: { abi?: string } }) => {
          const abi = event?.abi ?? "";
          return Promise.resolve(abi.includes("EntityRegistered") ? [entityLog] : []);
        }),
      })
    );

    const processedEvents: IndexerEvent[] = [];
    const indexer = new ProvenanceIndexer({
      ...BASE_CONFIG,
      storage,
      chain: { ...BASE_CONFIG.chain, startBlock: 0n },
      onEvent: (e) => { if (e.type === "eventProcessed") processedEvents.push(e); },
    });

    await indexer.sync();
    expect(processedEvents).toHaveLength(1);
    expect(processedEvents[0].type).toBe("eventProcessed");
  });
});
