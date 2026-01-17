/**
 * Web3.Storage Adapter
 *
 * A web3.storage implementation of IFileStorage.
 * Uses the web3.storage API for decentralized storage.
 *
 * @example
 * ```typescript
 * import { Web3StorageStorage } from "@provenancekit/storage/adapters/files/web3storage";
 *
 * const storage = new Web3StorageStorage({
 *   token: process.env.W3S_TOKEN!,
 * });
 * await storage.initialize();
 * ```
 */

import type { ContentReference } from "@arttribute/eaa-types";

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

export interface Web3StorageConfig {
  /** Web3.Storage API token */
  token: string;

  /** Gateway URL (default: https://w3s.link/ipfs) */
  gateway?: string;

  /** API URL (default: https://api.web3.storage) */
  apiUrl?: string;

  /** Custom fetch function */
  fetch?: typeof globalThis.fetch;

  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
}

/*-----------------------------------------------------------------*\
 | Web3.Storage Implementation                                       |
\*-----------------------------------------------------------------*/

export class Web3StorageStorage implements IFileStorage {
  private token: string;
  private gateway: string;
  private apiUrl: string;
  private fetchFn: typeof globalThis.fetch;
  private timeout: number;
  private initialized = false;

  constructor(config: Web3StorageConfig) {
    this.token = config.token;
    this.gateway = config.gateway ?? "https://w3s.link/ipfs";
    this.apiUrl = config.apiUrl ?? "https://api.web3.storage";
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeout = config.timeout ?? 60000;
  }

  async initialize(): Promise<void> {
    try {
      // Verify token by calling user endpoint
      const response = await this.fetchFn(`${this.apiUrl}/user/account`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      this.initialized = true;
    } catch (error) {
      throw new GatewayError("Failed to initialize Web3.Storage", error);
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
      Authorization: `Bearer ${this.token}`,
    };
  }

  async upload(data: Buffer, metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();

    try {
      const blob = new Blob([data]);
      const file = new File([blob], metadata?.name ?? "file", {
        type: metadata?.mimeType,
      });

      const response = await this.fetchFn(`${this.apiUrl}/upload`, {
        method: "POST",
        headers: this.getHeaders(),
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as { cid: string };

      const ref: ContentReference = {
        ref: result.cid,
        scheme: "cid",
        size: data.length,
      };

      return {
        ref,
        size: data.length,
        gatewayUrl: `${this.gateway}/${result.cid}`,
      };
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError("Failed to upload to Web3.Storage", error);
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
      const response = await this.fetchFn(`${this.apiUrl}/status/${ref}`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
