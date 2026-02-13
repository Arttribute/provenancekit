import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  signAction,
  verifyAction,
  canonicalizeAction,
  type ActionSignPayload,
} from "../src/signing";

describe("action signing", () => {
  const samplePayload: ActionSignPayload = {
    entityId: "did:key:alice",
    actionType: "create",
    inputs: ["bafyinput1", "bafyinput2"],
    timestamp: "2025-01-15T10:00:00Z",
  };

  describe("canonicalizeAction", () => {
    it("produces deterministic output", () => {
      const a = canonicalizeAction(samplePayload);
      const b = canonicalizeAction(samplePayload);
      expect(a).toBe(b);
    });

    it("sorts inputs for determinism", () => {
      const payload1: ActionSignPayload = {
        ...samplePayload,
        inputs: ["bbb", "aaa"],
      };
      const payload2: ActionSignPayload = {
        ...samplePayload,
        inputs: ["aaa", "bbb"],
      };
      expect(canonicalizeAction(payload1)).toBe(canonicalizeAction(payload2));
    });

    it("produces different output for different payloads", () => {
      const other: ActionSignPayload = {
        ...samplePayload,
        entityId: "did:key:bob",
      };
      expect(canonicalizeAction(samplePayload)).not.toBe(
        canonicalizeAction(other)
      );
    });

    it("produces valid JSON", () => {
      const canonical = canonicalizeAction(samplePayload);
      expect(() => JSON.parse(canonical)).not.toThrow();
    });
  });

  describe("signAction + verifyAction roundtrip", () => {
    it("generates valid proof that verifies", async () => {
      const { privateKey } = await generateKeyPair();

      const proof = await signAction(samplePayload, privateKey);

      expect(proof.algorithm).toBe("Ed25519");
      expect(proof.publicKey).toBeTruthy();
      expect(proof.signature).toBeTruthy();
      expect(proof.timestamp).toBeTruthy();

      const valid = await verifyAction(samplePayload, proof);
      expect(valid).toBe(true);
    });

    it("fails verification with wrong payload", async () => {
      const { privateKey } = await generateKeyPair();

      const proof = await signAction(samplePayload, privateKey);

      const tamperedPayload: ActionSignPayload = {
        ...samplePayload,
        entityId: "did:key:mallory",
      };

      const valid = await verifyAction(tamperedPayload, proof);
      expect(valid).toBe(false);
    });

    it("fails verification with wrong key", async () => {
      const keys1 = await generateKeyPair();
      const keys2 = await generateKeyPair();

      const proof = await signAction(samplePayload, keys1.privateKey);

      // Swap public key to keys2
      const tamperedProof = { ...proof, publicKey: keys2.publicKey };

      const valid = await verifyAction(samplePayload, tamperedProof);
      expect(valid).toBe(false);
    });

    it("proof public key matches signing key pair", async () => {
      const { privateKey, publicKey } = await generateKeyPair();

      const proof = await signAction(samplePayload, privateKey);
      expect(proof.publicKey).toBe(publicKey);
    });

    it("different payloads produce different signatures", async () => {
      const { privateKey } = await generateKeyPair();

      const proof1 = await signAction(samplePayload, privateKey);
      const proof2 = await signAction(
        { ...samplePayload, actionType: "transform" },
        privateKey
      );

      expect(proof1.signature).not.toBe(proof2.signature);
    });
  });

  describe("verifyAction edge cases", () => {
    it("throws on unsupported algorithm", async () => {
      const { privateKey } = await generateKeyPair();
      const proof = await signAction(samplePayload, privateKey);

      const badProof = { ...proof, algorithm: "RSA" as any };

      await expect(verifyAction(samplePayload, badProof)).rejects.toThrow(
        "Unsupported signing algorithm"
      );
    });
  });

  describe("generateKeyPair", () => {
    it("generates unique key pairs", async () => {
      const a = await generateKeyPair();
      const b = await generateKeyPair();

      expect(a.privateKey).not.toBe(b.privateKey);
      expect(a.publicKey).not.toBe(b.publicKey);
    });

    it("returns hex-encoded strings", async () => {
      const { privateKey, publicKey } = await generateKeyPair();

      expect(privateKey).toMatch(/^[0-9a-f]+$/);
      expect(publicKey).toMatch(/^[0-9a-f]+$/);
    });
  });
});
