/**
 * Encrypted File Storage Wrapper
 *
 * Wraps any IFileStorage implementation to provide transparent encryption/decryption.
 * Files are encrypted before upload and decrypted after download.
 */

import { sha256 } from "@noble/hashes/sha256";

import type {
  CipherAlgorithm,
  EncryptionMetadata,
  EncryptionEnvelope,
  KeyDerivationMethod,
} from "./types.js";

import {
  encrypt,
  decrypt,
  toEnvelope,
  fromEnvelope,
  toBase64,
  DEFAULT_ALGORITHM,
  generateKey,
} from "./ciphers.js";

import { bytesToHex } from "./keys.js";

/*─────────────────────────────────────────────────────────────*\
 | Types (Re-exported from storage for convenience)             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Minimal file storage interface (subset of IFileStorage)
 * This allows using the wrapper without a full dependency on @provenancekit/storage
 */
export interface MinimalFileStorage {
  upload(data: Buffer, metadata?: { name?: string; mimeType?: string }): Promise<{
    ref: { ref: string; scheme: string };
    size: number;
    gatewayUrl?: string;
  }>;
  retrieve(ref: string): Promise<Buffer>;
  uploadJson(data: unknown): Promise<{
    ref: { ref: string; scheme: string };
    size: number;
    gatewayUrl?: string;
  }>;
  retrieveJson<T = unknown>(ref: string): Promise<T>;
  getUrl(ref: string): string;
  exists(ref: string): Promise<boolean>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

/*─────────────────────────────────────────────────────────────*\
 | Encrypted Upload Result                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Result of an encrypted file upload
 */
export interface EncryptedUploadResult {
  /** Content reference of the encrypted data */
  ref: { ref: string; scheme: string };
  /** Size of encrypted data */
  encryptedSize: number;
  /** Size of original data */
  originalSize: number;
  /** Encryption metadata (needed for decryption) */
  metadata: EncryptionMetadata;
  /** Encryption envelope (for decryption without metadata lookup) */
  envelope: EncryptionEnvelope;
  /** Gateway URL (if available) */
  gatewayUrl?: string;
}

/**
 * Options for encrypted upload
 */
export interface EncryptedUploadOptions {
  /** Encryption key (32 bytes) */
  key: Uint8Array;
  /** Key derivation method used (for metadata) */
  keyMethod?: KeyDerivationMethod;
  /** Salt used in key derivation (for metadata) */
  salt?: Uint8Array;
  /** Cipher algorithm */
  algorithm?: CipherAlgorithm;
  /** Original content type */
  contentType?: string;
  /** Original filename */
  filename?: string;
}

/**
 * Options for encrypted download
 */
export interface EncryptedDownloadOptions {
  /** Decryption key (32 bytes) */
  key: Uint8Array;
  /** Encryption envelope (if known) */
  envelope?: EncryptionEnvelope;
}

/*─────────────────────────────────────────────────────────────*\
 | Encrypted File Storage Wrapper                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Wraps a file storage backend with encryption
 *
 * @example
 * ```ts
 * import { PinataStorage } from "@provenancekit/storage/adapters/files/ipfs-pinata";
 * import { EncryptedFileStorage } from "@provenancekit/privacy";
 *
 * const pinata = new PinataStorage({ jwt: "..." });
 * const encrypted = new EncryptedFileStorage(pinata);
 *
 * const key = generateKey();
 * const result = await encrypted.uploadEncrypted(
 *   Buffer.from("secret data"),
 *   { key }
 * );
 *
 * // Store result.envelope for later decryption
 * const data = await encrypted.downloadDecrypted(result.ref.ref, { key, envelope: result.envelope });
 * ```
 */
export class EncryptedFileStorage {
  constructor(private readonly storage: MinimalFileStorage) {}

  /**
   * Initialize the underlying storage
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /**
   * Close the underlying storage
   */
  async close(): Promise<void> {
    await this.storage.close();
  }

  /**
   * Upload data with encryption
   */
  async uploadEncrypted(
    data: Buffer,
    options: EncryptedUploadOptions
  ): Promise<EncryptedUploadResult> {
    const algorithm = options.algorithm ?? DEFAULT_ALGORITHM;

    // Hash original data for integrity check
    const originalHash = bytesToHex(sha256(data));

    // Encrypt the data
    const encryptionResult = encrypt(new Uint8Array(data), options.key, algorithm);

    // Create envelope for decryption info
    const envelope = toEnvelope(encryptionResult);

    // Create metadata
    const metadata: EncryptionMetadata = {
      algorithm,
      keyAccess: options.keyMethod ?? "direct",
      originalHash,
      contentType: options.contentType,
      originalSize: data.length,
      encryptedAt: new Date().toISOString(),
    };

    if (options.salt) {
      metadata.salt = toBase64(options.salt);
    }

    // Upload encrypted data
    const uploadResult = await this.storage.upload(
      Buffer.from(encryptionResult.ciphertext),
      {
        name: options.filename ? `${options.filename}.encrypted` : undefined,
        mimeType: "application/octet-stream",
      }
    );

    return {
      ref: uploadResult.ref,
      encryptedSize: uploadResult.size,
      originalSize: data.length,
      metadata,
      envelope,
      gatewayUrl: uploadResult.gatewayUrl,
    };
  }

