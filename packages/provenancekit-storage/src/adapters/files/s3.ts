/** Amazon S3 content-addressed file storage adapter. */
import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { ContentReference } from "@provenancekit/eaa-types";
import type {
  FileMetadata,
  IFileStorage,
  RetrieveOptions,
  UploadResult,
} from "../../files/interface";
import {
  DownloadError,
  FileNotFoundError,
  FileNotInitializedError,
  UploadError,
} from "../../files/errors";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  prefix?: string;
  client?: S3Client;
  clientConfig?: S3ClientConfig;
}

export class S3Storage implements IFileStorage {
  private readonly bucket: string;
  private readonly region: string;
  private readonly prefix: string;
  private readonly client: S3Client;
  private initialized = false;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.prefix = (config.prefix ?? "objects").replace(/^\/+|\/+$/g, "");
    this.client = config.client ?? new S3Client({ region: config.region, ...config.clientConfig });
  }

  async initialize(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.client.destroy();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new FileNotInitializedError();
  }

  private key(ref: string): string {
    return `${this.prefix}/${ref.replace(/^sha256:/, "")}`;
  }

  async upload(data: Buffer, metadata?: FileMetadata): Promise<UploadResult> {
    this.ensureInitialized();
    const digest = createHash("sha256").update(data).digest("hex");
    const refString = `sha256:${digest}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(refString),
        Body: data,
        ContentType: metadata?.mimeType,
        Metadata: {
          ...(metadata?.metadata ?? {}),
          ...(metadata?.name ? { originalName: metadata.name } : {}),
          sha256: digest,
        },
        ChecksumAlgorithm: "SHA256",
        ServerSideEncryption: "AES256",
      }));
    } catch (error) {
      throw new UploadError("Failed to store content in Amazon S3", error);
    }

    const ref: ContentReference = {
      ref: refString,
      scheme: "hash",
      integrity: refString,
      size: data.length,
    };
    return { ref, size: data.length, gatewayUrl: this.getUrl(refString) };
  }

  async uploadJson(data: unknown, metadata?: FileMetadata): Promise<UploadResult> {
    return this.upload(Buffer.from(JSON.stringify(data)), {
      ...metadata,
      mimeType: metadata?.mimeType ?? "application/json",
    });
  }

  async retrieve(ref: string, _options?: RetrieveOptions): Promise<Buffer> {
    this.ensureInitialized();
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key(ref),
      }));
      if (!response.Body) throw new FileNotFoundError(ref);
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === "NoSuchKey") {
        throw new FileNotFoundError(ref);
      }
      if (error instanceof FileNotFoundError) throw error;
      throw new DownloadError(`Failed to retrieve ${ref} from Amazon S3`, error);
    }
  }

  async retrieveJson<T = unknown>(ref: string, options?: RetrieveOptions): Promise<T> {
    return JSON.parse((await this.retrieve(ref, options)).toString("utf8")) as T;
  }

  getUrl(ref: string): string {
    return `s3://${this.bucket}/${this.key(ref)}`;
  }

  async exists(ref: string): Promise<boolean> {
    this.ensureInitialized();
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(ref) }));
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === "NotFound") return false;
      throw new DownloadError(`Failed to check ${ref} in Amazon S3`, error);
    }
  }
}
