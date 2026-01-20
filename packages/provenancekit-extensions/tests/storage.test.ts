import { describe, it, expect } from "vitest";
import type { Resource } from "@arttribute/eaa-types";
import { cidRef } from "@arttribute/eaa-types";
import {
  STORAGE_NAMESPACE,
  STORAGE_PROVIDERS,
  StorageExtension,
  StorageReplica,
  ReplicaStatus,
  withStorage,
  getStorage,
  hasStorage,
  isPinned,
  getActiveReplicas,
  addReplica,
} from "../src/storage";

const createResource = (): Resource => ({
  address: cidRef("bafytest123"),
  type: "image",
});

describe("storage extension", () => {
  describe("STORAGE_NAMESPACE", () => {
    it("has correct value", () => {
      expect(STORAGE_NAMESPACE).toBe("ext:storage@1.0.0");
    });
  });

  describe("STORAGE_PROVIDERS", () => {
    it("has expected providers", () => {
      expect(STORAGE_PROVIDERS.IPFS_PINATA).toBe("ipfs-pinata");
      expect(STORAGE_PROVIDERS.IPFS_INFURA).toBe("ipfs-infura");
      expect(STORAGE_PROVIDERS.IPFS_WEB3STORAGE).toBe("ipfs-web3storage");
      expect(STORAGE_PROVIDERS.IPFS_LOCAL).toBe("ipfs-local");
      expect(STORAGE_PROVIDERS.ARWEAVE).toBe("arweave");
      expect(STORAGE_PROVIDERS.FILECOIN).toBe("filecoin");
      expect(STORAGE_PROVIDERS.S3).toBe("s3");
      expect(STORAGE_PROVIDERS.R2).toBe("r2");
    });
  });

  describe("ReplicaStatus enum", () => {
    it("validates all status values", () => {
      expect(ReplicaStatus.safeParse("pending").success).toBe(true);
      expect(ReplicaStatus.safeParse("active").success).toBe(true);
      expect(ReplicaStatus.safeParse("failed").success).toBe(true);
      expect(ReplicaStatus.safeParse("expired").success).toBe(true);
    });

    it("rejects invalid status", () => {
      expect(ReplicaStatus.safeParse("unknown").success).toBe(false);
    });
  });

  describe("StorageReplica schema", () => {
    it("validates minimal replica", () => {
      const result = StorageReplica.safeParse({
        provider: STORAGE_PROVIDERS.IPFS_PINATA,
        status: "active",
      });
      expect(result.success).toBe(true);
    });

    it("validates full replica", () => {
      const result = StorageReplica.safeParse({
        provider: STORAGE_PROVIDERS.ARWEAVE,
        status: "active",
        region: "us-west-2",
        expiresAt: "2025-01-01T00:00:00Z",
        metadata: { txId: "abc123" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const missingProvider = StorageReplica.safeParse({
        status: "active",
      });
      expect(missingProvider.success).toBe(false);

      const missingStatus = StorageReplica.safeParse({
        provider: "ipfs-pinata",
      });
      expect(missingStatus.success).toBe(false);
    });

    it("validates expiresAt datetime format", () => {
      const valid = StorageReplica.safeParse({
        provider: "ipfs-pinata",
        status: "active",
        expiresAt: "2025-01-01T00:00:00Z",
      });
      expect(valid.success).toBe(true);

      const invalid = StorageReplica.safeParse({
        provider: "ipfs-pinata",
        status: "active",
        expiresAt: "not-a-date",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("StorageExtension schema", () => {
    it("validates minimal storage config", () => {
      const result = StorageExtension.safeParse({});
      expect(result.success).toBe(true);
    });

    it("validates full storage config", () => {
      const result = StorageExtension.safeParse({
        pinned: true,
        replicas: [
          { provider: "ipfs-pinata", status: "active" },
          { provider: "arweave", status: "pending" },
        ],
        totalSize: 1024000,
        encrypted: false,
        contentType: "image/png",
        lastVerified: "2024-01-15T10:30:00Z",
        checksum: "sha256:abc123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("withStorage", () => {
    it("adds storage extension to resource", () => {
      const resource = createResource();
      const result = withStorage(resource, {
        pinned: true,
        contentType: "image/png",
      });

      expect(result.extensions?.[STORAGE_NAMESPACE]).toBeDefined();
      const storage = result.extensions?.[STORAGE_NAMESPACE] as any;
      expect(storage.pinned).toBe(true);
      expect(storage.contentType).toBe("image/png");
    });

    it("preserves existing resource properties", () => {
      const resource = createResource();
      const result = withStorage(resource, { pinned: true });

      expect(result.address).toEqual(cidRef("bafytest123"));
      expect(result.type).toBe("image");
    });

    it("preserves existing extensions", () => {
      const resource: Resource = {
        ...createResource(),
        extensions: { "ext:other": { value: 42 } },
      };
      const result = withStorage(resource, { pinned: true });

      expect(result.extensions?.["ext:other"]).toEqual({ value: 42 });
    });

    it("includes replicas", () => {
      const resource = createResource();
      const result = withStorage(resource, {
        pinned: true,
        replicas: [
          { provider: STORAGE_PROVIDERS.IPFS_PINATA, status: "active" },
          { provider: STORAGE_PROVIDERS.ARWEAVE, status: "pending" },
        ],
      });

      const storage = getStorage(result);
      expect(storage?.replicas).toHaveLength(2);
    });
  });

  describe("getStorage", () => {
    it("returns storage extension when present", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
        totalSize: 1024,
        contentType: "text/plain",
      });

      const storage = getStorage(resource);

      expect(storage).toBeDefined();
      expect(storage?.pinned).toBe(true);
      expect(storage?.totalSize).toBe(1024);
      expect(storage?.contentType).toBe("text/plain");
    });

    it("returns undefined when not present", () => {
      expect(getStorage(createResource())).toBeUndefined();
    });
  });

  describe("hasStorage", () => {
    it("returns true when storage extension exists", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
      });

      expect(hasStorage(resource)).toBe(true);
    });

    it("returns false when storage extension does not exist", () => {
      expect(hasStorage(createResource())).toBe(false);
    });
  });

  describe("isPinned", () => {
    it("returns true when pinned is true", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
      });

      expect(isPinned(resource)).toBe(true);
    });

    it("returns false when pinned is false", () => {
      const resource = withStorage(createResource(), {
        pinned: false,
      });

      expect(isPinned(resource)).toBe(false);
    });

    it("returns false when pinned is not set", () => {
      const resource = withStorage(createResource(), {
        contentType: "image/png",
      });

      expect(isPinned(resource)).toBe(false);
    });

    it("returns false when no storage extension", () => {
      expect(isPinned(createResource())).toBe(false);
    });
  });

  describe("getActiveReplicas", () => {
    it("returns only active replicas", () => {
      const resource = withStorage(createResource(), {
        replicas: [
          { provider: "ipfs-pinata", status: "active" },
          { provider: "arweave", status: "pending" },
          { provider: "filecoin", status: "active" },
          { provider: "s3", status: "failed" },
        ],
      });

      const active = getActiveReplicas(resource);

      expect(active).toHaveLength(2);
      expect(active.every((r) => r.status === "active")).toBe(true);
      expect(active.map((r) => r.provider)).toContain("ipfs-pinata");
      expect(active.map((r) => r.provider)).toContain("filecoin");
    });

    it("returns empty array when no active replicas", () => {
      const resource = withStorage(createResource(), {
        replicas: [
          { provider: "arweave", status: "pending" },
          { provider: "s3", status: "failed" },
        ],
      });

      expect(getActiveReplicas(resource)).toHaveLength(0);
    });

    it("returns empty array when no replicas", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
      });

      expect(getActiveReplicas(resource)).toHaveLength(0);
    });

    it("returns empty array when no storage extension", () => {
      expect(getActiveReplicas(createResource())).toHaveLength(0);
    });
  });

  describe("addReplica", () => {
    it("adds replica to existing storage", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
        replicas: [{ provider: "ipfs-pinata", status: "active" }],
      });

      const updated = addReplica(resource, {
        provider: "arweave",
        status: "pending",
      });

      const storage = getStorage(updated);
      expect(storage?.replicas).toHaveLength(2);
      expect(storage?.replicas?.[1].provider).toBe("arweave");
    });

    it("creates replicas array if not present", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
      });

      const updated = addReplica(resource, {
        provider: "ipfs-pinata",
        status: "active",
      });

      const storage = getStorage(updated);
      expect(storage?.replicas).toHaveLength(1);
    });

    it("creates storage extension if not present", () => {
      const resource = createResource();

      const updated = addReplica(resource, {
        provider: "ipfs-pinata",
        status: "active",
      });

      expect(hasStorage(updated)).toBe(true);
      const storage = getStorage(updated);
      expect(storage?.replicas).toHaveLength(1);
    });

    it("preserves other storage properties", () => {
      const resource = withStorage(createResource(), {
        pinned: true,
        contentType: "image/png",
        totalSize: 1024,
      });

      const updated = addReplica(resource, {
        provider: "arweave",
        status: "pending",
      });

      const storage = getStorage(updated);
      expect(storage?.pinned).toBe(true);
      expect(storage?.contentType).toBe("image/png");
      expect(storage?.totalSize).toBe(1024);
    });

    it("validates replica data", () => {
      const resource = createResource();

      expect(() =>
        addReplica(resource, {
          provider: "test",
          status: "invalid" as any,
        })
      ).toThrow();
    });
  });

  describe("integration scenarios", () => {
    it("handles multi-provider storage scenario", () => {
      const resource = createResource();

      // Start with pinned IPFS
      let stored = withStorage(resource, {
        pinned: true,
        contentType: "application/json",
        totalSize: 5000,
        replicas: [{ provider: STORAGE_PROVIDERS.IPFS_PINATA, status: "active" }],
      });

      // Add Arweave for permanence
      stored = addReplica(stored, {
        provider: STORAGE_PROVIDERS.ARWEAVE,
        status: "pending",
        metadata: { bundlrId: "bundle123" },
      });

      // Add S3 backup
      stored = addReplica(stored, {
        provider: STORAGE_PROVIDERS.S3,
        status: "active",
        region: "us-east-1",
      });

      const storage = getStorage(stored);
      expect(storage?.replicas).toHaveLength(3);
      expect(getActiveReplicas(stored)).toHaveLength(2);
      expect(isPinned(stored)).toBe(true);
    });
  });
});
