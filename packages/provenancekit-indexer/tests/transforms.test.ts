/**
 * Indexer Transforms Tests
 *
 * Unit tests for the blockchain event → EAA type transformation functions.
 * No external dependencies required — pure function tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseContentRef,
  transformActionRecorded,
  transformResourceRegistered,
  transformEntityRegistered,
  transformAttributionRecorded,
  transformActionAttributionRecorded,
  transformEvents,
} from "../src/transforms.js";
import type {
  ActionRecordedEvent,
  ResourceRegisteredEvent,
  EntityRegisteredEvent,
  AttributionRecordedEvent,
  ActionAttributionRecordedEvent,
} from "../src/types.js";

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const TX_HASH = "0xabc123def456" as `0x${string}`;
const PERFORMER = "0xdeadbeef" as `0x${string}`;
const CHAIN_ID = 8453; // Base
const BLOCK_NUMBER = 1000n;
const TIMESTAMP = 1700000000n; // Nov 2023
const LOG_INDEX = 0;

// ─── parseContentRef ─────────────────────────────────────────────────────────

describe("parseContentRef", () => {
  it("parses IPFS CIDv1 (bafyabc...) as cid scheme", () => {
    const ref = parseContentRef("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
    expect(ref.scheme).toBe("cid");
    expect(ref.ref).toBe("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
  });

  it("parses IPFS CIDv0 (Qm...) as cid scheme", () => {
    const ref = parseContentRef("QmYNmQKp6SuaVrpgWRsPTgCQCnpxUYGq76YEKBXuj2N4H6");
    expect(ref.scheme).toBe("cid");
  });

  it("parses Arweave ID as ar scheme", () => {
    const ref = parseContentRef("ar://abc123xyz");
    expect(ref.scheme).toBe("ar");
    expect(ref.ref).toBe("abc123xyz");
  });

  it("parses HTTPS URL as http scheme", () => {
    const ref = parseContentRef("https://example.com/file.png");
    expect(ref.scheme).toBe("http");
    expect(ref.ref).toBe("https://example.com/file.png");
  });

  it("parses HTTP URL as http scheme", () => {
    const ref = parseContentRef("http://example.com/file");
    expect(ref.scheme).toBe("http");
  });

  it("parses sha256 hash as hash scheme", () => {
    const ref = parseContentRef("sha256:abc123def456");
    expect(ref.scheme).toBe("hash");
    expect(ref.ref).toBe("sha256:abc123def456");
  });

  it("parses sha512 hash as hash scheme", () => {
    const ref = parseContentRef("sha512:abc123");
    expect(ref.scheme).toBe("hash");
  });

  it("defaults unknown string to cid scheme", () => {
    const ref = parseContentRef("some-arbitrary-string");
    expect(ref.scheme).toBe("cid");
  });

  it("does not treat ext: prefixes as hashes", () => {
    // ext:something should go to CID default, not hash
    const ref = parseContentRef("ext:custom:type");
    expect(ref.scheme).toBe("cid");
  });
});

// ─── transformActionRecorded ─────────────────────────────────────────────────

describe("transformActionRecorded", () => {
  const baseEvent: ActionRecordedEvent = {
    actionId: "0xaction123" as `0x${string}`,
    actionType: "create",
    performer: PERFORMER,
    inputs: [],
    outputs: ["bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"],
    timestamp: TIMESTAMP,
    blockNumber: BLOCK_NUMBER,
    transactionHash: TX_HASH,
    logIndex: LOG_INDEX,
  };

  it("transforms basic create action", () => {
    const action = transformActionRecorded(baseEvent, CHAIN_ID);
    expect(action.id).toBe("0xaction123");
    expect(action.type).toBe("create");
    expect(action.performedBy).toBe(PERFORMER);
  });

  it("converts unix timestamp to ISO 8601", () => {
    const action = transformActionRecorded(baseEvent, CHAIN_ID);
    // 1700000000 seconds → ISO string
    expect(action.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(action.timestamp).getTime()).toBe(Number(TIMESTAMP) * 1000);
  });

  it("parses output CIDs as ContentReference array", () => {
    const action = transformActionRecorded(baseEvent, CHAIN_ID);
    expect(action.outputs).toHaveLength(1);
    expect(action.outputs[0].scheme).toBe("cid");
  });

  it("sets proof to transaction hash", () => {
    const action = transformActionRecorded(baseEvent, CHAIN_ID);
    expect(action.proof).toBe(TX_HASH);
  });

  it("attaches ext:onchain@1.0.0 extension", () => {
    const action = transformActionRecorded(baseEvent, CHAIN_ID);
    expect(action.extensions?.["ext:onchain@1.0.0"]).toBeDefined();
    const onchain = action.extensions!["ext:onchain@1.0.0"] as Record<string, unknown>;
    expect(onchain.chainId).toBe(CHAIN_ID);
    expect(onchain.blockNumber).toBe(Number(BLOCK_NUMBER));
    expect(onchain.transactionHash).toBe(TX_HASH);
    expect(onchain.logIndex).toBe(LOG_INDEX);
  });

  it("handles multiple inputs and outputs", () => {
    const event: ActionRecordedEvent = {
      ...baseEvent,
      actionType: "aggregate",
      inputs: [
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        "ar://arweave-tx-id-123",
      ],
      outputs: ["sha256:abc123"],
    };
    const action = transformActionRecorded(event, CHAIN_ID);
    expect(action.inputs).toHaveLength(2);
    expect(action.inputs[0].scheme).toBe("cid");
    expect(action.inputs[1].scheme).toBe("ar");
    expect(action.outputs[0].scheme).toBe("hash");
  });

  it("normalizes core action types to lowercase", () => {
    const types = ["create", "transform", "aggregate", "verify"];
    for (const t of types) {
      const event: ActionRecordedEvent = { ...baseEvent, actionType: t };
      const action = transformActionRecorded(event, CHAIN_ID);
      expect(action.type).toBe(t);
    }
  });

  it("preserves ext: prefixed action types", () => {
    const event: ActionRecordedEvent = {
      ...baseEvent,
      actionType: "ext:ml:train",
    };
    const action = transformActionRecorded(event, CHAIN_ID);
    expect(action.type).toBe("ext:ml:train");
  });

  it("wraps unknown action types with ext:custom: prefix", () => {
    const event: ActionRecordedEvent = {
      ...baseEvent,
      actionType: "SomeUnknownAction",
    };
    const action = transformActionRecorded(event, CHAIN_ID);
    expect(action.type).toMatch(/^ext:custom:/);
  });
});

// ─── transformResourceRegistered ─────────────────────────────────────────────

describe("transformResourceRegistered", () => {
  const baseEvent: ResourceRegisteredEvent = {
    contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    resourceType: "image",
    creator: PERFORMER,
    rootAction: "0xrootaction" as `0x${string}`,
    timestamp: TIMESTAMP,
    blockNumber: BLOCK_NUMBER,
    transactionHash: TX_HASH,
    logIndex: LOG_INDEX,
  };

  it("parses content ref as CID address", () => {
    const resource = transformResourceRegistered(baseEvent, CHAIN_ID);
    expect(resource.address.scheme).toBe("cid");
    expect(resource.address.ref).toBe(baseEvent.contentRef);
  });

  it("maps resource type", () => {
    const resource = transformResourceRegistered(baseEvent, CHAIN_ID);
    expect(resource.type).toBe("image");
  });

  it("sets creator and rootAction", () => {
    const resource = transformResourceRegistered(baseEvent, CHAIN_ID);
    expect(resource.createdBy).toBe(PERFORMER);
    expect(resource.rootAction).toBe("0xrootaction");
  });

  it("has empty locations array (on-chain data has no storage hints)", () => {
    const resource = transformResourceRegistered(baseEvent, CHAIN_ID);
    expect(resource.locations).toEqual([]);
  });

  it("attaches ext:onchain@1.0.0 extension", () => {
    const resource = transformResourceRegistered(baseEvent, CHAIN_ID);
    expect(resource.extensions?.["ext:onchain@1.0.0"]).toBeDefined();
  });

  it("normalizes core resource types", () => {
    const types = ["text", "image", "audio", "video", "code", "dataset", "model", "other"];
    for (const t of types) {
      const event: ResourceRegisteredEvent = { ...baseEvent, resourceType: t };
      const resource = transformResourceRegistered(event, CHAIN_ID);
      expect(resource.type).toBe(t);
    }
  });

  it("wraps unknown resource types with ext:custom: prefix", () => {
    const event: ResourceRegisteredEvent = {
      ...baseEvent,
      resourceType: "CustomBlobType",
    };
    const resource = transformResourceRegistered(event, CHAIN_ID);
    expect(resource.type).toMatch(/^ext:custom:/);
  });

  it("handles Arweave content ref", () => {
    const event: ResourceRegisteredEvent = {
      ...baseEvent,
      contentRef: "ar://arweave-tx-id",
    };
    const resource = transformResourceRegistered(event, CHAIN_ID);
    expect(resource.address.scheme).toBe("ar");
    expect(resource.address.ref).toBe("arweave-tx-id");
  });
});

// ─── transformEntityRegistered ───────────────────────────────────────────────

describe("transformEntityRegistered", () => {
  const baseEvent: EntityRegisteredEvent = {
    entityAddress: PERFORMER,
    entityId: "did:key:alice",
    entityRole: "human",
    timestamp: TIMESTAMP,
    blockNumber: BLOCK_NUMBER,
    transactionHash: TX_HASH,
    logIndex: LOG_INDEX,
  };

  it("uses entityId when provided", () => {
    const entity = transformEntityRegistered(baseEvent, CHAIN_ID);
    expect(entity.id).toBe("did:key:alice");
  });

  it("falls back to entityAddress when entityId is empty", () => {
    const event: EntityRegisteredEvent = {
      ...baseEvent,
      entityId: "",
    };
    const entity = transformEntityRegistered(event, CHAIN_ID);
    expect(entity.id).toBe(PERFORMER);
  });

  it("normalizes core entity roles", () => {
    const roles = ["human", "ai", "organization"];
    for (const r of roles) {
      const event: EntityRegisteredEvent = { ...baseEvent, entityRole: r };
      const entity = transformEntityRegistered(event, CHAIN_ID);
      expect(entity.role).toBe(r);
    }
  });

  it("preserves ext: prefixed roles", () => {
    const event: EntityRegisteredEvent = {
      ...baseEvent,
      entityRole: "ext:dao:multisig",
    };
    const entity = transformEntityRegistered(event, CHAIN_ID);
    expect(entity.role).toBe("ext:dao:multisig");
  });

  it("stores wallet address in metadata", () => {
    const entity = transformEntityRegistered(baseEvent, CHAIN_ID);
    expect(entity.metadata?.walletAddress).toBe(PERFORMER);
  });

  it("attaches ext:onchain@1.0.0 with registeredAt", () => {
    const entity = transformEntityRegistered(baseEvent, CHAIN_ID);
    const onchain = entity.extensions?.["ext:onchain@1.0.0"] as Record<string, unknown>;
    expect(onchain.chainId).toBe(CHAIN_ID);
    expect(typeof onchain.registeredAt).toBe("string");
  });
});

// ─── transformAttributionRecorded ────────────────────────────────────────────

describe("transformAttributionRecorded", () => {
  const baseEvent: AttributionRecordedEvent = {
    contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    entityAddress: PERFORMER,
    role: "creator",
    timestamp: TIMESTAMP,
    blockNumber: BLOCK_NUMBER,
    transactionHash: TX_HASH,
    logIndex: LOG_INDEX,
  };

  it("sets resourceRef from contentRef", () => {
    const attribution = transformAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.resourceRef).toBeDefined();
    expect(attribution.resourceRef!.scheme).toBe("cid");
  });

  it("sets entityId from entityAddress", () => {
    const attribution = transformAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.entityId).toBe(PERFORMER);
  });

  it("normalizes core attribution roles", () => {
    const roles = ["creator", "contributor", "source"];
    for (const r of roles) {
      const event: AttributionRecordedEvent = { ...baseEvent, role: r };
      const attribution = transformAttributionRecorded(event, CHAIN_ID);
      expect(attribution.role).toBe(r);
    }
  });

  it("preserves ext: prefixed roles", () => {
    const event: AttributionRecordedEvent = {
      ...baseEvent,
      role: "ext:media:editor",
    };
    const attribution = transformAttributionRecorded(event, CHAIN_ID);
    expect(attribution.role).toBe("ext:media:editor");
  });

  it("wraps unknown roles with ext:custom:", () => {
    const event: AttributionRecordedEvent = { ...baseEvent, role: "Reviewer" };
    const attribution = transformAttributionRecorded(event, CHAIN_ID);
    expect(attribution.role).toMatch(/^ext:custom:/);
  });

  it("attaches ext:onchain@1.0.0 with recordedAt", () => {
    const attribution = transformAttributionRecorded(baseEvent, CHAIN_ID);
    const onchain = attribution.extensions?.["ext:onchain@1.0.0"] as Record<string, unknown>;
    expect(onchain.chainId).toBe(CHAIN_ID);
    expect(typeof onchain.recordedAt).toBe("string");
  });

  it("does not have actionId (resource-level attribution)", () => {
    const attribution = transformAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.actionId).toBeUndefined();
  });
});

// ─── transformActionAttributionRecorded ──────────────────────────────────────

describe("transformActionAttributionRecorded", () => {
  const baseEvent: ActionAttributionRecordedEvent = {
    actionId: "0xaction456" as `0x${string}`,
    entityAddress: PERFORMER,
    role: "contributor",
    timestamp: TIMESTAMP,
    blockNumber: BLOCK_NUMBER,
    transactionHash: TX_HASH,
    logIndex: LOG_INDEX,
  };

  it("sets actionId (action-level attribution)", () => {
    const attribution = transformActionAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.actionId).toBe("0xaction456");
  });

  it("does not have resourceRef (action-level attribution)", () => {
    const attribution = transformActionAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.resourceRef).toBeUndefined();
  });

  it("sets entityId from entityAddress", () => {
    const attribution = transformActionAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.entityId).toBe(PERFORMER);
  });

  it("attaches ext:onchain@1.0.0 extension", () => {
    const attribution = transformActionAttributionRecorded(baseEvent, CHAIN_ID);
    expect(attribution.extensions?.["ext:onchain@1.0.0"]).toBeDefined();
  });
});

// ─── transformEvents (batch) ──────────────────────────────────────────────────

describe("transformEvents", () => {
  it("routes ActionRecorded events to actions array", () => {
    const events = [
      {
        type: "ActionRecorded" as const,
        data: {
          actionId: "0xabc" as `0x${string}`,
          actionType: "create",
          performer: PERFORMER,
          inputs: [],
          outputs: [],
          timestamp: TIMESTAMP,
          blockNumber: BLOCK_NUMBER,
          transactionHash: TX_HASH,
          logIndex: 0,
        },
      },
    ];
    const result = transformEvents(events, CHAIN_ID);
    expect(result.actions).toHaveLength(1);
    expect(result.resources).toHaveLength(0);
    expect(result.entities).toHaveLength(0);
    expect(result.attributions).toHaveLength(0);
  });

  it("routes ResourceRegistered events to resources array", () => {
    const events = [
      {
        type: "ResourceRegistered" as const,
        data: {
          contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          resourceType: "image",
          creator: PERFORMER,
          rootAction: "0xroot" as `0x${string}`,
          timestamp: TIMESTAMP,
          blockNumber: BLOCK_NUMBER,
          transactionHash: TX_HASH,
          logIndex: 1,
        },
      },
    ];
    const result = transformEvents(events, CHAIN_ID);
    expect(result.resources).toHaveLength(1);
    expect(result.actions).toHaveLength(0);
  });

  it("routes EntityRegistered events to entities array", () => {
    const events = [
      {
        type: "EntityRegistered" as const,
        data: {
          entityAddress: PERFORMER,
          entityId: "did:key:test",
          entityRole: "human",
          timestamp: TIMESTAMP,
          blockNumber: BLOCK_NUMBER,
          transactionHash: TX_HASH,
          logIndex: 2,
        },
      },
    ];
    const result = transformEvents(events, CHAIN_ID);
    expect(result.entities).toHaveLength(1);
  });

  it("routes both AttributionRecorded and ActionAttributionRecorded to attributions", () => {
    const events = [
      {
        type: "AttributionRecorded" as const,
        data: {
          contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          entityAddress: PERFORMER,
          role: "creator",
          timestamp: TIMESTAMP,
          blockNumber: BLOCK_NUMBER,
          transactionHash: TX_HASH,
          logIndex: 0,
        },
      },
      {
        type: "ActionAttributionRecorded" as const,
        data: {
          actionId: "0xaction" as `0x${string}`,
          entityAddress: PERFORMER,
          role: "contributor",
          timestamp: TIMESTAMP,
          blockNumber: BLOCK_NUMBER,
          transactionHash: TX_HASH,
          logIndex: 1,
        },
      },
    ];
    const result = transformEvents(events, CHAIN_ID);
    expect(result.attributions).toHaveLength(2);
  });

  it("handles mixed event batch correctly", () => {
    const actionEvent = {
      type: "ActionRecorded" as const,
      data: {
        actionId: "0xact" as `0x${string}`,
        actionType: "create",
        performer: PERFORMER,
        inputs: [],
        outputs: ["bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"],
        timestamp: TIMESTAMP,
        blockNumber: BLOCK_NUMBER,
        transactionHash: TX_HASH,
        logIndex: 0,
      },
    };
    const resourceEvent = {
      type: "ResourceRegistered" as const,
      data: {
        contentRef: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        resourceType: "image",
        creator: PERFORMER,
        rootAction: "0xact" as `0x${string}`,
        timestamp: TIMESTAMP,
        blockNumber: BLOCK_NUMBER,
        transactionHash: TX_HASH,
        logIndex: 1,
      },
    };
    const entityEvent = {
      type: "EntityRegistered" as const,
      data: {
        entityAddress: PERFORMER,
        entityId: "",
        entityRole: "human",
        timestamp: TIMESTAMP,
        blockNumber: BLOCK_NUMBER,
        transactionHash: TX_HASH,
        logIndex: 2,
      },
    };

    const result = transformEvents([actionEvent, resourceEvent, entityEvent], CHAIN_ID);
    expect(result.actions).toHaveLength(1);
    expect(result.resources).toHaveLength(1);
    expect(result.entities).toHaveLength(1);
    expect(result.attributions).toHaveLength(0);
  });

  it("returns empty arrays for empty input", () => {
    const result = transformEvents([], CHAIN_ID);
    expect(result.actions).toHaveLength(0);
    expect(result.resources).toHaveLength(0);
    expect(result.entities).toHaveLength(0);
    expect(result.attributions).toHaveLength(0);
  });
});
