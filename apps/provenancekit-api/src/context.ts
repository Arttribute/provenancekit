/**
 * ProvenanceKit API Context
 *
 * Application context providing storage adapters and services.
 *
 * Uses:
 * - @provenancekit/storage: Supabase (PostgreSQL) + Pinata (IPFS)
 * - @provenancekit/privacy: Encryption utilities
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient as RealSupabaseClient } from "@supabase/supabase-js";
import { SupabaseStorage } from "@provenancekit/storage/adapters/db/supabase";
import type { SupabaseClient as StorageSupabaseClient } from "@provenancekit/storage/adapters/db/supabase";
import { PinataStorage } from "@provenancekit/storage/adapters/files/ipfs-pinata";
import type { IProvenanceStorage, IVectorStorage } from "@provenancekit/storage";
import type { IFileStorage } from "@provenancekit/storage/files";
import {
  EncryptedFileStorage,
  generateKey,
  type MinimalFileStorage,
} from "@provenancekit/privacy";
import { config } from "./config.js";

/*─────────────────────────────────────────────────────────────*\
 | Context Interface                                            |
\*─────────────────────────────────────────────────────────────*/

export interface AppContext {
  /** Database storage (Supabase with pgvector) */
  dbStorage: IProvenanceStorage & IVectorStorage;

  /** File storage (Pinata IPFS) */
  fileStorage: IFileStorage;

  /** Encrypted file storage wrapper */
  encryptedStorage: EncryptedFileStorage;

  /** IPFS gateway URL */
  ipfsGateway: string;

  /** Raw Supabase client for direct queries */
  supabase: RealSupabaseClient;

  /** Generate a new encryption key */
  generateKey: () => Uint8Array;
}

/*─────────────────────────────────────────────────────────────*\
 | Context Singleton                                            |
\*─────────────────────────────────────────────────────────────*/

let ctx: AppContext | null = null;

/**
 * Initialize the application context.
 * Must be called once at startup.
 */
export async function initializeContext(): Promise<AppContext> {
  if (ctx) return ctx;

  console.log("Initializing ProvenanceKit API context...");

  // 1. Create Supabase client
  const supabaseClient = createClient(
    config.supabaseUrl,
    config.supabaseServiceKey ?? config.supabaseAnonKey
  );

  // 2. Initialize database storage with vector support
  const dbStorage = new SupabaseStorage({
    client: supabaseClient as unknown as StorageSupabaseClient,
    enableVectors: true,
    vectorDimension: config.vectorDimension,
  });
  await dbStorage.initialize();
  console.log("✓ Database storage ready (Supabase + pgvector)");

  // 3. Initialize file storage
  const fileStorage = new PinataStorage({
    jwt: config.pinataJwt,
    gateway: config.pinataGateway,
  });
  await fileStorage.initialize();
  console.log("✓ File storage ready (Pinata IPFS)");

  // 4. Initialize encrypted storage wrapper
  const encryptedStorage = new EncryptedFileStorage(
    fileStorage as unknown as MinimalFileStorage
  );
  console.log("✓ Encrypted storage ready");

  ctx = {
    dbStorage,
    fileStorage,
    encryptedStorage,
    ipfsGateway: config.pinataGateway,
    supabase: supabaseClient,
    generateKey,
  };

  console.log("ProvenanceKit API context initialized");
  return ctx;
}

/**
 * Get the current application context.
 * Throws if not initialized.
 */
export function getContext(): AppContext {
  if (!ctx) {
    throw new Error("Context not initialized. Call initializeContext() first.");
  }
  return ctx;
}

/**
 * Close all connections and clean up.
 */
export async function closeContext(): Promise<void> {
  if (ctx) {
    await ctx.dbStorage.close();
    await ctx.fileStorage.close();
    ctx = null;
    console.log("Context closed");
  }
}
