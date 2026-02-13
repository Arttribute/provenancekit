import { describe, it, expect } from "vitest";
import type { Action } from "@arttribute/eaa-types";
import {
  PROOF_NAMESPACE,
  ProofExtension,
  withProof,
  getProof,
  hasProof,
} from "../src/proof";

const createAction = (): Action => ({
  id: "action-1",
  type: "create",
  performedBy: "did:key:alice",
  timestamp: "2025-01-15T10:00:00Z",
  inputs: [],
  outputs: [],
});

describe("proof extension", () => {
  describe("ProofExtension schema", () => {
    it("validates valid proof data", () => {
      const result = ProofExtension.safeParse({
        algorithm: "Ed25519",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("requires algorithm field", () => {
      const result = ProofExtension.safeParse({
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid algorithm", () => {
      const result = ProofExtension.safeParse({
        algorithm: "RSA",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });
      expect(result.success).toBe(false);
    });

    it("accepts ECDSA-secp256k1 algorithm", () => {
      const result = ProofExtension.safeParse({
        algorithm: "ECDSA-secp256k1",
        publicKey: "04abcdef",
        signature: "3045...",
        timestamp: "2025-01-15T10:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("requires timestamp in ISO 8601 format", () => {
      const result = ProofExtension.safeParse({
        algorithm: "Ed25519",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "not-a-date",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("withProof", () => {
    it("adds proof extension to action", () => {
      const action = createAction();
      const result = withProof(action, {
        algorithm: "Ed25519",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });

      expect(result.extensions?.[PROOF_NAMESPACE]).toBeDefined();
      expect(result.id).toBe("action-1");
    });

    it("preserves existing extensions", () => {
      const action: Action = {
        ...createAction(),
        extensions: { "ext:other@1.0.0": { foo: "bar" } },
      };
      const result = withProof(action, {
        algorithm: "Ed25519",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });

      expect(result.extensions?.[PROOF_NAMESPACE]).toBeDefined();
      expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
    });
  });

  describe("getProof", () => {
    it("returns proof data when present", () => {
      const action = withProof(createAction(), {
        algorithm: "Ed25519",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });
      const proof = getProof(action);

      expect(proof?.algorithm).toBe("Ed25519");
      expect(proof?.publicKey).toBe("ab12cd34");
      expect(proof?.signature).toBe("ef56gh78");
    });

    it("returns undefined when not present", () => {
      const action = createAction();
      expect(getProof(action)).toBeUndefined();
    });
  });

  describe("hasProof", () => {
    it("returns true when extension exists", () => {
      const action = withProof(createAction(), {
        algorithm: "Ed25519",
        publicKey: "ab12cd34",
        signature: "ef56gh78",
        timestamp: "2025-01-15T10:00:00Z",
      });
      expect(hasProof(action)).toBe(true);
    });

    it("returns false when extension missing", () => {
      const action = createAction();
      expect(hasProof(action)).toBe(false);
    });
  });

  describe("PROOF_NAMESPACE", () => {
    it("follows ext:namespace@version format", () => {
      expect(PROOF_NAMESPACE).toBe("ext:proof@1.0.0");
    });
  });
});
