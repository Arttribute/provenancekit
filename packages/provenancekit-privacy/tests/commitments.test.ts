/**
 * Tests for Pedersen commitment module
 */

import { describe, it, expect } from "vitest";
import {
  // Core functions
  generateBlinding,
  commit,
  verify,

  // Homomorphic operations
  addCommitments,
  subtractCommitments,
  sumCommitments,
  sumBlindings,

  // Weight helpers
  commitContributionWeights,
  verifyWeightSum,
  verifyWeightOpening,

  // Serialization
  serializeCommitment,
  deserializeCommitment,
  serializeWeightOpening,
  deserializeWeightOpening,

  // Contract integration
  commitmentToBytes,
  commitmentFromBytes,
  commitmentHash,
} from "../src/commitments.js";

describe("Pedersen Commitments", () => {
  describe("generateBlinding", () => {
    it("should generate random blinding factor", () => {
      const b1 = generateBlinding();
      const b2 = generateBlinding();

      expect(typeof b1).toBe("bigint");
      expect(typeof b2).toBe("bigint");
      expect(b1).not.toBe(b2);
    });

    it("should generate positive blinding factors", () => {
      for (let i = 0; i < 10; i++) {
        const b = generateBlinding();
        expect(b >= 0n).toBe(true);
      }
    });
  });

  describe("commit", () => {
    it("should create commitment with random blinding", () => {
      const result = commit(100n);

      expect(result.commitment).toBeDefined();
      expect(result.commitment.x).toBeDefined();
      expect(result.commitment.y).toBeDefined();
      expect(result.commitment.compressed).toBeDefined();
      expect(typeof result.blinding).toBe("bigint");
      expect(result.value).toBe(100n);
    });

    it("should create commitment with provided blinding", () => {
      const blinding = generateBlinding();
      const result = commit(100n, blinding);

      expect(result.blinding).toBe(blinding);
      expect(result.value).toBe(100n);
    });

    it("should create different commitments for same value", () => {
      const c1 = commit(100n);
      const c2 = commit(100n);

      expect(c1.commitment.compressed).not.toBe(c2.commitment.compressed);
    });

    it("should create same commitment with same value and blinding", () => {
      const blinding = generateBlinding();
      const c1 = commit(100n, blinding);
      const c2 = commit(100n, blinding);

      expect(c1.commitment.compressed).toBe(c2.commitment.compressed);
    });

    it("should handle zero value", () => {
      const result = commit(0n);

      expect(result.commitment).toBeDefined();
      expect(result.value).toBe(0n);
    });

    it("should handle large values", () => {
      const largeValue = 2n ** 128n;
      const result = commit(largeValue);

      expect(result.value).toBe(largeValue);
    });
  });

  describe("verify", () => {
    it("should verify valid commitment opening", () => {
      const result = commit(6000n);

      const valid = verify(result.commitment, result.value, result.blinding);

      expect(valid).toBe(true);
    });

    it("should reject wrong value", () => {
      const result = commit(6000n);

      const invalid = verify(result.commitment, 5000n, result.blinding);

      expect(invalid).toBe(false);
    });

    it("should reject wrong blinding", () => {
      const result = commit(6000n);
      const wrongBlinding = generateBlinding();

      const invalid = verify(result.commitment, result.value, wrongBlinding);

      expect(invalid).toBe(false);
    });

    it("should verify zero value commitment", () => {
      const result = commit(0n);

      const valid = verify(result.commitment, 0n, result.blinding);

      expect(valid).toBe(true);
    });
  });

  describe("Homomorphic Operations", () => {
    describe("addCommitments", () => {
      it("should add commitments homomorphically", () => {
        const c1 = commit(100n);
        const c2 = commit(200n);

        const sum = addCommitments(c1.commitment, c2.commitment);
        const sumBlinding = sumBlindings([c1.blinding, c2.blinding]);

        // The sum should be a valid commitment to 300
        // Note: We need to verify with the correct blinding
        const sumCommitment = commit(300n, sumBlinding);
        expect(sum.compressed).toBe(sumCommitment.commitment.compressed);
      });
    });

    describe("subtractCommitments", () => {
      it("should subtract commitments homomorphically", () => {
        const c1 = commit(300n);
        const c2 = commit(100n);

        const diff = subtractCommitments(c1.commitment, c2.commitment);

        expect(diff.compressed).toBeDefined();
        expect(diff.x).toBeDefined();
        expect(diff.y).toBeDefined();
      });
    });

    describe("sumCommitments", () => {
      it("should sum multiple commitments", () => {
        const c1 = commit(100n);
        const c2 = commit(200n);
        const c3 = commit(300n);

        const sum = sumCommitments([c1.commitment, c2.commitment, c3.commitment]);
        const totalBlinding = sumBlindings([c1.blinding, c2.blinding, c3.blinding]);

        // Verify sum equals commitment to 600
        const expected = commit(600n, totalBlinding);
        expect(sum.compressed).toBe(expected.commitment.compressed);
      });

      it("should return single commitment unchanged", () => {
        const c = commit(100n);

        const sum = sumCommitments([c.commitment]);

        expect(sum.compressed).toBe(c.commitment.compressed);
      });

      it("should throw on empty array", () => {
        expect(() => sumCommitments([])).toThrow("Cannot sum empty array");
      });
    });

    describe("sumBlindings", () => {
      it("should sum blinding factors", () => {
        const b1 = 100n;
        const b2 = 200n;
        const b3 = 300n;

        const sum = sumBlindings([b1, b2, b3]);

        expect(sum).toBe(600n);
      });
    });
  });

  describe("Contribution Weight Helpers", () => {
    describe("commitContributionWeights", () => {
      it("should commit weights that sum to 100%", () => {
        const { commitments, openings, totalCommitment, totalBlinding } =
          commitContributionWeights({
            "alice.eth": 6000,
            "bob.eth": 3000,
            "carol.eth": 1000,
          });

        expect(commitments).toHaveLength(3);
        expect(openings).toHaveLength(3);
        expect(totalCommitment).toBeDefined();

        // Verify total is commitment to 10000
        const valid = verify(totalCommitment, 10000n, totalBlinding);
        expect(valid).toBe(true);
      });

      it("should reject weights not summing to 10000", () => {
        expect(() =>
          commitContributionWeights({
            "alice.eth": 6000,
            "bob.eth": 3000,
          })
        ).toThrow("Weights must sum to 10000");
      });

      it("should reject negative weights", () => {
        expect(() =>
          commitContributionWeights({
            "alice.eth": -1000,
            "bob.eth": 11000,
          })
        ).toThrow("Invalid weight");
      });

      it("should reject weights over 10000", () => {
        expect(() =>
          commitContributionWeights({
            "alice.eth": 11000,
            "bob.eth": -1000,
          })
        ).toThrow("Invalid weight");
      });

      it("should handle single contributor at 100%", () => {
        const { commitments, openings } = commitContributionWeights({
          "solo.eth": 10000,
        });

        expect(commitments).toHaveLength(1);
        expect(openings[0].weight).toBe(10000);
      });
    });

    describe("verifyWeightSum", () => {
      it("should verify valid weight sum", () => {
        const { commitments, totalBlinding } = commitContributionWeights({
          "alice.eth": 5000,
          "bob.eth": 5000,
        });

        const valid = verifyWeightSum(commitments, totalBlinding);

        expect(valid).toBe(true);
      });

      it("should reject invalid total blinding", () => {
        const { commitments } = commitContributionWeights({
          "alice.eth": 5000,
          "bob.eth": 5000,
        });

        const wrongBlinding = generateBlinding();
        const invalid = verifyWeightSum(commitments, wrongBlinding);

        expect(invalid).toBe(false);
      });
    });

    describe("verifyWeightOpening", () => {
      it("should verify valid weight opening", () => {
        const { commitments, openings } = commitContributionWeights({
          "alice.eth": 6000,
          "bob.eth": 4000,
        });

        const aliceCommitment = commitments.find((c) => c.entityId === "alice.eth")!;
        const aliceOpening = openings.find((o) => o.entityId === "alice.eth")!;

        const valid = verifyWeightOpening(aliceCommitment, aliceOpening);

        expect(valid).toBe(true);
      });

      it("should reject mismatched entity IDs", () => {
        const { commitments, openings } = commitContributionWeights({
          "alice.eth": 6000,
          "bob.eth": 4000,
        });

        const aliceCommitment = commitments.find((c) => c.entityId === "alice.eth")!;
        const bobOpening = openings.find((o) => o.entityId === "bob.eth")!;

        const invalid = verifyWeightOpening(aliceCommitment, bobOpening);

        expect(invalid).toBe(false);
      });

      it("should reject tampered weight", () => {
        const { commitments, openings } = commitContributionWeights({
          "alice.eth": 6000,
          "bob.eth": 4000,
        });

        const aliceCommitment = commitments.find((c) => c.entityId === "alice.eth")!;
        const aliceOpening = openings.find((o) => o.entityId === "alice.eth")!;

        // Tamper with the weight
        const tamperedOpening = { ...aliceOpening, weight: 7000 };
        const invalid = verifyWeightOpening(aliceCommitment, tamperedOpening);

        expect(invalid).toBe(false);
      });
    });
  });

  describe("Serialization", () => {
    describe("serializeCommitment / deserializeCommitment", () => {
      it("should serialize and deserialize commitment", () => {
        const original = commit(12345n);
        const serialized = serializeCommitment(original);
        const restored = deserializeCommitment(serialized);

        expect(restored.commitment.compressed).toBe(original.commitment.compressed);
        expect(restored.blinding).toBe(original.blinding);
        expect(restored.value).toBe(original.value);
      });

      it("should produce JSON-serializable output", () => {
        const result = commit(100n);
        const serialized = serializeCommitment(result);

        const json = JSON.stringify(serialized);
        const parsed = JSON.parse(json);

        expect(parsed.commitment).toBe(serialized.commitment);
        expect(parsed.blinding).toBe(serialized.blinding);
        expect(parsed.value).toBe(serialized.value);
      });
    });

    describe("serializeWeightOpening / deserializeWeightOpening", () => {
      it("should serialize and deserialize weight opening", () => {
        const { openings } = commitContributionWeights({
          "alice.eth": 6000,
          "bob.eth": 4000,
        });

        const original = openings[0];
        const json = serializeWeightOpening(original);
        const restored = deserializeWeightOpening(json);

        expect(restored.entityId).toBe(original.entityId);
        expect(restored.weight).toBe(original.weight);
        expect(restored.blinding).toBe(original.blinding);
      });
    });
  });

  describe("Contract Integration", () => {
    describe("commitmentToBytes / commitmentFromBytes", () => {
      it("should convert commitment to bytes and back", () => {
        const result = commit(100n);
        const bytes = commitmentToBytes(result.commitment);
        const restored = commitmentFromBytes(bytes);

        expect(bytes.length).toBe(33); // Compressed point
        expect(restored.compressed).toBe(result.commitment.compressed);
      });
    });

    describe("commitmentHash", () => {
      it("should produce hex hash", () => {
        const result = commit(100n);
        const hash = commitmentHash(result.commitment);

        expect(hash.startsWith("0x")).toBe(true);
        expect(hash.length).toBe(66); // 0x + 64 hex chars
      });

      it("should produce different hashes for different commitments", () => {
        const c1 = commit(100n);
        const c2 = commit(200n);

        const h1 = commitmentHash(c1.commitment);
        const h2 = commitmentHash(c2.commitment);

        expect(h1).not.toBe(h2);
      });

      it("should produce same hash for same commitment", () => {
        const blinding = generateBlinding();
        const c1 = commit(100n, blinding);
        const c2 = commit(100n, blinding);

        const h1 = commitmentHash(c1.commitment);
        const h2 = commitmentHash(c2.commitment);

        expect(h1).toBe(h2);
      });
    });
  });

  describe("Real-World Scenarios", () => {
    it("should support private contribution distribution workflow", () => {
      // Step 1: Project lead creates commitments
      const { commitments, openings, totalCommitment, totalBlinding } =
        commitContributionWeights({
          "alice.eth": 6000, // 60%
          "bob.eth": 3000, // 30%
          "carol.eth": 1000, // 10%
        });

      // Step 2: Publish commitments on-chain (or to verifiers)
      // The commitments are public, but values are hidden
      expect(commitments).toHaveLength(3);

      // Step 3: Verifiers can check sum = 100% without knowing individual weights
      const sumValid = verifyWeightSum(commitments, totalBlinding);
      expect(sumValid).toBe(true);

      // Step 4: Each contributor gets their own opening (privately)
      const aliceOpening = openings.find((o) => o.entityId === "alice.eth")!;
      expect(aliceOpening.weight).toBe(6000);

      // Step 5: When payment time comes, Alice can prove her share
      const aliceCommitment = commitments.find((c) => c.entityId === "alice.eth")!;
      const aliceValid = verifyWeightOpening(aliceCommitment, aliceOpening);
      expect(aliceValid).toBe(true);
    });

    it("should support delayed reveal pattern", () => {
      // Commit now, reveal later (for ProvenanceVerifiable contract)
      const result = commit(6000n);

      // Get the commitment hash for on-chain storage
      const hash = commitmentHash(result.commitment);
      expect(hash.startsWith("0x")).toBe(true);

      // Get bytes for on-chain storage
      const bytes = commitmentToBytes(result.commitment);
      expect(bytes.length).toBe(33);

      // Serialize opening for secure storage
      const serialized = serializeCommitment(result);

      // Later: restore and verify
      const restored = deserializeCommitment(serialized);
      const valid = verify(restored.commitment, restored.value, restored.blinding);
      expect(valid).toBe(true);
    });

    it("should support partial reveal (some weights public, some private)", () => {
      // Scenario: Bob's weight is public (30%), others are private
      const bobWeight = 3000n;
      const bobBlinding = generateBlinding();
      const bobCommitment = commit(bobWeight, bobBlinding);

      // Alice and Carol have private weights that sum to 70%
      const aliceCommitment = commit(5000n); // 50%
      const carolCommitment = commit(2000n); // 20%

      // Verify total (all three) sum to 100%
      const total = sumCommitments([
        bobCommitment.commitment,
        aliceCommitment.commitment,
        carolCommitment.commitment,
      ]);

      const totalBlinding = sumBlindings([
        bobBlinding,
        aliceCommitment.blinding,
        carolCommitment.blinding,
      ]);

      const valid = verify(total, 10000n, totalBlinding);
      expect(valid).toBe(true);

      // Bob's opening is public - can be verified independently
      const bobValid = verify(bobCommitment.commitment, bobWeight, bobBlinding);
      expect(bobValid).toBe(true);
    });
  });
});