  /**
   * Download and decrypt data
   */
  async downloadDecrypted(
    ref: string,
    options: EncryptedDownloadOptions
  ): Promise<Buffer> {
    // Download encrypted data
    const encryptedData = await this.storage.retrieve(ref);

    if (!options.envelope) {
      throw new Error(
        "Encryption envelope required for decryption. " +
          "Store the envelope from uploadEncrypted() result."
      );
    }

    // Parse envelope
    const { nonce, algorithm } = fromEnvelope(options.envelope);

    // Decrypt
    const decrypted = decrypt(
      new Uint8Array(encryptedData),
      options.key,
      nonce,
      algorithm
    );

    return Buffer.from(decrypted);
  }

  /**
   * Upload JSON with encryption
   */
  async uploadEncryptedJson<T>(
    data: T,
    options: EncryptedUploadOptions
  ): Promise<EncryptedUploadResult> {
    const json = JSON.stringify(data);
    return this.uploadEncrypted(Buffer.from(json, "utf-8"), {
      ...options,
      contentType: "application/json",
    });
  }

  /**
   * Download and decrypt JSON
   */
  async downloadDecryptedJson<T>(
    ref: string,
    options: EncryptedDownloadOptions
  ): Promise<T> {
    const data = await this.downloadDecrypted(ref, options);
    return JSON.parse(data.toString("utf-8")) as T;
  }

  /**
   * Check if encrypted file exists
   */
  async exists(ref: string): Promise<boolean> {
    return this.storage.exists(ref);
  }

  /**
   * Get URL for encrypted file (will return encrypted bytes, not plaintext)
   */
  getUrl(ref: string): string {
    return this.storage.getUrl(ref);
  }

  /**
   * Access the underlying storage for non-encrypted operations
   */
  getUnderlyingStorage(): MinimalFileStorage {
    return this.storage;
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Metadata Storage Helpers                                     |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create an ext:storage@1.0.0 extension with encryption metadata
 */
export function createEncryptedStorageExtension(
  result: EncryptedUploadResult,
  provider: string
): Record<string, unknown> {
  return {
    "ext:storage@1.0.0": {
      pinned: true,
      encrypted: true,
      contentType: result.metadata.contentType,
      replicas: [{ provider, status: "active" }],
      encryption: {
        algorithm: result.metadata.algorithm,
        keyAccess: result.metadata.keyAccess,
        salt: result.metadata.salt,
        originalHash: result.metadata.originalHash,
        originalSize: result.metadata.originalSize,
        encryptedAt: result.metadata.encryptedAt,
      },
      // Store envelope inline for self-contained decryption
      envelope: result.envelope,
    },
  };
}

/**
 * Extract encryption envelope from ext:storage@1.0.0 extension
 */
export function extractEnvelopeFromExtension(
  extensions: Record<string, unknown> | undefined
): EncryptionEnvelope | undefined {
  if (!extensions) return undefined;

  const storage = extensions["ext:storage@1.0.0"] as
    | { envelope?: EncryptionEnvelope }
    | undefined;

  return storage?.envelope;
}

/*─────────────────────────────────────────────────────────────*\
 | Convenience Functions                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Generate an encryption key for file storage
 * (Re-exported for convenience)
 */
export { generateKey };

/**
 * Quick encrypt and upload
 */
export async function encryptAndUpload(
  storage: MinimalFileStorage,
  data: Buffer,
  key: Uint8Array,
  options?: Partial<EncryptedUploadOptions>
): Promise<EncryptedUploadResult> {
  const encrypted = new EncryptedFileStorage(storage);
  return encrypted.uploadEncrypted(data, { key, ...options });
}

/**
 * Quick download and decrypt
 */
export async function downloadAndDecrypt(
  storage: MinimalFileStorage,
  ref: string,
  key: Uint8Array,
  envelope: EncryptionEnvelope
): Promise<Buffer> {
  const encrypted = new EncryptedFileStorage(storage);
  return encrypted.downloadDecrypted(ref, { key, envelope });
}
