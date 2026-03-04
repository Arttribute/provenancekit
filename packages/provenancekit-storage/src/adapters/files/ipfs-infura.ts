/**
 * Infura IPFS Storage Adapter
 *
 * An Infura-based implementation of IFileStorage.
 * Uses Infura's IPFS API for pinning and retrieval.
 *
 * @example
 * ```typescript
 * import { InfuraIPFSStorage } from "@provenancekit/storage/adapters/files/ipfs-infura";
 *
 * const storage = new InfuraIPFSStorage({
 *   projectId: process.env.INFURA_PROJECT_ID!,
 *   projectSecret: process.env.INFURA_PROJECT_SECRET!,
 * });
 * await storage.initialize();
 * ```
 */

import type { ContentReference } from "@provenancekit/eaa-types";

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

export interface InfuraIPFSStorageConfig {
  /** Infura Project ID */
  projectId: string;

  /** Infura Project Secret */
  projectSecret: string;

  /** Gateway URL (default: https://ipfs.infura.io/ipfs) */
  gateway?: string;

  /** API URL (default: https://ipfs.infura.io:5001) */
  apiUrl?: string;

  /** Custom fetch function */
  fetch?: typeof globalThis.fetch;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/*-----------------------------------------------------------------*\
 | Infura IPFS Storage Implementation                                |
\*-----------------------------------------------------------------*/

export class InfuraIPFSStorage implements IFileStorage, IPinnableStorage {
  private projectId: string;
  private projectSecret: string;
  private gateway: string;
  private apiUrl: string;
  private fetchFn: typeof globalThis.fetch;
  private timeout: number;
  private initialized = false;

  constructor(config: InfuraIPFSStorageConfig) {
    this.projectId = config.projectId;
    this.projectSecret = config.projectSecret;
    this.gateway = config.gateway ?? "https://ipfs.infura.io/ipfs";
    this.apiUrl = config.apiUrl ?? "https://ipfs.infura.io:5001";
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeout = config.timeout ?? 30000;
  }

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  async initialize(): Promise<void> {
    try {
      // Test credentials by calling version endpoint
      const response = await this.fetchFn(`${this.apiUrl}/api/v0/version`, {
        method: "POST",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      this.initialized = true;
    } catch (error) {
      throw new GatewayError(
        "Failed to initialize Infura IPFS storage",
        error
      );
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
    const auth = Buffer.from(
      `${this.projectId}:${this.projectSecret}`
    ).toString("base64");
    return {
      Authorization: `Basic ${auth}`,
    };
  }

  /*--------------------------------------------------------------
   | Upload Operations
   --------------------------------------------------------------*/

  async upload(data: Buffer, metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();

    try {
      const formData = new FormData();
      const blob = new Blob([data]);
      formData.append("file", blob, metadata?.name ?? "file");

      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/add?pin=true`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as InfuraAddResponse;

      const ref: ContentReference = {
        ref: result.Hash,
        scheme: "cid",
        size: parseInt(result.Size, 10),
      };

      return {
        ref,
        size: parseInt(result.Size, 10),
        gatewayUrl: `${this.gateway}/${result.Hash}`,
      };
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError("Failed to upload file to Infura IPFS", error);
    }
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

  /*--------------------------------------------------------------
   | Status Operations
   --------------------------------------------------------------*/

  async exists(ref: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/pin/ls?arg=${ref}`,
        {
          method: "POST",
          headers: this.getHeaders(),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /*--------------------------------------------------------------
   | Pinning Operations
   --------------------------------------------------------------*/

  async pin(ref: string, _metadata?: FileMetadata): Promise<void> {
    this.ensureInitialized();

    try {
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/pin/add?arg=${ref}`,
        {
          method: "POST",
          headers: this.getHeaders(),
        }
      );

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
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/pin/rm?arg=${ref}`,
        {
          method: "POST",
          headers: this.getHeaders(),
        }
      );

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
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/pin/ls?arg=${ref}`,
        {
          method: "POST",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        return { pinned: false };
      }

      return { pinned: true };
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
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/pin/ls?type=recursive`,
        {
          method: "POST",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        return [];
      }

      const result = (await response.json()) as {
        Keys: Record<string, { Type: string }>;
      };
      const pins = Object.keys(result.Keys ?? {}).map((ref) => ({ ref }));

      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? pins.length;

      return pins.slice(offset, offset + limit);
    } catch {
      return [];
    }
  }
}

/*-----------------------------------------------------------------*\
 | Infura API Types (internal)                                       |
\*-----------------------------------------------------------------*/

interface InfuraAddResponse {
  Hash: string;
  Size: string;
  Name: string;
}
