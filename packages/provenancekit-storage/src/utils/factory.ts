/**
 * Storage Factory
 *
 * Easy instantiation of storage adapters from configuration objects.
 * Enables configuration-driven storage setup.
 */

import type { IProvenanceStorage } from "../db/interface";
import type { IFileStorage } from "../files/interface";

/*-----------------------------------------------------------------*\
 | Configuration Types                                               |
\*-----------------------------------------------------------------*/

/**
 * Memory database storage configuration
 */
export interface MemoryDbConfig {
  type: "memory";
}

/**
 * PostgreSQL database storage configuration
 */
export interface PostgresDbConfig {
  type: "postgres";
  /** Query function for executing SQL */
  query: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => Promise<T[]>;
  /** Optional transaction wrapper */
  transaction?: <T>(
    fn: (
      query: <T = Record<string, unknown>>(
        text: string,
        params?: unknown[]
      ) => Promise<T[]>
    ) => Promise<T>
  ) => Promise<T>;
  /** Table name prefix (default: "pk_") */
  tablePrefix?: string;
  /** Whether to auto-create tables (default: true) */
  autoMigrate?: boolean;
}

/**
 * MongoDB database storage configuration
 */
export interface MongoDbConfig {
  type: "mongodb";
  /** MongoDB database instance */
  db: unknown;
  /** Collection name prefix (default: "pk_") */
  collectionPrefix?: string;
  /** Whether to auto-create indexes (default: true) */
  autoIndex?: boolean;
}

/**
 * Supabase database storage configuration
 */
export interface SupabaseDbConfig {
  type: "supabase";
  /** Supabase client instance */
  client: unknown;
  /** Table name prefix (default: "pk_") */
  tablePrefix?: string;
  /** Enable vector search (default: false) */
  enableVectors?: boolean;
  /** Vector embedding dimension (default: 1536) */
  vectorDimension?: number;
}

/**
 * Database storage configuration union type
 */
export type DbStorageConfig =
  | MemoryDbConfig
  | PostgresDbConfig
  | MongoDbConfig
  | SupabaseDbConfig;

/**
 * Memory file storage configuration
 */
export interface MemoryFileConfig {
  type: "memory";
}

/**
 * Pinata IPFS file storage configuration
 */
