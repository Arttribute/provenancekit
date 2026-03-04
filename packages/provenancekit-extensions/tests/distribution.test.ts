import { describe, it, expect } from "vitest";
import { cidRef, type Attribution } from "@provenancekit/eaa-types";
import { withContrib } from "../src/contrib";
import { withPayment } from "../src/payment";
import {
  calculateDistribution,
  calculateActionDistribution,
  normalizeContributions,
  splitAmount,
  splitAmountSimple,
  mergeDistributions,
  validateDistribution,
  formatDistribution,
  emptyDistribution,
  DistributionError,
  BPS_TOTAL,
  type Distribution,
} from "../src/distribution";
import { getContribBps } from "../src/contrib";

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

      // Verify metadata is present
      expect(dist.metadata).toBeDefined();
      expect(dist.metadata.algorithmVersion).toBe("largest-remainder-v1");
      expect(dist.metadata.attributionsProcessed).toBe(3);
      expect(dist.metadata.normalized).toBe(false);
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
      expect(dist.metadata.normalized).toBe(true);
      expect(dist.metadata.originalTotal).toBe(4);
    });

    it("uses Largest Remainder Method for fair rounding", () => {
      const resourceRef = cidRef("bafytest123");
      // 3 participants with equal weight = 33.33% each
      // Largest Remainder should give 3334, 3333, 3333
      const attributions = [
        withContrib(createAttribution("alice"), { weight: 1 }),
        withContrib(createAttribution("bob"), { weight: 1 }),
        withContrib(createAttribution("carol"), { weight: 1 }),
      ];

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.totalBps).toBe(10000);

      // All should get 3333 or 3334, not all error to first entry
      const alice = dist.entries.find((e) => e.entityId === "alice")?.bps ?? 0;
      const bob = dist.entries.find((e) => e.entityId === "bob")?.bps ?? 0;
      const carol = dist.entries.find((e) => e.entityId === "carol")?.bps ?? 0;

      // Each should be either 3333 or 3334
      expect(alice).toBeGreaterThanOrEqual(3333);
      expect(alice).toBeLessThanOrEqual(3334);
      expect(bob).toBeGreaterThanOrEqual(3333);
      expect(bob).toBeLessThanOrEqual(3334);
      expect(carol).toBeGreaterThanOrEqual(3333);
      expect(carol).toBeLessThanOrEqual(3334);

      // Total must be exactly 10000
      expect(alice + bob + carol).toBe(10000);
    });

    it("handles many participants with fair rounding", () => {
      const resourceRef = cidRef("bafytest123");
      // 7 participants with equal weight = 14.2857...% each
      // Should distribute 1428 or 1429 to each, not give all error to first
      const attributions = Array.from({ length: 7 }, (_, i) =>
        withContrib(createAttribution(`entity${i}`), { weight: 1 })
      );

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.totalBps).toBe(10000);
      expect(dist.entries).toHaveLength(7);

      // Each should be 1428 or 1429
      for (const entry of dist.entries) {
        expect(entry.bps).toBeGreaterThanOrEqual(1428);
        expect(entry.bps).toBeLessThanOrEqual(1429);
      }

      // Exactly 2 should have 1429 (10000 - 7*1428 = 4)
      const countWith1429 = dist.entries.filter((e) => e.bps === 1429).length;
      const countWith1428 = dist.entries.filter((e) => e.bps === 1428).length;
      expect(countWith1429).toBe(4); // 10000 mod 7 = 4 entries get +1
      expect(countWith1428).toBe(3);
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
      expect(dist.metadata.attributionsFiltered).toBe(1);
    });

    it("returns empty distribution for no attributions", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, []);

      expect(dist.entries).toHaveLength(0);
      expect(dist.totalBps).toBe(0);
      expect(dist.metadata.attributionsProcessed).toBe(0);
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

    it("aggregates duplicate entity IDs by summing weights", () => {
      const resourceRef = cidRef("bafytest123");
      const attributions = [
        withContrib(createAttribution("alice"), { weight: 3000 }),
        withContrib(createAttribution("bob"), { weight: 4000 }),
        withContrib(createAttribution("alice"), { weight: 3000 }), // Duplicate
      ];

      const dist = calculateDistribution(resourceRef, attributions);

      // Alice should have 6000 (3000 + 3000)
      expect(dist.entries).toHaveLength(2);
      expect(dist.entries.find((e) => e.entityId === "alice")?.bps).toBe(6000);
      expect(dist.entries.find((e) => e.entityId === "bob")?.bps).toBe(4000);
    });

    it("validates negative weight at withContrib level (Zod validation)", () => {
      // Note: withContrib uses Zod which validates before calculateDistribution runs
      expect(() =>
        withContrib(createAttribution("alice"), { weight: -100 })
      ).toThrow();
    });

    it("validates NaN weight at withContrib level (Zod validation)", () => {
      // Note: withContrib uses Zod which validates before calculateDistribution runs
      expect(() =>
        withContrib(createAttribution("alice"), { weight: NaN })
      ).toThrow();
    });

    it("throws DistributionError on Infinity weight", () => {
      // Zod accepts Infinity, but distribution module validates it
      const resourceRef = cidRef("bafytest123");
      const attributions = [
        withContrib(createAttribution("alice"), { weight: Infinity }),
      ];

      expect(() => calculateDistribution(resourceRef, attributions)).toThrow(
        DistributionError
      );
    });

    it("sorts entries by bps descending", () => {
      const resourceRef = cidRef("bafytest123");
      const attributions = [
        withContrib(createAttribution("carol"), { weight: 1000 }),
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 3000 }),
      ];

      const dist = calculateDistribution(resourceRef, attributions);

      expect(dist.entries[0].entityId).toBe("alice");
      expect(dist.entries[1].entityId).toBe("bob");
      expect(dist.entries[2].entityId).toBe("carol");
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
      expect(dist.metadata).toBeDefined();
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

    it("aggregates duplicates for same action", () => {
      const actionId = "action-123";
      const attributions = [
        withContrib(createActionAttribution("alice", actionId), { weight: 3000 }),
        withContrib(createActionAttribution("alice", actionId), { weight: 2000 }),
        withContrib(createActionAttribution("bob", actionId), { weight: 5000 }),
      ];

      const dist = calculateActionDistribution(actionId, attributions);

      expect(dist.entries).toHaveLength(2);
      expect(dist.entries.find((e) => e.entityId === "alice")?.bps).toBe(5000);
      expect(dist.entries.find((e) => e.entityId === "bob")?.bps).toBe(5000);
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

    it("uses Largest Remainder Method for fair normalization", () => {
      // 3 equal weights should normalize to 3333, 3333, 3334 (or similar)
      const attributions = [
        withContrib(createAttribution("a", "ref"), { weight: 1 }),
        withContrib(createAttribution("b", "ref"), { weight: 1 }),
        withContrib(createAttribution("c", "ref"), { weight: 1 }),
      ];

      const normalized = normalizeContributions(attributions);

      const weights = normalized.map((a) => getContribBps(a));
      const total = weights.reduce((a, b) => a + b, 0);

      expect(total).toBe(10000);
      // Each should be 3333 or 3334
      for (const w of weights) {
        expect(w).toBeGreaterThanOrEqual(3333);
        expect(w).toBeLessThanOrEqual(3334);
      }
    });

    it("validates negative weight at withContrib level (Zod validation)", () => {
      // Note: withContrib uses Zod which validates before normalizeContributions runs
      expect(() =>
        withContrib(createAttribution("alice"), { weight: -100 })
      ).toThrow();
    });
  });

  describe("splitAmount", () => {
    it("splits amount according to distribution", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 4000 }),
      ]);

      const result = splitAmount(1000n, dist);

      expect(result.shares.get("alice")).toBe(600n);
      expect(result.shares.get("bob")).toBe(400n);
      expect(result.dust).toBe(0n);
      expect(result.distributed).toBe(1000n);
      expect(result.originalAmount).toBe(1000n);
    });

    it("handles large amounts", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 5000 }),
        withContrib(createAttribution("bob"), { weight: 5000 }),
      ]);

      const result = splitAmount(1000000000000000000n, dist); // 1 ETH in wei

      expect(result.shares.get("alice")).toBe(500000000000000000n);
      expect(result.shares.get("bob")).toBe(500000000000000000n);
      expect(result.dust).toBe(0n);
    });

    it("returns dust separately", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 1 }),
        withContrib(createAttribution("bob"), { weight: 1 }),
        withContrib(createAttribution("carol"), { weight: 1 }),
      ]);

      // 100 wei / 3 = 33.33... each
      // With Largest Remainder: 34 + 33 + 33 = 100 (no dust)
      const result = splitAmount(100n, dist);

      expect(result.distributed).toBe(100n);
      expect(result.dust).toBe(0n);

      // Verify total matches
      let total = 0n;
      for (const amount of result.shares.values()) {
        total += amount;
      }
      expect(total).toBe(100n);
    });

    it("uses Largest Remainder for bigint splitting", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 1 }),
        withContrib(createAttribution("bob"), { weight: 1 }),
        withContrib(createAttribution("carol"), { weight: 1 }),
      ]);

      const result = splitAmount(10n, dist);

      // 10 / 3 = 3.33... each
      // With Largest Remainder: some get 4, others get 3
      const alice = result.shares.get("alice") ?? 0n;
      const bob = result.shares.get("bob") ?? 0n;
      const carol = result.shares.get("carol") ?? 0n;

      // Each should be 3 or 4
      expect(alice).toBeGreaterThanOrEqual(3n);
      expect(alice).toBeLessThanOrEqual(4n);
      expect(bob).toBeGreaterThanOrEqual(3n);
      expect(bob).toBeLessThanOrEqual(4n);
      expect(carol).toBeGreaterThanOrEqual(3n);
      expect(carol).toBeLessThanOrEqual(4n);

      // Total must be exactly 10
      expect(alice + bob + carol).toBe(10n);
      expect(result.dust).toBe(0n);
    });

    it("throws on negative amount", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 10000 }),
      ]);

      expect(() => splitAmount(-100n, dist)).toThrow(DistributionError);
      expect(() => splitAmount(-100n, dist)).toThrow(/cannot be negative/);
    });

    it("throws on invalid distribution (totalBps != 10000)", () => {
      const invalidDist: Distribution = {
        resourceRef: cidRef("test"),
        entries: [{ entityId: "alice", bps: 5000 }],
        totalBps: 5000, // Invalid!
        metadata: {
          attributionsProcessed: 1,
          attributionsFiltered: 0,
          normalized: false,
          roundingAdjustments: new Map(),
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "test",
        },
      };

      expect(() => splitAmount(1000n, invalidDist)).toThrow(DistributionError);
      expect(() => splitAmount(1000n, invalidDist)).toThrow(/totalBps must be 10000/);
    });

    it("handles zero amount", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 10000 }),
      ]);

      const result = splitAmount(0n, dist);

      expect(result.shares.get("alice")).toBe(0n);
      expect(result.dust).toBe(0n);
      expect(result.distributed).toBe(0n);
    });

    it("handles empty distribution", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, []);

      const result = splitAmount(1000n, dist);

      expect(result.shares.size).toBe(0);
      // When nothing is distributed, full amount remains as dust
      expect(result.dust).toBe(1000n);
      expect(result.distributed).toBe(0n);
    });
  });

  describe("splitAmountSimple", () => {
    it("returns just the shares map (deprecated API)", () => {
      const resourceRef = cidRef("bafytest123");
      const dist = calculateDistribution(resourceRef, [
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 4000 }),
      ]);

      const amounts = splitAmountSimple(1000n, dist);

      expect(amounts).toBeInstanceOf(Map);
      expect(amounts.get("alice")).toBe(600n);
      expect(amounts.get("bob")).toBe(400n);
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

    it("uses Largest Remainder for fair merging", () => {
      // Create 3 equal distributions
      const dist1 = calculateDistribution(cidRef("bafy1"), [
        withContrib(createAttribution("alice", "bafy1"), { weight: 10000 }),
      ]);
      const dist2 = calculateDistribution(cidRef("bafy2"), [
        withContrib(createAttribution("bob", "bafy2"), { weight: 10000 }),
      ]);
      const dist3 = calculateDistribution(cidRef("bafy3"), [
        withContrib(createAttribution("carol", "bafy3"), { weight: 10000 }),
      ]);

      const merged = mergeDistributions([dist1, dist2, dist3]);

      // Each should have 3333 or 3334
      const total = merged.reduce((sum, e) => sum + e.bps, 0);
      expect(total).toBe(10000);

      for (const entry of merged) {
        expect(entry.bps).toBeGreaterThanOrEqual(3333);
        expect(entry.bps).toBeLessThanOrEqual(3334);
      }
    });
  });

  describe("validateDistribution", () => {
    it("validates a correct distribution", () => {
      const dist = calculateDistribution(cidRef("test"), [
        withContrib(createAttribution("alice"), { weight: 6000 }),
        withContrib(createAttribution("bob"), { weight: 4000 }),
      ]);

      expect(validateDistribution(dist)).toBe(true);
    });

    it("validates empty distribution", () => {
      const dist = emptyDistribution(cidRef("test"));
      expect(validateDistribution(dist)).toBe(true);
    });

    it("throws on duplicate entity IDs", () => {
      const invalidDist: Distribution = {
        resourceRef: cidRef("test"),
        entries: [
          { entityId: "alice", bps: 5000 },
          { entityId: "alice", bps: 5000 }, // Duplicate
        ],
        totalBps: 10000,
        metadata: {
          attributionsProcessed: 2,
          attributionsFiltered: 0,
          normalized: false,
          roundingAdjustments: new Map(),
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "test",
        },
      };

      expect(() => validateDistribution(invalidDist)).toThrow(DistributionError);
      expect(() => validateDistribution(invalidDist)).toThrow(/Duplicate entity ID/);
    });

    it("throws on non-integer bps", () => {
      const invalidDist: Distribution = {
        resourceRef: cidRef("test"),
        entries: [{ entityId: "alice", bps: 5000.5 }],
        totalBps: 5000.5,
        metadata: {
          attributionsProcessed: 1,
          attributionsFiltered: 0,
          normalized: false,
          roundingAdjustments: new Map(),
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "test",
        },
      };

      expect(() => validateDistribution(invalidDist)).toThrow(DistributionError);
      expect(() => validateDistribution(invalidDist)).toThrow(/Non-integer bps/);
    });

    it("throws on negative bps", () => {
      const invalidDist: Distribution = {
        resourceRef: cidRef("test"),
        entries: [
          { entityId: "alice", bps: 12000 },
          { entityId: "bob", bps: -2000 }, // Negative
        ],
        totalBps: 10000,
        metadata: {
          attributionsProcessed: 2,
          attributionsFiltered: 0,
          normalized: false,
          roundingAdjustments: new Map(),
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "test",
        },
      };

      expect(() => validateDistribution(invalidDist)).toThrow(DistributionError);
      expect(() => validateDistribution(invalidDist)).toThrow(/Negative bps/);
    });

    it("throws when total != 10000", () => {
      const invalidDist: Distribution = {
        resourceRef: cidRef("test"),
        entries: [{ entityId: "alice", bps: 5000 }],
        totalBps: 5000,
        metadata: {
          attributionsProcessed: 1,
          attributionsFiltered: 0,
          normalized: false,
          roundingAdjustments: new Map(),
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "test",
        },
      };

      expect(() => validateDistribution(invalidDist)).toThrow(DistributionError);
      expect(() => validateDistribution(invalidDist)).toThrow(/total is 5000, expected 10000/);
    });

    it("throws when totalBps doesn't match sum", () => {
      const invalidDist: Distribution = {
        resourceRef: cidRef("test"),
        entries: [
          { entityId: "alice", bps: 6000 },
          { entityId: "bob", bps: 4000 },
        ],
        totalBps: 9000, // Wrong!
        metadata: {
          attributionsProcessed: 2,
          attributionsFiltered: 0,
          normalized: false,
          roundingAdjustments: new Map(),
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "test",
        },
      };

      expect(() => validateDistribution(invalidDist)).toThrow(DistributionError);
      expect(() => validateDistribution(invalidDist)).toThrow(/doesn't match sum/);
    });
  });

  describe("formatDistribution", () => {
    it("formats distribution as readable string", () => {
      const dist = calculateDistribution(cidRef("bafytest"), [
        withContrib(createAttribution("alice", "bafytest"), { weight: 6000 }),
        withContrib(createAttribution("bob", "bafytest"), { weight: 4000 }),
      ]);

      const formatted = formatDistribution(dist);

      expect(formatted).toContain("bafytest");
      expect(formatted).toContain("10000 bps");
      expect(formatted).toContain("alice");
      expect(formatted).toContain("6000 bps");
      expect(formatted).toContain("60.00%");
      expect(formatted).toContain("bob");
      expect(formatted).toContain("4000 bps");
      expect(formatted).toContain("40.00%");
    });

    it("shows rounding adjustments when present", () => {
      const dist = calculateDistribution(cidRef("bafytest"), [
        withContrib(createAttribution("a", "bafytest"), { weight: 1 }),
        withContrib(createAttribution("b", "bafytest"), { weight: 1 }),
        withContrib(createAttribution("c", "bafytest"), { weight: 1 }),
      ]);

      const formatted = formatDistribution(dist);

      expect(formatted).toContain("Rounding adjustments");
    });
  });

  describe("emptyDistribution", () => {
    it("creates empty distribution for a resource", () => {
      const ref = cidRef("bafytest");
      const dist = emptyDistribution(ref);

      expect(dist.resourceRef).toBe(ref);
      expect(dist.entries).toHaveLength(0);
      expect(dist.totalBps).toBe(0);
      expect(dist.metadata).toBeDefined();
      expect(dist.metadata.attributionsProcessed).toBe(0);
    });
  });

  describe("DistributionError", () => {
    it("has correct name and code", () => {
      const error = new DistributionError(
        "Test error",
        "INVALID_WEIGHT",
        { entityId: "test" }
      );

      expect(error.name).toBe("DistributionError");
      expect(error.code).toBe("INVALID_WEIGHT");
      expect(error.details?.entityId).toBe("test");
      expect(error.message).toBe("Test error");
    });

    it("is instanceof Error", () => {
      const error = new DistributionError("Test", "INVALID_WEIGHT");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DistributionError);
    });
  });

  describe("BPS_TOTAL constant", () => {
    it("equals 10000", () => {
      expect(BPS_TOTAL).toBe(10000);
    });
  });

  describe("edge cases", () => {
    it("handles single participant", () => {
      const dist = calculateDistribution(cidRef("test"), [
        withContrib(createAttribution("alice", "test"), { weight: 5000 }),
      ]);

      expect(dist.entries).toHaveLength(1);
      expect(dist.entries[0].bps).toBe(10000);
      expect(dist.totalBps).toBe(10000);
    });

    it("handles very small weights", () => {
      const dist = calculateDistribution(cidRef("test"), [
        withContrib(createAttribution("alice", "test"), { weight: 1 }),
        withContrib(createAttribution("bob", "test"), { weight: 9999 }),
      ]);

      expect(dist.entries.find((e) => e.entityId === "alice")?.bps).toBe(1);
      expect(dist.entries.find((e) => e.entityId === "bob")?.bps).toBe(9999);
      expect(dist.totalBps).toBe(10000);
    });

    it("handles 100 participants", () => {
      const attributions = Array.from({ length: 100 }, (_, i) =>
        withContrib(createAttribution(`entity${i}`, "test"), { weight: 1 })
      );

      const dist = calculateDistribution(cidRef("test"), attributions);

      expect(dist.entries).toHaveLength(100);
      expect(dist.totalBps).toBe(10000);

      // Each should get exactly 100 bps
      for (const entry of dist.entries) {
        expect(entry.bps).toBe(100);
      }
    });

    it("handles splitting 1 wei", () => {
      const dist = calculateDistribution(cidRef("test"), [
        withContrib(createAttribution("alice", "test"), { weight: 5000 }),
        withContrib(createAttribution("bob", "test"), { weight: 5000 }),
      ]);

      const result = splitAmount(1n, dist);

      // One person gets 1, other gets 0
      const total = (result.shares.get("alice") ?? 0n) + (result.shares.get("bob") ?? 0n);
      expect(total).toBe(1n);
      expect(result.dust).toBe(0n);
    });

    it("splitting preserves total with many participants", () => {
      const participants = 17; // Prime number for interesting remainder
      const attributions = Array.from({ length: participants }, (_, i) =>
        withContrib(createAttribution(`entity${i}`, "test"), { weight: 1 })
      );

      const dist = calculateDistribution(cidRef("test"), attributions);
      const amount = 1000000n; // 1 million

      const result = splitAmount(amount, dist);

      let total = 0n;
      for (const share of result.shares.values()) {
        total += share;
      }

      expect(total + result.dust).toBe(amount);
      expect(total).toBe(result.distributed);
    });
  });
});
