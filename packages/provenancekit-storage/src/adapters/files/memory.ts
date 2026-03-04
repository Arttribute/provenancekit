/**
 * In-Memory File Storage Adapter
 *
 * A simple in-memory implementation of IFileStorage.
 * Useful for testing, development, and lightweight use cases.
 *
 * Note: Data is lost when the process exits.
 *
 * Uses a simple hash-based "CID" for content addressing.
 * Not a real CID, but demonstrates content-addressed behavior.
 *
 * @example
 * ```typescript
 * import { MemoryFileStorage } from "@provenancekit/storage/adapters/files/memory";
 *
 * const storage = new MemoryFileStorage();
 * await storage.initialize();
 *
 * const result = await storage.upload(Buffer.from("Hello!"));
 * console.log("Ref:", result.ref.ref);
 *
 * const data = await storage.retrieve(result.ref.ref);
 * console.log(data.toString()); // "Hello!"
 * ```
 */

import { createHash } from "crypto";
import type { ContentReference } from "@provenancekit/eaa-types";

import type {
  IFileStorage,
  IPinnableStorage,
  FileMetadata,
  UploadResult,
  RetrieveOptions,
  PinStatus,
} from "../../files/interface";

import { FileNotFoundError, FileNotInitializedError } from "../../files/errors";

/*-----------------------------------------------------------------*\
 | Internal Types                                                    |
\*-----------------------------------------------------------------*/

interface StoredFile {
  data: Buffer;
  metadata?: FileMetadata;
  pinnedAt?: Date;
}

/*-----------------------------------------------------------------*\
 | Memory File Storage Implementation                                |
\*-----------------------------------------------------------------*/

export class MemoryFileStorage implements IFileStorage, IPinnableStorage {
  private files = new Map<string, StoredFile>();
  private initialized = false;

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.files.clear();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new FileNotInitializedError();
    }
  }

  /**
   * Generate a content-based hash (simulates CID behavior).
   */
  private generateRef(data: Buffer): string {
    const hash = createHash("sha256").update(data).digest("hex");
    // Prefix with "mem" to indicate it's a memory adapter ref
    return `mem${hash.slice(0, 46)}`;
  }

  /*--------------------------------------------------------------
   | Upload Operations
   --------------------------------------------------------------*/

  async upload(data: Buffer, metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();

    const refString = this.generateRef(data);

    // Store the file (content-addressed means same content = same ref)
    this.files.set(refString, { data, metadata });

    const ref: ContentReference = {
      ref: refString,
      scheme: "hash",
      size: data.length,
    };

    return {
      ref,
      size: data.length,
      gatewayUrl: this.getUrl(refString),
    };
  }

  async uploadJson(data: unknown, metadata?: FileMetadata): Promise<UploadResult> {
    const json = JSON.stringify(data);
    const buffer = Buffer.from(json, "utf-8");
    return this.upload(buffer, {
      ...metadata,
      mimeType: metadata?.mimeType ?? "application/json",
    });
  }

  /*--------------------------------------------------------------
   | Retrieval Operations
   --------------------------------------------------------------*/

  async retrieve(ref: string, _options?: RetrieveOptions): Promise<Buffer> {
    this.ensureInitialized();

    const file = this.files.get(ref);
    if (!file) {
      throw new FileNotFoundError(ref);
    }

    return Buffer.from(file.data);
  }

  async retrieveJson<T = unknown>(
    ref: string,
    options?: RetrieveOptions
  ): Promise<T> {
    const buffer = await this.retrieve(ref, options);
    return JSON.parse(buffer.toString("utf-8")) as T;
  }

  getUrl(ref: string): string {
    return `memory://${ref}`;
  }

  /*--------------------------------------------------------------
   | Status Operations
   --------------------------------------------------------------*/

  async exists(ref: string): Promise<boolean> {
    this.ensureInitialized();
    return this.files.has(ref);
  }

  /*--------------------------------------------------------------
   | Pinning Operations (IPinnableStorage)
   --------------------------------------------------------------*/

  async pin(ref: string, metadata?: FileMetadata): Promise<void> {
    this.ensureInitialized();

    const file = this.files.get(ref);
    if (file) {
      file.pinnedAt = new Date();
      if (metadata) {
        file.metadata = { ...file.metadata, ...metadata };
      }
    }
    // If file doesn't exist, pinning is a no-op (like remote pinning)
  }

  async unpin(ref: string): Promise<void> {
    this.ensureInitialized();

    const file = this.files.get(ref);
    if (file) {
      file.pinnedAt = undefined;
    }
  }

  async getPinStatus(ref: string): Promise<PinStatus> {
    this.ensureInitialized();

    const file = this.files.get(ref);
    if (!file) {
      return { pinned: false };
    }

    return {
      pinned: !!file.pinnedAt,
      pinnedAt: file.pinnedAt,
      size: file.data.length,
    };
  }

  async listPins(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ ref: string; metadata?: FileMetadata }>> {
    this.ensureInitialized();

    const pinned: Array<{ ref: string; metadata?: FileMetadata }> = [];

    for (const [ref, file] of this.files) {
      if (file.pinnedAt) {
        pinned.push({ ref, metadata: file.metadata });
      }
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? pinned.length;

    return pinned.slice(offset, offset + limit);
  }

  /*--------------------------------------------------------------
   | Utility Methods (not part of interface)
   --------------------------------------------------------------*/

  /**
   * Clear all stored files (useful for testing).
   */
  clear(): void {
    this.files.clear();
  }

  /**
   * Get stats for debugging.
   */
  stats(): { fileCount: number; totalSize: number; pinnedCount: number } {
    let totalSize = 0;
    let pinnedCount = 0;

    for (const file of this.files.values()) {
      totalSize += file.data.length;
      if (file.pinnedAt) pinnedCount++;
    }

    return {
      fileCount: this.files.size,
      totalSize,
      pinnedCount,
    };
  }
}
