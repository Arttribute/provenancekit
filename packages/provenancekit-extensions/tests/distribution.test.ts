import { describe, it, expect } from "vitest";
import { cidRef, type Attribution } from "@arttribute/eaa-types";
import { withContrib } from "../src/contrib";
import { withPayment } from "../src/payment";
import {
  calculateDistribution,
  calculateActionDistribution,
  normalizeContributions,
  splitAmount,
  mergeDistributions,
} from "../src/distribution";

const createAttribution = (
  entityId: string,
  ref: string = "bafytest123"
): Attribution => ({
  resourceRef: cidRef(ref),
  entityId,
  role: "creator",
});

const createActionAttribution = (
  entityId: string,
  actionId: string
): Attribution => ({
  actionId,
  entityId,
  role: "contributor",
});

describe("distribution", () => {
  describe("calculateDistribution", () => {
    it("calculates distribution from attributions", () => {
      const resourceRef = cidRef("bafytest123");
      const attributions = [
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 3000 }),
        withContrib(createAttribution("carol"), { weight: 1000 }),
      ];

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.entries).toHaveLength(3);
      expect(dist.totalBps).toBe(10000);
      expect(dist.entries.find((e) => e.entityId === "alice")?.bps).toBe(6000);
      expect(dist.entries.find((e) => e.entityId === "bob")?.bps).toBe(3000);
      expect(dist.entries.find((e) => e.entityId === "carol")?.bps).toBe(1000);
    });

    it("normalizes when weights dont sum to 10000", () => {
      const resourceRef = cidRef("bafytest123");
      const attributions = [
        withContrib(createAttribution("alice"), { weight: 3 }),
        withContrib(createAttribution("bob"), { weight: 1 }),
      ];

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.totalBps).toBe(10000);
      expect(dist.entries.find((e) => e.entityId === "alice")?.bps).toBe(7500);
      expect(dist.entries.find((e) => e.entityId === "bob")?.bps).toBe(2500);
    });

    it("filters to relevant attributions", () => {
      const resourceRef = cidRef("bafytest123");
      const attributions = [
        withContrib(createAttribution("alice", "bafytest123"), { weight: 6000 }),
        withContrib(createAttribution("bob", "other-ref"), { weight: 4000 }),
      ];

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.entries).toHaveLength(1);
      expect(dist.entries[0].entityId).toBe("alice");
    });

    it("returns empty distribution for no attributions", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, []);

      expect(dist.entries).toHaveLength(0);
      expect(dist.totalBps).toBe(0);
    });

    it("returns empty for zero weights", () => {
      const resourceRef = cidRef("bafytest123");
      const attributions = [createAttribution("alice")]; // No contrib extension

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.entries).toHaveLength(0);
      expect(dist.totalBps).toBe(0);
    });

    it("includes payment data when available", () => {
      const resourceRef = cidRef("bafytest123");
      const attr = withPayment(
        withContrib(createAttribution("alice"), { weight: 10000 }),
        {
          recipient: { address: "0x123", chainId: 8453 },
          method: "superfluid",
        }
      );

      const dist = calculateDistribution(resourceRef, [attr]);

      expect(dist.entries[0].payment?.recipient.address).toBe("0x123");
      expect(dist.entries[0].payment?.method).toBe("superfluid");
    });
  });

  describe("calculateActionDistribution", () => {
    it("calculates distribution for action attributions", () => {
      const actionId = "action-123";
      const attributions = [
        withContrib(createActionAttribution("alice", actionId), {
          weight: 7000,
        }),
        withContrib(createActionAttribution("bob", actionId), { weight: 3000 }),
      ];

      const dist = calculateActionDistribution(actionId, attributions);

      expect(dist.actionId).toBe(actionId);
      expect(dist.entries).toHaveLength(2);
      expect(dist.totalBps).toBe(10000);
    });

    it("filters to relevant action", () => {
      const attributions = [
        withContrib(createActionAttribution("alice", "action-1"), {
          weight: 5000,
        }),
        withContrib(createActionAttribution("bob", "action-2"), {
          weight: 5000,
        }),
      ];

      const dist = calculateActionDistribution("action-1", attributions);

      expect(dist.entries).toHaveLength(1);
      expect(dist.entries[0].entityId).toBe("alice");
    });
  });

  describe("normalizeContributions", () => {
    it("normalizes weights to 10000", () => {
      const attributions = [
        withContrib(createAttribution("alice", "bafy"), { weight: 3 }),
        withContrib(createAttribution("bob", "bafy"), { weight: 1 }),
      ];

      const normalized = normalizeContributions(attributions);

      expect(normalized[0].extensions?.["ext:contrib@1.0.0"]).toEqual({
        weight: 7500,
        basis: "points",
      });
      expect(normalized[1].extensions?.["ext:contrib@1.0.0"]).toEqual({
        weight: 2500,
        basis: "points",
      });
    });

    it("returns unchanged if already 10000", () => {
      const attributions = [
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 4000 }),
      ];

      const normalized = normalizeContributions(attributions);

      expect(normalized).toEqual(attributions);
    });

    it("handles zero total", () => {
      const attributions = [createAttribution("alice")];
      const normalized = normalizeContributions(attributions);
      expect(normalized).toEqual(attributions);
    });
  });

  describe("splitAmount", () => {
    it("splits amount according to distribution", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 4000 }),
      ]);

      const amounts = splitAmount(1000n, dist);

      expect(amounts.get("alice")).toBe(600n);
      expect(amounts.get("bob")).toBe(400n);
    });

    it("handles large amounts", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 5000 }),
        withContrib(createAttribution("bob"), { weight: 5000 }),
      ]);

      const amounts = splitAmount(1000000000000000000n, dist); // 1 ETH in wei

      expect(amounts.get("alice")).toBe(500000000000000000n);
      expect(amounts.get("bob")).toBe(500000000000000000n);
    });
  });

  describe("mergeDistributions", () => {
    it("merges multiple distributions", () => {
      const dist1 = calculateDistribution(cidRef("bafy1"), [
        withContrib(createAttribution("alice", "bafy1"), { weight: 10000 }),
      ]);
      const dist2 = calculateDistribution(cidRef("bafy2"), [
        withContrib(createAttribution("alice", "bafy2"), { weight: 5000 }),
        withContrib(createAttribution("bob", "bafy2"), { weight: 5000 }),
      ]);

      const merged = mergeDistributions([dist1, dist2]);

      // Alice has 10000 + 5000 = 15000 out of 20000 total = 75%
      // Bob has 5000 out of 20000 = 25%
      expect(merged.find((e) => e.entityId === "alice")?.bps).toBe(7500);
      expect(merged.find((e) => e.entityId === "bob")?.bps).toBe(2500);
    });

    it("handles empty distributions", () => {
      const merged = mergeDistributions([]);
      expect(merged).toHaveLength(0);
    });
  });
});
