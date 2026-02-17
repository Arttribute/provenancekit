import { describe, it, expect } from "vitest";
import { generateKey, encrypt, toEnvelope } from "@provenancekit/privacy";
import {
  decryptVector,
  cosineSimilarity,
  searchVectors,
  resolveKey,
} from "../src/vector-crypto";

describe("vector-crypto", () => {
  /**
   * Simulates the server-side flow: serialize a number[] vector as
   * Float32Array bytes, encrypt it, produce a JSON envelope blob.
   */
  function encryptVector(vec: number[], key: Uint8Array): string {
    const bytes = new Uint8Array(new Float32Array(vec).buffer);
    const result = encrypt(bytes, key);
    const envelope = toEnvelope(result);
    return JSON.stringify(envelope);
  }

  describe("encrypt/decrypt roundtrip", () => {
    it("recovers the original vector after encryption and decryption", () => {
      const key = generateKey();
      const original = [0.1, 0.2, 0.3, -0.5, 0.99, 0.0, -1.0, 0.42];

      const blob = encryptVector(original, key);
      const recovered = decryptVector(blob, key);

      expect(recovered).toBeInstanceOf(Float32Array);
      expect(recovered.length).toBe(original.length);

      for (let i = 0; i < original.length; i++) {
        expect(recovered[i]).toBeCloseTo(original[i], 5);
      }
    });

    it("fails to decrypt with a wrong key", () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const vec = [1.0, 2.0, 3.0];

      const blob = encryptVector(vec, key1);

      expect(() => decryptVector(blob, key2)).toThrow();
    });

    it("handles high-dimensional vectors (512D)", () => {
      const key = generateKey();
      const original = Array.from({ length: 512 }, (_, i) => Math.sin(i) * 0.5);

      const blob = encryptVector(original, key);
      const recovered = decryptVector(blob, key);

      expect(recovered.length).toBe(512);
      for (let i = 0; i < 512; i++) {
        expect(recovered[i]).toBeCloseTo(original[i], 5);
      }
    });
  });

  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const v = new Float32Array([1, 2, 3, 4]);
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it("returns 0 for orthogonal vectors", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it("returns -1 for opposite vectors", () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([-1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it("handles zero vectors gracefully", () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });
  });

  describe("searchVectors", () => {
    it("returns top-K results sorted by score", () => {
      const query = new Float32Array([1, 0, 0]);
      const vectors = [
        { ref: "a", vec: new Float32Array([1, 0, 0]) },       // score = 1.0
        { ref: "b", vec: new Float32Array([0.9, 0.1, 0]) },   // high
        { ref: "c", vec: new Float32Array([0, 1, 0]) },       // score = 0.0
        { ref: "d", vec: new Float32Array([0.5, 0.5, 0]) },   // medium
      ];

      const results = searchVectors(query, vectors, { topK: 2 });

      expect(results.length).toBe(2);
      expect(results[0].ref).toBe("a");
      expect(results[0].score).toBeCloseTo(1.0, 3);
      expect(results[1].ref).toBe("b");
    });

    it("filters by minimum score", () => {
      const query = new Float32Array([1, 0]);
      const vectors = [
        { ref: "high", vec: new Float32Array([0.95, 0.05]) },
        { ref: "low", vec: new Float32Array([0.1, 0.9]) },
      ];

      const results = searchVectors(query, vectors, { minScore: 0.8 });
      expect(results.length).toBe(1);
      expect(results[0].ref).toBe("high");
    });

    it("filters by type/kind", () => {
      const query = new Float32Array([1, 0]);
      const vectors = [
        { ref: "img1", vec: new Float32Array([0.9, 0.1]), kind: "image" },
        { ref: "txt1", vec: new Float32Array([0.95, 0.05]), kind: "text" },
      ];

      const results = searchVectors(query, vectors, { type: "image" });
      expect(results.length).toBe(1);
      expect(results[0].ref).toBe("img1");
    });
  });

  describe("resolveKey", () => {
    it("passes through Uint8Array unchanged", () => {
      const key = generateKey();
      expect(resolveKey(key)).toBe(key);
    });

    it("decodes base64 string to Uint8Array", () => {
      const key = generateKey();
      const b64 = Buffer.from(key).toString("base64");
      const resolved = resolveKey(b64);
      expect(resolved).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(resolved).toString("base64")).toBe(b64);
    });
  });

  describe("end-to-end encrypted search", () => {
    it("encrypts vectors, decrypts, and finds the best match", () => {
      const key = generateKey();

      // Simulate 3 encrypted resources with different content
      const vectors = [
        { ref: "sunset", original: Array.from({ length: 8 }, (_, i) => Math.cos(i * 0.5)) },
        { ref: "cat", original: Array.from({ length: 8 }, (_, i) => Math.sin(i * 0.3)) },
        { ref: "sunset2", original: Array.from({ length: 8 }, (_, i) => Math.cos(i * 0.5 + 0.01)) },
      ];

      // Encrypt (server-side)
      const encrypted = vectors.map((v) => ({
        ref: v.ref,
        blob: encryptVector(v.original, key),
        kind: "image" as const,
      }));

      // Decrypt and search (client-side)
      const decrypted = encrypted.map((e) => ({
        ref: e.ref,
        vec: decryptVector(e.blob, key),
        kind: e.kind,
      }));

      // Query with something close to "sunset"
      const query = new Float32Array(vectors[0].original);
      const results = searchVectors(query, decrypted, { topK: 2 });

      // sunset should be #1 (exact match), sunset2 should be #2 (very close)
      expect(results[0].ref).toBe("sunset");
      expect(results[0].score).toBeCloseTo(1.0, 3);
      expect(results[1].ref).toBe("sunset2");
      expect(results[1].score).toBeGreaterThan(0.99);
    });
  });
});
