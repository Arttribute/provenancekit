/**
 * Tests for encrypted file storage wrapper
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EncryptedFileStorage,
  createEncryptedStorageExtension,
  extractEnvelopeFromExtension,
  encryptAndUpload,
  downloadAndDecrypt,
} from "../src/storage.js";

import { generateKey, DEFAULT_ALGORITHM } from "../src/ciphers.js";

import type { MinimalFileStorage, EncryptedUploadResult } from "../src/storage.js";

/**
 * In-memory mock file storage for testing
 */
class MockFileStorage implements MinimalFileStorage {
  private files: Map<string, Buffer> = new Map();
  private counter = 0;

  async upload(
    data: Buffer,
    _metadata?: { name?: string; mimeType?: string }
  ): Promise<{ ref: { ref: string; scheme: string }; size: number; gatewayUrl?: string }> {
    const ref = `mock-cid-${++this.counter}`;
    this.files.set(ref, data);
    return {
      ref: { ref, scheme: "cid" },
      size: data.length,
      gatewayUrl: `https://mock.gateway/${ref}`,
    };
  }

  async retrieve(ref: string): Promise<Buffer> {
    const data = this.files.get(ref);
    if (!data) {
      throw new Error(`File not found: ${ref}`);
    }
    return data;
  }

  async uploadJson(data: unknown): Promise<{ ref: { ref: string; scheme: string }; size: number }> {
    const json = JSON.stringify(data);
    return this.upload(Buffer.from(json, "utf-8"), { mimeType: "application/json" });
  }

  async retrieveJson<T = unknown>(ref: string): Promise<T> {
    const data = await this.retrieve(ref);
    return JSON.parse(data.toString("utf-8")) as T;
  }

  getUrl(ref: string): string {
    return `https://mock.gateway/${ref}`;
  }

  async exists(ref: string): Promise<boolean> {
    return this.files.has(ref);
  }

  async initialize(): Promise<void> {
    // No-op
  }

  async close(): Promise<void> {
    this.files.clear();
  }

  // Test helper
  getStoredData(ref: string): Buffer | undefined {
    return this.files.get(ref);
  }
}

describe("EncryptedFileStorage", () => {
  let mockStorage: MockFileStorage;
  let encryptedStorage: EncryptedFileStorage;
  let key: Uint8Array;

  beforeEach(() => {
    mockStorage = new MockFileStorage();
    encryptedStorage = new EncryptedFileStorage(mockStorage);
    key = generateKey();
  });

  describe("uploadEncrypted", () => {
    it("encrypts and uploads data", async () => {
      const data = Buffer.from("secret data");
      const result = await encryptedStorage.uploadEncrypted(data, { key });

      expect(result.ref.ref).toContain("mock-cid");
      expect(result.originalSize).toBe(data.length);
      expect(result.encryptedSize).toBeGreaterThan(data.length); // includes auth tag
      expect(result.metadata.algorithm).toBe(DEFAULT_ALGORITHM);
      expect(result.metadata.originalHash).toBeDefined();
      expect(result.envelope).toBeDefined();
    });

    it("stored data is encrypted (not plaintext)", async () => {
      const data = Buffer.from("secret data");
      const result = await encryptedStorage.uploadEncrypted(data, { key });

      const storedData = mockStorage.getStoredData(result.ref.ref);
      expect(storedData).toBeDefined();
      expect(storedData!.toString()).not.toContain("secret data");
    });

    it("includes metadata in result", async () => {
      const data = Buffer.from("test");
      const result = await encryptedStorage.uploadEncrypted(data, {
        key,
        keyMethod: "password",
        contentType: "text/plain",
        filename: "test.txt",
      });

      expect(result.metadata.keyAccess).toBe("password");
      expect(result.metadata.contentType).toBe("text/plain");
    });

    it("includes salt in metadata if provided", async () => {
      const data = Buffer.from("test");
      const salt = new Uint8Array(32).fill(42);
      const result = await encryptedStorage.uploadEncrypted(data, { key, salt });

      expect(result.metadata.salt).toBeDefined();
    });
  });

  describe("downloadDecrypted", () => {
    it("downloads and decrypts data", async () => {
      const originalData = Buffer.from("secret data to recover");
      const uploadResult = await encryptedStorage.uploadEncrypted(originalData, { key });

      const decrypted = await encryptedStorage.downloadDecrypted(uploadResult.ref.ref, {
        key,
        envelope: uploadResult.envelope,
      });

      expect(decrypted).toEqual(originalData);
    });

    it("fails without envelope", async () => {
      const uploadResult = await encryptedStorage.uploadEncrypted(Buffer.from("test"), { key });

      await expect(
        encryptedStorage.downloadDecrypted(uploadResult.ref.ref, { key })
      ).rejects.toThrow(/envelope required/);
    });

    it("fails with wrong key", async () => {
      const uploadResult = await encryptedStorage.uploadEncrypted(Buffer.from("test"), { key });
      const wrongKey = generateKey();

      await expect(
        encryptedStorage.downloadDecrypted(uploadResult.ref.ref, {
          key: wrongKey,
          envelope: uploadResult.envelope,
        })
      ).rejects.toThrow();
    });
  });

  describe("JSON methods", () => {
    it("encrypts and decrypts JSON", async () => {
      const data = { secret: "value", number: 42 };
      const uploadResult = await encryptedStorage.uploadEncryptedJson(data, { key });

      const decrypted = await encryptedStorage.downloadDecryptedJson(uploadResult.ref.ref, {
        key,
        envelope: uploadResult.envelope,
      });

      expect(decrypted).toEqual(data);
    });

    it("sets content type to application/json", async () => {
      const data = { test: true };
      const result = await encryptedStorage.uploadEncryptedJson(data, { key });
      expect(result.metadata.contentType).toBe("application/json");
    });
  });

  describe("utility methods", () => {
    it("checks if file exists", async () => {
      const result = await encryptedStorage.uploadEncrypted(Buffer.from("test"), { key });

      expect(await encryptedStorage.exists(result.ref.ref)).toBe(true);
      expect(await encryptedStorage.exists("nonexistent")).toBe(false);
    });

    it("returns URL for encrypted file", async () => {
      const result = await encryptedStorage.uploadEncrypted(Buffer.from("test"), { key });
      const url = encryptedStorage.getUrl(result.ref.ref);
      expect(url).toContain(result.ref.ref);
    });

    it("provides access to underlying storage", () => {
      const underlying = encryptedStorage.getUnderlyingStorage();
      expect(underlying).toBe(mockStorage);
    });
  });

  describe("lifecycle methods", () => {
    it("initializes underlying storage", async () => {
      await encryptedStorage.initialize();
      // Should not throw
    });

    it("closes underlying storage", async () => {
      await encryptedStorage.close();
      // Should not throw
    });
  });
});

