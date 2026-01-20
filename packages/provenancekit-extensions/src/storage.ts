import { z } from "zod";
import type { Resource } from "@arttribute/eaa-types";

/**
 * Namespace for storage extension.
 * @example "ext:storage@1.0.0"
 */
export const STORAGE_NAMESPACE = "ext:storage@1.0.0" as const;

/**
 * Well-known storage provider identifiers.
 * These are suggestions - any string value is valid.
 */
export const STORAGE_PROVIDERS = {
  IPFS_PINATA: "ipfs-pinata",
  IPFS_INFURA: "ipfs-infura",
  IPFS_WEB3STORAGE: "ipfs-web3storage",
  IPFS_LOCAL: "ipfs-local",
  ARWEAVE: "arweave",
  FILECOIN: "filecoin",
  S3: "s3",
  R2: "r2",
} as const;

/**
 * Storage replica status.
 */
export const ReplicaStatus = z.enum([
  "pending", // Upload in progress
  "active", // Successfully stored
  "failed", // Storage failed
  "expired", // Storage expired
]);
export type ReplicaStatus = z.infer<typeof ReplicaStatus>;

/**
 * Storage replica information.
 */
export const StorageReplica = z.object({
  /** Storage provider */
  provider: z.string(),

  /** Replica status */
  status: ReplicaStatus,

  /** Geographic region (optional) */
  region: z.string().optional(),

  /** When the storage expires (ISO 8601) */
  expiresAt: z.string().datetime().optional(),

  /** Provider-specific metadata */
  metadata: z.record(z.unknown()).optional(),
});
export type StorageReplica = z.infer<typeof StorageReplica>;

/**
 * Storage extension schema.
 *
 * Tracks storage and replication status for resources.
 *
 * @example
 * ```typescript
 * const resource = withStorage(res, {
 *   pinned: true,
 *   contentType: "image/png",
 *   replicas: [
 *     { provider: "ipfs-pinata", status: "active" },
 *     { provider: "arweave", status: "pending" },
 *   ],
 * });
 * ```
 */
export const StorageExtension = z.object({
  /** Whether the content is pinned (for IPFS) */
  pinned: z.boolean().optional(),

  /** Storage replicas across providers */
  replicas: z.array(StorageReplica).optional(),

  /** Total size in bytes */
  totalSize: z.number().optional(),

  /** Whether the content is encrypted */
  encrypted: z.boolean().optional(),

  /** Content MIME type */
  contentType: z.string().optional(),

  /** When storage was last verified (ISO 8601) */
  lastVerified: z.string().datetime().optional(),

  /** Checksum for integrity verification */
  checksum: z.string().optional(),
});

export type StorageExtension = z.infer<typeof StorageExtension>;

/**
 * Add storage extension to a resource.
 *
 * @param resource - The resource to extend
 * @param storage - Storage metadata
 * @returns Resource with storage extension
 *
 * @example
 * ```typescript
 * const stored = withStorage(resource, {
 *   pinned: true,
 *   contentType: "image/png",
 * });
 * ```
 */
export function withStorage(
  resource: Resource,
  storage: z.input<typeof StorageExtension>
): Resource {
  const validated = StorageExtension.parse(storage);
  return {
    ...resource,
    extensions: { ...resource.extensions, [STORAGE_NAMESPACE]: validated },
  };
}

/**
 * Get storage extension from a resource.
 *
 * @param resource - The resource to read from
 * @returns Storage data or undefined if not present
 */
export function getStorage(resource: Resource): StorageExtension | undefined {
  const data = resource.extensions?.[STORAGE_NAMESPACE];
  if (!data) return undefined;
  return StorageExtension.parse(data);
}

/**
 * Check if a resource has storage extension.
 *
 * @param resource - The resource to check
 * @returns True if storage extension exists
 */
export function hasStorage(resource: Resource): boolean {
  return resource.extensions?.[STORAGE_NAMESPACE] !== undefined;
}

/**
 * Check if a resource is pinned.
 *
 * @param resource - The resource to check
 * @returns True if pinned, false otherwise
 */
export function isPinned(resource: Resource): boolean {
  const storage = getStorage(resource);
  return storage?.pinned === true;
}

/**
 * Get active replicas for a resource.
 *
 * @param resource - The resource to read from
 * @returns Array of active replicas
 */
export function getActiveReplicas(resource: Resource): StorageReplica[] {
  const storage = getStorage(resource);
  return storage?.replicas?.filter((r) => r.status === "active") ?? [];
}

/**
 * Add a replica to a resource's storage extension.
 *
 * @param resource - The resource to update
 * @param replica - The replica to add
 * @returns Resource with updated storage extension
 */
export function addReplica(
  resource: Resource,
  replica: z.input<typeof StorageReplica>
): Resource {
  const validated = StorageReplica.parse(replica);
  const current = getStorage(resource) ?? {};
  const replicas = [...(current.replicas ?? []), validated];

  return withStorage(resource, { ...current, replicas });
}
