/**
 * Local IPFS Storage Adapter
 *
 * An implementation for self-hosted IPFS nodes.
 * Connects to a local or remote IPFS HTTP API.
 *
 * @example
 * ```typescript
 * import { LocalIPFSStorage } from "@provenancekit/storage/adapters/files/ipfs-local";
 *
 * const storage = new LocalIPFSStorage({
 *   apiUrl: "http://localhost:5001",
 *   gateway: "http://localhost:8080/ipfs",
 * });
 * await storage.initialize();
 * ```
 */

import type { ContentReference } from "@arttribute/eaa-types";

import type {
  IFileStorage,
  IPinnableStorage,
  IDirectoryStorage,
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

export interface LocalIPFSStorageConfig {
  /** IPFS HTTP API URL (default: http://127.0.0.1:5001) */
  apiUrl?: string;

  /** Gateway URL for retrieval (default: http://127.0.0.1:8080/ipfs) */
  gateway?: string;

  /** Custom fetch function */
  fetch?: typeof globalThis.fetch;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Optional API authentication headers */
  headers?: Record<string, string>;
}

/*-----------------------------------------------------------------*\
 | Local IPFS Storage Implementation                                 |
\*-----------------------------------------------------------------*/

export class LocalIPFSStorage
  implements IFileStorage, IPinnableStorage, IDirectoryStorage
{
  private apiUrl: string;
  private gateway: string;
  private fetchFn: typeof globalThis.fetch;
  private timeout: number;
  private headers: Record<string, string>;
  private initialized = false;

  constructor(config: LocalIPFSStorageConfig) {
    this.apiUrl = config.apiUrl ?? "http://127.0.0.1:5001";
    this.gateway = config.gateway ?? "http://127.0.0.1:8080/ipfs";
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeout = config.timeout ?? 30000;
    this.headers = config.headers ?? {};
  }

  async initialize(): Promise<void> {
    try {
      const response = await this.fetchFn(`${this.apiUrl}/api/v0/version`, {
        method: "POST",
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`IPFS node check failed: ${response.statusText}`);
      }

      this.initialized = true;
    } catch (error) {
      throw new GatewayError("Failed to connect to local IPFS node", error);
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
          headers: this.headers,
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as IPFSAddResponse;

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
      throw new UploadError("Failed to upload to local IPFS", error);
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
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/pin/ls?arg=${ref}&type=all`,
        { method: "POST", headers: this.headers }
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
          headers: this.headers,
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
          headers: this.headers,
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
        `${this.apiUrl}/api/v0/pin/ls?arg=${ref}&type=all`,
        { method: "POST", headers: this.headers }
      );

      if (!response.ok) {
        return { pinned: false };
      }

      const result = (await response.json()) as {
        Keys?: Record<string, unknown>;
      };
      return { pinned: !!result.Keys?.[ref] };
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
          headers: this.headers,
        }
      );

      if (!response.ok) {
        return [];
      }

      const result = (await response.json()) as {
        Keys?: Record<string, unknown>;
      };
      const pins = Object.keys(result.Keys ?? {}).map((ref) => ({ ref }));

      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? pins.length;

      return pins.slice(offset, offset + limit);
    } catch {
      return [];
    }
  }

  /*--------------------------------------------------------------
   | Directory Operations
   --------------------------------------------------------------*/

  async uploadDirectory(files: Map<string, Buffer>): Promise<UploadResult> {
    this.ensureInitialized();

    try {
      const formData = new FormData();

      for (const [path, data] of files) {
        const blob = new Blob([data]);
        formData.append("file", blob, path);
      }

      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/add?wrap-with-directory=true&pin=true`,
        {
          method: "POST",
          headers: this.headers,
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Directory upload failed: ${response.status} - ${errorText}`
        );
      }

      // IPFS returns multiple lines (one per file), last is the directory
      const text = await response.text();
      const lines = text.trim().split("\n");
      const lastLine = JSON.parse(lines[lines.length - 1]) as IPFSAddResponse;

      const ref: ContentReference = {
        ref: lastLine.Hash,
        scheme: "cid",
      };

      return {
        ref,
        size: parseInt(lastLine.Size, 10),
        gatewayUrl: `${this.gateway}/${lastLine.Hash}`,
      };
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError("Failed to upload directory", error);
    }
  }

  async listDirectory(
    ref: string
  ): Promise<Array<{ name: string; size: number }>> {
    this.ensureInitialized();

    try {
      const response = await this.fetchFn(
        `${this.apiUrl}/api/v0/ls?arg=${ref}`,
        {
          method: "POST",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        return [];
      }

      const result = (await response.json()) as {
        Objects?: Array<{
          Links?: Array<{ Name: string; Size: number }>;
        }>;
      };

      return (result.Objects?.[0]?.Links ?? []).map((link) => ({
        name: link.Name,
        size: link.Size,
      }));
    } catch {
      return [];
    }
  }
}

/*-----------------------------------------------------------------*\
 | IPFS API Types (internal)                                         |
\*-----------------------------------------------------------------*/

interface IPFSAddResponse {
  Hash: string;
  Size: string;
  Name: string;
}
