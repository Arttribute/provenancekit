/**
 * IPFS Storage Adapter (Pinata)
 *
 * A Pinata-based implementation of IFileStorage.
 * Uses Pinata's API for IPFS pinning and retrieval.
 *
 * Features:
 * - Content-addressed storage (CIDs)
 * - Configurable gateway for retrieval
 * - Pin management
 *
 * @example
 * ```typescript
 * import { PinataStorage } from "@provenancekit/storage/adapters/files/ipfs-pinata";
 *
 * const storage = new PinataStorage({
 *   jwt: process.env.PINATA_JWT!,
 *   gateway: "https://gateway.pinata.cloud/ipfs",
 * });
 * await storage.initialize();
 *
 * const result = await storage.upload(Buffer.from("Hello!"));
 * console.log("CID:", result.ref.ref);
 * ```
 */

import type { ContentReference } from "@arttribute/eaa-types";

import type {
  IFileStorage,
  IPinnableStorage,
  FileMetadata,
  UploadResult,
  RetrieveOptions,
  PinStatus,
} from "../../files/interface";

import {
  UploadError,
  DownloadError,
  PinError,
  GatewayError,
  FileNotInitializedError,
} from "../../files/errors";

/*-----------------------------------------------------------------*\
 | Configuration Types                                               |
\*-----------------------------------------------------------------*/

/**
 * Pinata storage configuration.
 */
export interface PinataStorageConfig {
  /** Pinata JWT token */
  jwt: string;

  /** Gateway URL for retrieval (without trailing slash) */
  gateway?: string;

  /** Pinata API URL (default: https://api.pinata.cloud) */
  apiUrl?: string;

  /** Custom fetch function (for testing/mocking) */
  fetch?: typeof globalThis.fetch;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/*-----------------------------------------------------------------*\
 | Pinata Storage Implementation                                     |
\*-----------------------------------------------------------------*/

export class PinataStorage implements IFileStorage, IPinnableStorage {
  private jwt: string;
  private gateway: string;
  private apiUrl: string;
  private fetch: typeof globalThis.fetch;
  private timeout: number;
  private initialized = false;

