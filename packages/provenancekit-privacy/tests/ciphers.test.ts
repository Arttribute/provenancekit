/**
 * Tests for cipher implementations
 */

import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  generateKey,
  generateNonce,
  encryptString,
  decryptToString,
  encryptJson,
  decryptToJson,
  toEnvelope,
  fromEnvelope,
  encryptToEnvelope,
  decryptFromEnvelope,
  toBase64,
  fromBase64,
  KEY_LENGTH,
  NONCE_LENGTHS,
  DEFAULT_ALGORITHM,
  NobleEncryptionProvider,
} from "../src/ciphers.js";

import type { CipherAlgorithm } from "../src/types.js";

describe("ciphers", () => {
  describe("generateKey", () => {
    it("generates a key of correct length", () => {
      const key = generateKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(KEY_LENGTH);
    });

    it("generates unique keys", () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toEqual(key2);
    });
  });

  describe("generateNonce", () => {
    const algorithms: CipherAlgorithm[] = [
      "xchacha20-poly1305",
      "chacha20-poly1305",
      "aes-256-gcm",
      "aes-256-gcm-siv",
    ];

    it.each(algorithms)("generates correct nonce length for %s", (algo) => {
      const nonce = generateNonce(algo);
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(NONCE_LENGTHS[algo]);
    });
  });

  describe("encrypt/decrypt", () => {
    const testData = new TextEncoder().encode("Hello, ProvenanceKit!");
    const key = generateKey();

    it("encrypts and decrypts with default algorithm", () => {
      const result = encrypt(testData, key);

      expect(result.ciphertext).toBeInstanceOf(Uint8Array);
      expect(result.nonce).toBeInstanceOf(Uint8Array);
      expect(result.algorithm).toBe(DEFAULT_ALGORITHM);
      expect(result.ciphertext.length).toBeGreaterThan(testData.length); // includes auth tag

      const decrypted = decrypt(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted).toEqual(testData);
    });

    const algorithms: CipherAlgorithm[] = [
      "xchacha20-poly1305",
      "chacha20-poly1305",
      "aes-256-gcm",
      "aes-256-gcm-siv",
    ];

    it.each(algorithms)("encrypts and decrypts with %s", (algo) => {
      const result = encrypt(testData, key, algo);

      expect(result.algorithm).toBe(algo);

      const decrypted = decrypt(result.ciphertext, key, result.nonce, algo);
      expect(decrypted).toEqual(testData);
    });

    it("fails decryption with wrong key", () => {
      const result = encrypt(testData, key);
      const wrongKey = generateKey();

      expect(() => {
        decrypt(result.ciphertext, wrongKey, result.nonce, result.algorithm);
      }).toThrow();
    });

    it("fails decryption with tampered ciphertext", () => {
      const result = encrypt(testData, key);
      result.ciphertext[0] ^= 0xff; // flip bits

      expect(() => {
        decrypt(result.ciphertext, key, result.nonce, result.algorithm);
      }).toThrow();
    });

    it("rejects invalid key length", () => {
      const shortKey = new Uint8Array(16);
      expect(() => encrypt(testData, shortKey)).toThrow(/Invalid key length/);
    });

    it("handles empty data", () => {
      const empty = new Uint8Array(0);
      const result = encrypt(empty, key);
      const decrypted = decrypt(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted.length).toBe(0);
    });

    it("handles large data", () => {
      const largeData = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const result = encrypt(largeData, key);
      const decrypted = decrypt(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted).toEqual(largeData);
    });
  });

  describe("string helpers", () => {
    const key = generateKey();

    it("encrypts and decrypts strings", () => {
      const text = "Secret message with émojis 🔐";
      const result = encryptString(text, key);
      const decrypted = decryptToString(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted).toBe(text);
    });

    it("handles unicode strings", () => {
      const text = "日本語テスト 한국어 العربية";
      const result = encryptString(text, key);
      const decrypted = decryptToString(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted).toBe(text);
    });
  });

  describe("JSON helpers", () => {
    const key = generateKey();

    it("encrypts and decrypts JSON objects", () => {
      const data = {
        name: "test",
        value: 123,
        nested: { array: [1, 2, 3] },
      };

      const result = encryptJson(data, key);
      const decrypted = decryptToJson(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted).toEqual(data);
    });

    it("handles arrays", () => {
      const data = [1, "two", { three: 3 }];
      const result = encryptJson(data, key);
      const decrypted = decryptToJson(result.ciphertext, key, result.nonce, result.algorithm);
      expect(decrypted).toEqual(data);
    });
  });

  describe("envelope functions", () => {
    const key = generateKey();
    const testData = new TextEncoder().encode("Test data for envelope");

    it("converts to and from envelope", () => {
      const result = encrypt(testData, key);
      const envelope = toEnvelope(result);

      expect(typeof envelope.ciphertext).toBe("string");
      expect(typeof envelope.nonce).toBe("string");
      expect(envelope.algorithm).toBe(result.algorithm);
      expect(envelope.version).toBe("1.0");

      const parsed = fromEnvelope(envelope);
      expect(parsed.ciphertext).toEqual(result.ciphertext);
      expect(parsed.nonce).toEqual(result.nonce);
      expect(parsed.algorithm).toBe(result.algorithm);
    });

    it("envelope is JSON serializable", () => {
      const result = encrypt(testData, key);
      const envelope = toEnvelope(result);

      const json = JSON.stringify(envelope);
      const restored = JSON.parse(json);

      const parsed = fromEnvelope(restored);
      const decrypted = decrypt(parsed.ciphertext, key, parsed.nonce, parsed.algorithm);
      expect(decrypted).toEqual(testData);
    });

    it("encryptToEnvelope and decryptFromEnvelope work together", () => {
      const envelope = encryptToEnvelope(testData, key);
      const decrypted = decryptFromEnvelope(envelope, key);
      expect(decrypted).toEqual(testData);
    });
  });

  describe("base64 utilities", () => {
    it("converts to and from base64", () => {
      const data = new Uint8Array([0, 1, 2, 255, 254, 253]);
      const base64 = toBase64(data);
      expect(typeof base64).toBe("string");

      const restored = fromBase64(base64);
      expect(restored).toEqual(data);
    });

    it("handles empty data", () => {
      const empty = new Uint8Array(0);
      const base64 = toBase64(empty);
      const restored = fromBase64(base64);
      expect(restored).toEqual(empty);
    });
  });

  describe("NobleEncryptionProvider", () => {
    const provider = new NobleEncryptionProvider();
    const key = generateKey();
    const testData = new TextEncoder().encode("Provider test");

    it("has correct name and supported algorithms", () => {
      expect(provider.name).toBe("noble-ciphers");
      expect(provider.supportedAlgorithms).toContain("xchacha20-poly1305");
      expect(provider.supportedAlgorithms).toContain("aes-256-gcm");
    });

    it("encrypts and decrypts via async interface", async () => {
      const result = await provider.encrypt(testData, key);
      const decrypted = await provider.decrypt(
        result.ciphertext,
        key,
        result.nonce,
        result.algorithm
      );
      expect(decrypted).toEqual(testData);
    });
  });
});
