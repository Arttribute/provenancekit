/**
 * Arweave Storage Adapter
 *
 * An Arweave implementation of IFileStorage.
 * Uses Arweave for permanent, immutable storage.
 *
 * Note: Full upload support requires the arweave-js SDK or Bundlr/Irys.
 * This adapter provides retrieval and basic functionality.
 *
 * @example
 * ```typescript
 * import { ArweaveStorage } from "@provenancekit/storage/adapters/files/arweave";
 *
 * const storage = new ArweaveStorage({
 *   gateway: "https://arweave.net",
 * });
 * await storage.initialize();
 *
 * // Retrieve existing content
 * const data = await storage.retrieve("tx-id-here");
 * ```
 */

import type { ContentReference } from "@provenancekit/eaa-types";

import type {
  IFileStorage,
  FileMetadata,
  UploadResult,
  RetrieveOptions,
} from "../../files/interface";

import {
  UploadError,
  DownloadError,
  GatewayError,
  FileNotInitializedError,
} from "../../files/errors";

/*-----------------------------------------------------------------*\
 | Configuration Types                                               |
\*-----------------------------------------------------------------*/

/**
 * Arweave JWK wallet key type
 */
export interface ArweaveJWK {
  kty: string;
  n: string;
  e: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}

export interface ArweaveStorageConfig {
  /** Arweave gateway URL (default: https://arweave.net) */
  gateway?: string;

  /** Wallet JWK for signing transactions (required for uploads) */
  walletKey?: ArweaveJWK;

  /** Custom fetch function */
  fetch?: typeof globalThis.fetch;

  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Bundlr/Irys node URL for bundled uploads (optional) */
  bundlrUrl?: string;
}

/*-----------------------------------------------------------------*\
 | Arweave Storage Implementation                                    |
\*-----------------------------------------------------------------*/

export class ArweaveStorage implements IFileStorage {
  private gateway: string;
  private walletKey?: ArweaveJWK;
  private fetchFn: typeof globalThis.fetch;
  private timeout: number;
  private initialized = false;

  constructor(config: ArweaveStorageConfig) {
    this.gateway = config.gateway ?? "https://arweave.net";
    this.walletKey = config.walletKey;
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeout = config.timeout ?? 60000;
  }

  async initialize(): Promise<void> {
    try {
      // Test gateway by fetching network info
      const response = await this.fetchFn(`${this.gateway}/info`);

      if (!response.ok) {
        throw new Error(`Gateway check failed: ${response.statusText}`);
      }

      this.initialized = true;
    } catch (error) {
      throw new GatewayError("Failed to initialize Arweave storage", error);
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new FileNotInitializedError();
    }
  }

  async upload(_data: Buffer, _metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();

    if (!this.walletKey) {
      throw new UploadError("Wallet key required for uploads");
    }

    // Note: Full Arweave upload requires transaction signing with arweave-js
    // This is a placeholder - users should use arweave-js or Bundlr directly
    throw new UploadError(
      "Direct Arweave uploads require arweave-js SDK. " +
        "Consider using Bundlr/Irys for easier uploads, or provide a signed transaction."
    );
  }

  async uploadJson(
    data: unknown,
    metadata?: FileMetadata
  ): Promise<UploadResult> {
    const json = JSON.stringify(data);
    const buffer = Buffer.from(json, "utf-8");
    return this.upload(buffer, {
      ...metadata,
      mimeType: metadata?.mimeType ?? "application/json",
    });
  }

  async retrieve(ref: string, options?: RetrieveOptions): Promise<Buffer> {
    this.ensureInitialized();

    const gateway = options?.gateway ?? this.gateway;
    const url = `${gateway}/${ref}`;

    try {
      const controller = new AbortController();
      const timeout = options?.timeout ?? this.timeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await this.fetchFn(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Retrieval failed: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new DownloadError(`Failed to retrieve file: ${ref}`, error);
    }
  }

  async retrieveJson<T = unknown>(
    ref: string,
    options?: RetrieveOptions
  ): Promise<T> {
    const buffer = await this.retrieve(ref, options);
    try {
      return JSON.parse(buffer.toString("utf-8")) as T;
    } catch (error) {
      throw new DownloadError(`Failed to parse JSON from: ${ref}`, error);
    }
  }

  getUrl(ref: string): string {
    return `${this.gateway}/${ref}`;
  }

  async exists(ref: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const response = await this.fetchFn(`${this.gateway}/tx/${ref}/status`);
      if (!response.ok) return false;

      const result = (await response.json()) as {
        status?: number;
        confirmed?: { number_of_confirmations: number };
      };

      // Transaction is confirmed if it has confirmations
      return (
        result.status === 200 ||
        (result.confirmed?.number_of_confirmations ?? 0) > 0
      );
    } catch {
      return false;
    }
  }

  /**
   * Create a ContentReference for an existing Arweave transaction.
   * Useful for registering pre-uploaded content.
   *
   * @param txId - The Arweave transaction ID
   * @param size - Optional size in bytes
   * @returns ContentReference with ar:// scheme
   */
  createRef(txId: string, size?: number): ContentReference {
    return {
      ref: txId,
      scheme: "ar",
      size,
    };
  }

  /**
   * Get transaction metadata from Arweave.
   *
   * @param txId - The transaction ID
   * @returns Transaction metadata or null if not found
   */
  async getTransactionInfo(
    txId: string
  ): Promise<{ size: number; contentType?: string } | null> {
    this.ensureInitialized();

    try {
      const response = await this.fetchFn(`${this.gateway}/tx/${txId}`);
      if (!response.ok) return null;

      const tx = (await response.json()) as {
        data_size: string;
        tags?: Array<{ name: string; value: string }>;
      };

      const contentTypeTag = tx.tags?.find(
        (t) => t.name === "Q29udGVudC1UeXBl" // Base64 for "Content-Type"
      );

      return {
        size: parseInt(tx.data_size, 10),
        contentType: contentTypeTag
          ? Buffer.from(contentTypeTag.value, "base64").toString("utf-8")
          : undefined,
      };
    } catch {
      return null;
    }
  }
}