  constructor(config: PinataStorageConfig) {
    this.jwt = config.jwt;
    this.gateway = config.gateway ?? "https://gateway.pinata.cloud/ipfs";
    this.apiUrl = config.apiUrl ?? "https://api.pinata.cloud";
    this.fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeout = config.timeout ?? 30000;
  }

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    // Verify credentials by testing authentication
    try {
      const response = await this.fetch(`${this.apiUrl}/data/testAuthentication`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      this.initialized = true;
    } catch (error) {
      throw new GatewayError("Failed to initialize Pinata storage", error);
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

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.jwt}`,
    };
  }

  /*--------------------------------------------------------------
   | Upload Operations
   --------------------------------------------------------------*/

  async upload(data: Buffer, metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();

    try {
      // Create FormData for file upload
      const formData = new FormData();
      const blob = new Blob([data]);
      formData.append("file", blob, metadata?.name ?? "file");

      // Add pinata metadata if provided
      if (metadata) {
        const pinataMetadata: Record<string, unknown> = {};
        if (metadata.name) {
          pinataMetadata.name = metadata.name;
        }
        if (metadata.metadata) {
          pinataMetadata.keyvalues = metadata.metadata;
        }
        formData.append("pinataMetadata", JSON.stringify(pinataMetadata));
      }

      const response = await this.fetch(`${this.apiUrl}/pinning/pinFileToIPFS`, {
        method: "POST",
        headers: this.getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as PinataUploadResponse;

      const ref: ContentReference = {
        ref: result.IpfsHash,
        scheme: "cid",
        size: result.PinSize,
      };

      return {
        ref,
        size: result.PinSize,
        gatewayUrl: `${this.gateway}/${result.IpfsHash}`,
      };
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError("Failed to upload file to Pinata", error);
    }
  }

  async uploadJson(data: unknown, metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();

    try {
      const body: Record<string, unknown> = {
        pinataContent: data,
      };

      if (metadata) {
        const pinataMetadata: Record<string, unknown> = {};
        if (metadata.name) {
          pinataMetadata.name = metadata.name;
        }
        if (metadata.metadata) {
          pinataMetadata.keyvalues = metadata.metadata;
        }
        body.pinataMetadata = pinataMetadata;
      }

      const response = await this.fetch(`${this.apiUrl}/pinning/pinJSONToIPFS`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as PinataUploadResponse;

      const ref: ContentReference = {
        ref: result.IpfsHash,
        scheme: "cid",
        size: result.PinSize,
      };

      return {
        ref,
        size: result.PinSize,
        gatewayUrl: `${this.gateway}/${result.IpfsHash}`,
      };
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError("Failed to upload JSON to Pinata", error);
    }
  }

  /*--------------------------------------------------------------
   | Retrieval Operations
   --------------------------------------------------------------*/

  async retrieve(ref: string, options?: RetrieveOptions): Promise<Buffer> {
    this.ensureInitialized();

    const gateway = options?.gateway ?? this.gateway;
    const url = `${gateway}/${ref}`;

    try {
      const controller = new AbortController();
      const timeout = options?.timeout ?? this.timeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await this.fetch(url, {
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

  /*--------------------------------------------------------------
   | Status Operations
   --------------------------------------------------------------*/

  async exists(ref: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Check if we have it pinned
      const response = await this.fetch(
        `${this.apiUrl}/data/pinList?hashContains=${ref}&status=pinned`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as PinataPinListResponse;
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  /*--------------------------------------------------------------
   | Pinning Operations (IPinnableStorage)
   --------------------------------------------------------------*/

  async pin(ref: string, metadata?: FileMetadata): Promise<void> {
    this.ensureInitialized();

    try {
      const body: Record<string, unknown> = {
        hashToPin: ref,
      };

      if (metadata) {
        const pinataMetadata: Record<string, unknown> = {};
        if (metadata.name) {
          pinataMetadata.name = metadata.name;
        }
        if (metadata.metadata) {
          pinataMetadata.keyvalues = metadata.metadata;
        }
        body.pinataMetadata = pinataMetadata;
      }

      const response = await this.fetch(`${this.apiUrl}/pinning/pinByHash`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pin failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      if (error instanceof PinError) throw error;
      throw new PinError(`Failed to pin: ${ref}`, error);
    }
  }

  async unpin(ref: string): Promise<void> {
    this.ensureInitialized();

    try {
      const response = await this.fetch(`${this.apiUrl}/pinning/unpin/${ref}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Unpin failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      if (error instanceof PinError) throw error;
      throw new PinError(`Failed to unpin: ${ref}`, error);
    }
  }

  async getPinStatus(ref: string): Promise<PinStatus> {
    this.ensureInitialized();

    try {
      const response = await this.fetch(
        `${this.apiUrl}/data/pinList?hashContains=${ref}&status=pinned`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return { pinned: false };
      }

      const result = (await response.json()) as PinataPinListResponse;

      if (result.rows.length === 0) {
        return { pinned: false };
      }

      const pin = result.rows[0];
      return {
        pinned: true,
        pinnedAt: new Date(pin.date_pinned),
        size: pin.size,
      };
    } catch {
      return { pinned: false };
    }
  }

  async listPins(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ ref: string; metadata?: FileMetadata }>> {
    this.ensureInitialized();

    try {
      const params = new URLSearchParams({
        status: "pinned",
        pageLimit: String(options?.limit ?? 100),
        pageOffset: String(options?.offset ?? 0),
      });

      const response = await this.fetch(
        `${this.apiUrl}/data/pinList?${params}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return [];
      }

      const result = (await response.json()) as PinataPinListResponse;

      return result.rows.map((pin) => ({
        ref: pin.ipfs_pin_hash,
        metadata: pin.metadata?.name
          ? {
              name: pin.metadata.name,
              metadata: pin.metadata.keyvalues,
            }
          : undefined,
      }));
    } catch {
      return [];
    }
  }
}

/*-----------------------------------------------------------------*\
 | Pinata API Types (internal)                                       |
\*-----------------------------------------------------------------*/

interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface PinataPinListResponse {
  rows: Array<{
    id: string;
    ipfs_pin_hash: string;
    size: number;
    date_pinned: string;
    metadata?: {
      name?: string;
      keyvalues?: Record<string, string>;
    };
  }>;
  count: number;
}