describe("storage extension helpers", () => {
  it("creates storage extension with encryption metadata", async () => {
    const mockResult: EncryptedUploadResult = {
      ref: { ref: "test-cid", scheme: "cid" },
      encryptedSize: 100,
      originalSize: 80,
      metadata: {
        algorithm: "xchacha20-poly1305",
        keyAccess: "password",
        salt: "base64salt",
        originalHash: "abc123",
        contentType: "application/json",
        originalSize: 80,
        encryptedAt: "2025-01-01T00:00:00Z",
      },
      envelope: {
        ciphertext: "base64ciphertext",
        nonce: "base64nonce",
        algorithm: "xchacha20-poly1305",
        version: "1.0",
      },
    };

    const extension = createEncryptedStorageExtension(mockResult, "ipfs-pinata");

    expect(extension["ext:storage@1.0.0"]).toBeDefined();
    const storage = extension["ext:storage@1.0.0"] as Record<string, unknown>;

    expect(storage.encrypted).toBe(true);
    expect(storage.pinned).toBe(true);
    expect(storage.contentType).toBe("application/json");
    expect(storage.envelope).toEqual(mockResult.envelope);
    expect((storage.encryption as Record<string, unknown>).algorithm).toBe("xchacha20-poly1305");
  });

  it("extracts envelope from extension", () => {
    const extensions = {
      "ext:storage@1.0.0": {
        encrypted: true,
        envelope: {
          ciphertext: "test",
          nonce: "test",
          algorithm: "xchacha20-poly1305",
          version: "1.0",
        },
      },
    };

    const envelope = extractEnvelopeFromExtension(extensions);
    expect(envelope).toBeDefined();
    expect(envelope!.ciphertext).toBe("test");
  });

  it("returns undefined for missing extension", () => {
    expect(extractEnvelopeFromExtension(undefined)).toBeUndefined();
    expect(extractEnvelopeFromExtension({})).toBeUndefined();
    expect(extractEnvelopeFromExtension({ "ext:other@1.0.0": {} })).toBeUndefined();
  });
});

describe("convenience functions", () => {
  let mockStorage: MockFileStorage;
  let key: Uint8Array;

  beforeEach(() => {
    mockStorage = new MockFileStorage();
    key = generateKey();
  });

  it("encryptAndUpload works", async () => {
    const data = Buffer.from("quick encrypt");
    const result = await encryptAndUpload(mockStorage, data, key);
    expect(result.ref.ref).toBeDefined();
    expect(result.envelope).toBeDefined();
  });

  it("downloadAndDecrypt works", async () => {
    const data = Buffer.from("round trip test");
    const uploadResult = await encryptAndUpload(mockStorage, data, key);

    const decrypted = await downloadAndDecrypt(
      mockStorage,
      uploadResult.ref.ref,
      key,
      uploadResult.envelope
    );

    expect(decrypted).toEqual(data);
  });
});
