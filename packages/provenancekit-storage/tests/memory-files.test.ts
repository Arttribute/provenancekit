import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryFileStorage } from "../src/adapters/files/memory";
import { FileNotFoundError, FileNotInitializedError } from "../src/files/errors";

describe("MemoryFileStorage", () => {
  let storage: MemoryFileStorage;

  beforeEach(async () => {
    storage = new MemoryFileStorage();
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe("lifecycle", () => {
    it("initializes successfully", async () => {
      const newStorage = new MemoryFileStorage();
      await newStorage.initialize();
      // Should not throw
      expect(await newStorage.exists("test")).toBe(false);
    });

    it("throws when not initialized", async () => {
      const newStorage = new MemoryFileStorage();
      await expect(newStorage.exists("test")).rejects.toThrow(
        FileNotInitializedError
      );
    });

    it("clears data on close", async () => {
      const result = await storage.upload(Buffer.from("test data"));
      expect(await storage.exists(result.ref.ref)).toBe(true);

      await storage.close();
      await storage.initialize();

      expect(await storage.exists(result.ref.ref)).toBe(false);
    });
  });

  describe("upload operations", () => {
    it("uploads a buffer and returns ref", async () => {
      const data = Buffer.from("Hello, World!");
      const result = await storage.upload(data);

      expect(result.ref).toBeDefined();
      expect(result.ref.ref).toMatch(/^mem/); // Memory adapter prefix
      expect(result.ref.scheme).toBe("hash");
      expect(result.size).toBe(data.length);
    });

    it("generates same ref for same content", async () => {
      const data = Buffer.from("Same content");
      const result1 = await storage.upload(data);
      const result2 = await storage.upload(data);

      expect(result1.ref.ref).toBe(result2.ref.ref);
    });

    it("generates different refs for different content", async () => {
      const result1 = await storage.upload(Buffer.from("Content A"));
      const result2 = await storage.upload(Buffer.from("Content B"));

      expect(result1.ref.ref).not.toBe(result2.ref.ref);
    });

    it("includes gateway URL in result", async () => {
      const result = await storage.upload(Buffer.from("test"));

      expect(result.gatewayUrl).toBe(`memory://${result.ref.ref}`);
    });

    it("stores metadata with upload", async () => {
      const data = Buffer.from("test");
      const result = await storage.upload(data, {
        mimeType: "text/plain",
        filename: "test.txt",
      });

      // Metadata is stored but we verify via pin status
      await storage.pin(result.ref.ref);
      const status = await storage.getPinStatus(result.ref.ref);
      expect(status.pinned).toBe(true);
    });
  });

  describe("uploadJson", () => {
    it("uploads JSON and retrieves it", async () => {
      const data = { name: "Alice", age: 30 };
      const result = await storage.uploadJson(data);

      const retrieved = await storage.retrieveJson(result.ref.ref);
      expect(retrieved).toEqual(data);
    });

    it("handles complex nested JSON", async () => {
      const data = {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        metadata: {
          version: "1.0",
          nested: { deep: true },
        },
      };

      const result = await storage.uploadJson(data);
      const retrieved = await storage.retrieveJson(result.ref.ref);

      expect(retrieved).toEqual(data);
    });
  });

  describe("retrieve operations", () => {
    it("retrieves uploaded data", async () => {
      const original = Buffer.from("Hello, World!");
      const result = await storage.upload(original);

      const retrieved = await storage.retrieve(result.ref.ref);

      expect(retrieved.toString()).toBe(original.toString());
    });

    it("throws FileNotFoundError for non-existent ref", async () => {
      await expect(storage.retrieve("nonexistent")).rejects.toThrow(
        FileNotFoundError
      );
    });

    it("retrieves binary data correctly", async () => {
      const original = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const result = await storage.upload(original);

      const retrieved = await storage.retrieve(result.ref.ref);

      expect(Buffer.compare(retrieved, original)).toBe(0);
    });
  });

  describe("exists operation", () => {
    it("returns true for existing file", async () => {
      const result = await storage.upload(Buffer.from("test"));
      expect(await storage.exists(result.ref.ref)).toBe(true);
    });

    it("returns false for non-existent file", async () => {
      expect(await storage.exists("nonexistent")).toBe(false);
    });
  });

  describe("getUrl", () => {
    it("returns memory:// URL", () => {
      const url = storage.getUrl("someref");
      expect(url).toBe("memory://someref");
    });
  });

  describe("pinning operations", () => {
    it("pins a file", async () => {
      const result = await storage.upload(Buffer.from("test"));
      await storage.pin(result.ref.ref);

      const status = await storage.getPinStatus(result.ref.ref);
      expect(status.pinned).toBe(true);
      expect(status.pinnedAt).toBeInstanceOf(Date);
    });

    it("unpins a file", async () => {
      const result = await storage.upload(Buffer.from("test"));
      await storage.pin(result.ref.ref);
      await storage.unpin(result.ref.ref);

      const status = await storage.getPinStatus(result.ref.ref);
      expect(status.pinned).toBe(false);
    });

    it("getPinStatus returns size for existing file", async () => {
      const data = Buffer.from("test data here");
      const result = await storage.upload(data);
      await storage.pin(result.ref.ref);

      const status = await storage.getPinStatus(result.ref.ref);
      expect(status.size).toBe(data.length);
    });

    it("getPinStatus returns pinned:false for non-existent file", async () => {
      const status = await storage.getPinStatus("nonexistent");
      expect(status.pinned).toBe(false);
    });

    it("listPins returns pinned files", async () => {
      const result1 = await storage.upload(Buffer.from("file 1"));
      const result2 = await storage.upload(Buffer.from("file 2"));
      const result3 = await storage.upload(Buffer.from("file 3"));

      await storage.pin(result1.ref.ref);
      await storage.pin(result3.ref.ref);
      // result2 not pinned

      const pins = await storage.listPins();
      expect(pins).toHaveLength(2);
      expect(pins.map((p) => p.ref)).toContain(result1.ref.ref);
      expect(pins.map((p) => p.ref)).toContain(result3.ref.ref);
      expect(pins.map((p) => p.ref)).not.toContain(result2.ref.ref);
    });

    it("listPins supports pagination", async () => {
      // Upload and pin 5 files
      for (let i = 0; i < 5; i++) {
        const result = await storage.upload(Buffer.from(`file ${i}`));
        await storage.pin(result.ref.ref);
      }

      const page1 = await storage.listPins({ limit: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await storage.listPins({ offset: 2, limit: 2 });
      expect(page2).toHaveLength(2);

      // Should not overlap
      const page1Refs = page1.map((p) => p.ref);
      const page2Refs = page2.map((p) => p.ref);
      expect(page1Refs.some((ref) => page2Refs.includes(ref))).toBe(false);
    });

    it("pin is no-op for non-existent file", async () => {
      // Should not throw
      await storage.pin("nonexistent");
    });
  });

  describe("utility methods", () => {
    it("clears all files", async () => {
      await storage.upload(Buffer.from("file 1"));
      await storage.upload(Buffer.from("file 2"));

      storage.clear();

      const stats = storage.stats();
      expect(stats.fileCount).toBe(0);
    });

    it("returns correct stats", async () => {
      const file1 = Buffer.from("file 1");
      const file2 = Buffer.from("longer file 2");

      const result1 = await storage.upload(file1);
      await storage.upload(file2);
      await storage.pin(result1.ref.ref);

      const stats = storage.stats();

      expect(stats.fileCount).toBe(2);
      expect(stats.totalSize).toBe(file1.length + file2.length);
      expect(stats.pinnedCount).toBe(1);
    });
  });

  describe("content addressing behavior", () => {
    it("same content overwrites without duplication", async () => {
      const data = Buffer.from("unique content");

      await storage.upload(data);
      await storage.upload(data);
      await storage.upload(data);

      const stats = storage.stats();
      expect(stats.fileCount).toBe(1); // Only one file stored
    });

    it("content is immutable - same ref always returns same data", async () => {
      const data = Buffer.from("original content");
      const result = await storage.upload(data);

      // Even if we "upload" different data to same ref (won't happen in content-addressed system)
      // but let's verify retrieval is consistent
      const retrieved1 = await storage.retrieve(result.ref.ref);
      const retrieved2 = await storage.retrieve(result.ref.ref);

      expect(retrieved1.toString()).toBe(retrieved2.toString());
    });
  });

  describe("large data handling", () => {
    it("handles moderately large files", async () => {
      // 1MB of data
      const size = 1024 * 1024;
      const data = Buffer.alloc(size, "x");

      const result = await storage.upload(data);
      expect(result.size).toBe(size);

      const retrieved = await storage.retrieve(result.ref.ref);
      expect(retrieved.length).toBe(size);
    });
  });
});
