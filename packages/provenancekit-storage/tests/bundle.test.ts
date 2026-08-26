import { beforeEach, describe, expect, it } from "vitest";
import { cidRef } from "@provenancekit/eaa-types";
import { MemoryDbStorage } from "../src/adapters/db/memory.js";
import { getBundle } from "../src/utils/bundle.js";

describe("getBundle attribution lineage", () => {
  let storage: MemoryDbStorage;

  beforeEach(async () => {
    storage = new MemoryDbStorage();
    await storage.initialize();
  });

  it("includes action-scoped attribution and its human entity", async () => {
    await storage.upsertEntity({ id: "agent:one", role: "ai" });
    await storage.upsertEntity({ id: "user:reviewer", role: "human" });
    await storage.createAction({
      id: "action:one",
      type: "transform",
      performedBy: "agent:one",
      timestamp: "2026-08-26T00:00:00.000Z",
      inputs: [],
      outputs: [cidRef("sha256:output")],
    });
    await storage.createResource({
      address: cidRef("sha256:output"),
      type: "text",
      locations: [],
      createdAt: "2026-08-26T00:00:00.000Z",
      createdBy: "agent:one",
      rootAction: "action:one",
    });
    await storage.createAttribution({
      id: "attribution:review",
      actionId: "action:one",
      entityId: "user:reviewer",
      role: "contributor",
      note: "Human approval",
    });

    const bundle = await getBundle(storage, "sha256:output");

    expect(bundle?.actions).toHaveLength(1);
    expect(bundle?.attributions).toEqual([
      expect.objectContaining({
        actionId: "action:one",
        entityId: "user:reviewer",
      }),
    ]);
    expect(bundle?.entities.map((entity) => entity.id)).toContain(
      "user:reviewer",
    );
  });
});