export interface PinataFileConfig {
  type: "pinata";
  /** Pinata JWT token */
  jwt: string;
  /** Gateway URL */
  gateway?: string;
  /** API URL */
  apiUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Infura IPFS file storage configuration
 */
export interface InfuraFileConfig {
  type: "infura";
  /** Infura Project ID */
  projectId: string;
  /** Infura Project Secret */
  projectSecret: string;
  /** Gateway URL */
  gateway?: string;
  /** API URL */
  apiUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Web3.Storage file storage configuration
 */
export interface Web3StorageFileConfig {
  type: "web3storage";
  /** Web3.Storage API token */
  token: string;
  /** Gateway URL */
  gateway?: string;
  /** API URL */
  apiUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Arweave file storage configuration
 */
export interface ArweaveFileConfig {
  type: "arweave";
  /** Gateway URL */
  gateway?: string;
  /** Wallet JWK for signing transactions */
  walletKey?: unknown;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Local IPFS file storage configuration
 */
export interface LocalIpfsFileConfig {
  type: "ipfs-local";
  /** IPFS HTTP API URL */
  apiUrl?: string;
  /** Gateway URL */
  gateway?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Optional authentication headers */
  headers?: Record<string, string>;
}

/**
 * File storage configuration union type
 */
export type FileStorageConfig =
  | MemoryFileConfig
  | PinataFileConfig
  | InfuraFileConfig
  | Web3StorageFileConfig
  | ArweaveFileConfig
  | LocalIpfsFileConfig;

/*-----------------------------------------------------------------*\
 | Factory Functions                                                 |
\*-----------------------------------------------------------------*/

/**
 * Create a database storage adapter from configuration.
 *
 * @param config - Storage configuration
 * @returns Initialized storage adapter
 *
 * @example
 * ```typescript
 * const storage = await createDbStorage({ type: "memory" });
 *
 * // Or with PostgreSQL
 * const storage = await createDbStorage({
 *   type: "postgres",
 *   query: async (sql, params) => db.query(sql, params),
 * });
 * ```
 */
export async function createDbStorage(
  config: DbStorageConfig
): Promise<IProvenanceStorage> {
  let storage: IProvenanceStorage;

  switch (config.type) {
    case "memory": {
      const { MemoryDbStorage } = await import("../adapters/db/memory");
      storage = new MemoryDbStorage();
      break;
    }
    case "postgres": {
      const { PostgresStorage } = await import("../adapters/db/postgres");
      storage = new PostgresStorage({
        query: config.query,
        transaction: config.transaction,
        tablePrefix: config.tablePrefix,
        autoMigrate: config.autoMigrate,
      });
      break;
    }
    case "mongodb": {
      const { MongoDBStorage } = await import("../adapters/db/mongodb");
      storage = new MongoDBStorage({
        db: config.db as ConstructorParameters<typeof MongoDBStorage>[0]["db"],
        collectionPrefix: config.collectionPrefix,
        autoIndex: config.autoIndex,
      });
      break;
    }
    case "supabase": {
      const { SupabaseStorage } = await import("../adapters/db/supabase");
      storage = new SupabaseStorage({
        client: config.client as ConstructorParameters<typeof SupabaseStorage>[0]["client"],
        tablePrefix: config.tablePrefix,
        enableVectors: config.enableVectors,
        vectorDimension: config.vectorDimension,
      });
      break;
    }
    default:
      throw new Error(
        `Unknown database storage type: ${(config as { type: string }).type}`
      );
  }

  await storage.initialize();
  return storage;
}

/**
 * Create a file storage adapter from configuration.
 *
 * @param config - Storage configuration
 * @returns Initialized storage adapter
 *
 * @example
 * ```typescript
 * const storage = await createFileStorage({
 *   type: "pinata",
 *   jwt: process.env.PINATA_JWT!,
 * });
 * ```
 */
export async function createFileStorage(
  config: FileStorageConfig
): Promise<IFileStorage> {
  let storage: IFileStorage;

  switch (config.type) {
    case "memory": {
      const { MemoryFileStorage } = await import("../adapters/files/memory");
      storage = new MemoryFileStorage();
      break;
    }
    case "pinata": {
      const { PinataStorage } = await import("../adapters/files/ipfs-pinata");
      storage = new PinataStorage({
        jwt: config.jwt,
        gateway: config.gateway,
        apiUrl: config.apiUrl,
        timeout: config.timeout,
      });
      break;
    }
    case "infura": {
      const { InfuraIPFSStorage } = await import(
        "../adapters/files/ipfs-infura"
      );
      storage = new InfuraIPFSStorage({
        projectId: config.projectId,
        projectSecret: config.projectSecret,
        gateway: config.gateway,
        apiUrl: config.apiUrl,
        timeout: config.timeout,
      });
      break;
    }
    case "web3storage": {
      const { Web3StorageStorage } = await import(
        "../adapters/files/web3storage"
      );
      storage = new Web3StorageStorage({
        token: config.token,
        gateway: config.gateway,
        apiUrl: config.apiUrl,
        timeout: config.timeout,
      });
      break;
    }
    case "arweave": {
      const { ArweaveStorage } = await import("../adapters/files/arweave");
      storage = new ArweaveStorage({
        gateway: config.gateway,
        walletKey: config.walletKey as
          | ConstructorParameters<typeof ArweaveStorage>[0]["walletKey"]
          | undefined,
        timeout: config.timeout,
      });
      break;
    }
    case "ipfs-local": {
      const { LocalIPFSStorage } = await import("../adapters/files/ipfs-local");
      storage = new LocalIPFSStorage({
        apiUrl: config.apiUrl,
        gateway: config.gateway,
        timeout: config.timeout,
        headers: config.headers,
      });
      break;
    }
    default:
      throw new Error(
        `Unknown file storage type: ${(config as { type: string }).type}`
      );
  }

  await storage.initialize();
  return storage;
}
