/**
 * ProvenanceKit File Storage Interface
 *
 * Defines the contract for file storage backends.
 * Implementations can use any provider (IPFS, Arweave, S3, etc.)
 *
 * Design principles:
 * - Content-addressed by default (CIDs strongly recommended)
 * - Gateway-configurable for privacy and flexibility
 * - Minimal core, optional capabilities via extensions
 */

import type { ContentReference } from "@arttribute/eaa-types";

/*-----------------------------------------------------------------*\
 | Core Types                                                        |
\*-----------------------------------------------------------------*/

/**
 * Metadata for uploaded files.
 * Optional but useful for discoverability.
 */
export interface FileMetadata {
  /** Original filename (optional) */
  name?: string;
  /** MIME type (optional) */
  mimeType?: string;
  /** Custom metadata (key-value pairs) */
  metadata?: Record<string, string>;
}

/**
 * Result of a file upload operation.
 */
export interface UploadResult {
  /** Content reference (CID or other addressing scheme) */
  ref: ContentReference;
  /** Size in bytes */
  size: number;
  /** Gateway URL for retrieval (if available) */
  gatewayUrl?: string;
}

/**
 * Options for file retrieval.
 */
export interface RetrieveOptions {
  /** Custom gateway URL (overrides default) */
  gateway?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Pin status information.
 */
export interface PinStatus {
  /** Whether the file is pinned */
  pinned: boolean;
  /** Pin date (if pinned) */
  pinnedAt?: Date;
  /** Size in bytes */
  size?: number;
}

/**
 * Gateway configuration.
 */
export interface GatewayConfig {
  /** Gateway URL template. Use {cid} as placeholder. */
  urlTemplate: string;
  /** Optional headers to include in requests */
  headers?: Record<string, string>;
  /** Gateway provider name (for logging) */
  provider?: string;
}

/*-----------------------------------------------------------------*\
 | Core File Storage Interface                                       |
\*-----------------------------------------------------------------*/

/**
 * Core file storage interface.
 *
 * Implementations must provide these methods for basic file operations.
 * This is the minimum required for a ProvenanceKit-compatible file backend.
 */
export interface IFileStorage {
  /*--------------------------------------------------------------
   | Upload Operations
   --------------------------------------------------------------*/

  /**
   * Upload a file from a Buffer.
   *
   * @param data - File content as Buffer
   * @param metadata - Optional file metadata
   * @returns Upload result with content reference
   */
  upload(data: Buffer, metadata?: FileMetadata): Promise<UploadResult>;

  /**
   * Upload a file from a ReadableStream.
   * Useful for large files that shouldn't be loaded into memory.
   *
   * @param stream - File content as ReadableStream
   * @param metadata - Optional file metadata
   * @returns Upload result with content reference
   */
  uploadStream?(
    stream: ReadableStream<Uint8Array>,
    metadata?: FileMetadata
  ): Promise<UploadResult>;

  /**
   * Upload JSON data directly.
   * Convenience method that handles serialization.
   *
   * @param data - JSON-serializable data
   * @param metadata - Optional file metadata
   * @returns Upload result with content reference
   */
  uploadJson(data: unknown, metadata?: FileMetadata): Promise<UploadResult>;

  /*--------------------------------------------------------------
   | Retrieval Operations
   --------------------------------------------------------------*/

  /**
   * Retrieve a file by its content reference.
   *
   * @param ref - Content reference string (e.g., CID)
   * @param options - Retrieval options
   * @returns File content as Buffer
   */
  retrieve(ref: string, options?: RetrieveOptions): Promise<Buffer>;

  /**
   * Retrieve a file as a stream.
   * Useful for large files.
   *
   * @param ref - Content reference string
   * @param options - Retrieval options
   * @returns File content as ReadableStream
   */
  retrieveStream?(
    ref: string,
    options?: RetrieveOptions
  ): Promise<ReadableStream<Uint8Array>>;

  /**
   * Retrieve and parse JSON data.
   *
   * @param ref - Content reference string
   * @param options - Retrieval options
   * @returns Parsed JSON data
   */
  retrieveJson<T = unknown>(ref: string, options?: RetrieveOptions): Promise<T>;

  /**
   * Get a gateway URL for a content reference.
   * Does not verify the file exists.
   *
   * @param ref - Content reference string
   * @returns Gateway URL for retrieval
   */
  getUrl(ref: string): string;

  /*--------------------------------------------------------------
   | Status Operations
   --------------------------------------------------------------*/

  /**
   * Check if a file exists/is available.
   *
   * @param ref - Content reference string
   * @returns true if file exists
   */
  exists(ref: string): Promise<boolean>;

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  /**
   * Initialize the storage backend.
   * Called once before any operations.
   */
  initialize(): Promise<void>;

  /**
   * Close the storage backend.
   * Called when shutting down.
   */
  close(): Promise<void>;
}

/*-----------------------------------------------------------------*\
 | Optional Capabilities                                             |
\*-----------------------------------------------------------------*/

/**
 * Optional: Pinning support.
 * Implement if your backend supports pinning (IPFS-like semantics).
 */
export interface IPinnableStorage {
  /**
   * Pin a file to ensure it remains available.
   *
   * @param ref - Content reference string
   * @param metadata - Optional metadata for the pin
   */
  pin(ref: string, metadata?: FileMetadata): Promise<void>;

  /**
   * Unpin a file.
   *
   * @param ref - Content reference string
   */
  unpin(ref: string): Promise<void>;

  /**
   * Get pin status for a file.
   *
   * @param ref - Content reference string
   */
  getPinStatus(ref: string): Promise<PinStatus>;

  /**
   * List all pinned files.
   *
   * @param options - Pagination options
   */
  listPins(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ ref: string; metadata?: FileMetadata }>>;
}

/**
 * Optional: Directory support.
 * Implement if your backend supports directory/folder operations.
 */
export interface IDirectoryStorage {
  /**
   * Upload a directory.
   *
   * @param files - Map of path -> content
   * @returns Content reference for the directory
   */
  uploadDirectory(
    files: Map<string, Buffer>
  ): Promise<UploadResult>;

  /**
   * List files in a directory.
   *
   * @param ref - Directory content reference
   */
  listDirectory(ref: string): Promise<Array<{ name: string; size: number }>>;
}

/*-----------------------------------------------------------------*\
 | Type Guards                                                       |
\*-----------------------------------------------------------------*/

/**
 * Type guard to check if storage supports pinning.
 */
export function supportsPinning(
  storage: IFileStorage
): storage is IFileStorage & IPinnableStorage {
  return (
    "pin" in storage &&
    "unpin" in storage &&
    typeof storage.pin === "function"
  );
}

/**
 * Type guard to check if storage supports directories.
 */
export function supportsDirectories(
  storage: IFileStorage
): storage is IFileStorage & IDirectoryStorage {
  return (
    "uploadDirectory" in storage &&
    typeof storage.uploadDirectory === "function"
  );
}

/**
 * Type guard to check if storage supports streaming.
 */
export function supportsStreaming(
  storage: IFileStorage
): storage is IFileStorage & {
  uploadStream: NonNullable<IFileStorage["uploadStream"]>;
  retrieveStream: NonNullable<IFileStorage["retrieveStream"]>;
} {
  return (
    "uploadStream" in storage &&
    "retrieveStream" in storage &&
    typeof storage.uploadStream === "function" &&
    typeof storage.retrieveStream === "function"
  );
}
