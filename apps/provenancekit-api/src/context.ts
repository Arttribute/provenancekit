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
import { MemoryDbStorage } from "@provenancekit/storage/adapters/db/memory";
import { MemoryFileStorage } from "@provenancekit/storage/adapters/files/memory";
import { PinataStorage } from "@provenancekit/storage/adapters/files/ipfs-pinata";
import type { AuthIdentity } from "./middleware/auth.js";
import type { IProvenanceStorage } from "@provenancekit/storage";
import type { IFileStorage } from "@provenancekit/storage/files";
import {
  EncryptedFileStorage,
  generateKey,
  type MinimalFileStorage,
} from "@provenancekit/privacy";
import type { EnvironmentAttestation } from "@provenancekit/extensions";
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { derivePublicKey } from "@provenancekit/sdk";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";

/*─────────────────────────────────────────────────────────────*\
 | Attestation Provider Interface                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Minimal interface for environment attestation generation.
 *
 * Implement with any attesting environment SDK (TEE, TPM, HSM, etc.) and
 * pass to AppContext.attestationProvider. ProvenanceKit only calls
 * getAttestation() — key sealing, key management, and report verification
 * are entirely your implementation's concern.
 *
 * @example
 * ```ts
 * // AWS Nitro Enclave
 * const attestationProvider: IAttestationProvider = {
 *   async getAttestation(nonce) {
 *     const doc = await nsm.getAttestationDoc({ nonce });
 *     return { type: "aws-nitro", report: doc.toString("base64"), nonce };
 *   },
 * };
 *
 * // Intel SGX (via Open Enclave SDK)
 * const attestationProvider: IAttestationProvider = {
 *   async getAttestation(nonce) {
 *     const quote = await oe.getReport(Buffer.from(nonce ?? ""));
 *     return { type: "intel-sgx", report: quote.toString("base64"), nonce };
 *   },
 * };
 *
 * // TPM
 * const attestationProvider: IAttestationProvider = {
 *   async getAttestation(nonce) {
 *     const quote = await tpm.quote({ nonce, pcrSelection: [0, 7] });
 *     return { type: "tpm", report: quote.toString("base64"), nonce };
 *   },
 * };
 * ```
 */
export interface IAttestationProvider {
  getAttestation(nonce?: string): Promise<EnvironmentAttestation>;
}

/*─────────────────────────────────────────────────────────────*\
 | Context Interface                                            |
\*─────────────────────────────────────────────────────────────*/

export interface AppContext {
  /** Database storage (Supabase with pgvector, or in-memory for local dev) */
  dbStorage: IProvenanceStorage;

  /** File storage (Pinata IPFS, or in-memory for local dev) */
  fileStorage: IFileStorage;

  /** Encrypted file storage wrapper */
  encryptedStorage: EncryptedFileStorage;

  /** IPFS gateway URL */
  ipfsGateway: string;

  /** Raw Supabase client for direct queries (null when using memory adapter) */
  supabase: RealSupabaseClient | null;

  /** Generate a new encryption key */
  generateKey: () => Uint8Array;

  /** Server signing key for witness attestations (hex-encoded Ed25519 private key) */
  serverSigningKey?: string;

  /** Server public key derived from serverSigningKey (hex-encoded) */
  serverPublicKey?: string;

  /**
   * Optional attestation provider.
   * When provided, server witnesses will include an environment attestation
   * report stored in ext:witness@1.0.0.attestation for independent verification.
   */
  attestationProvider?: IAttestationProvider;

  /** Optional blockchain clients for on-chain provenance recording */
  blockchain?: {
    publicClient: PublicClient;
    walletClient: WalletClient;
    contractAddress: `0x${string}`;
    chainId: number;
    chainName: string;
  };
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

  // 0. Run database migrations (idempotent; skipped when DATABASE_URL is absent)
  // Set SKIP_MIGRATIONS=true in production Cloud Run service env vars and run
  // migrations separately via a Cloud Run Job before each deployment.
  // This removes the migration round-trip (~500ms-5s) from the cold-start path.
  const databaseUrl = process.env.DATABASE_URL;
  const skipMigrations = process.env.SKIP_MIGRATIONS === "true";
  if (databaseUrl && !skipMigrations) {
    try {
      await runMigrations(databaseUrl, config.vectorDimension);
      console.log("✓ Database migrations applied");
    } catch (err) {
      console.error("[migrate] Migration failed — startup aborted:", err);
      throw err;
    }
  } else if (databaseUrl && skipMigrations) {
    console.log("⏭ Database migrations skipped (SKIP_MIGRATIONS=true)");
  }

  // 1. Initialize database storage
  // Falls back to in-memory storage when Supabase is not configured (local dev)
  let supabaseClient: RealSupabaseClient | null = null;
  let dbStorage: IProvenanceStorage;

  const supabaseKey = config.supabaseServiceKey ?? config.supabaseAnonKey;
  if (config.supabaseUrl && supabaseKey) {
    supabaseClient = createClient(config.supabaseUrl, supabaseKey);
    const supabaseStorage = new SupabaseStorage({
      // The real SupabaseClient generic return types differ from our minimal
      // StorageSupabaseClient interface even though they're structurally
      // compatible at runtime. The double cast bridges this TypeScript limitation.
      client: supabaseClient as unknown as StorageSupabaseClient,
      enableVectors: true,
      vectorDimension: config.vectorDimension,
    });
    await supabaseStorage.initialize();
    dbStorage = supabaseStorage;
    console.log("✓ Database storage ready (Supabase + pgvector)");
  } else {
    dbStorage = new MemoryDbStorage();
    console.warn(
      "⚠ SUPABASE_URL / SUPABASE_SERVICE_KEY not set — using in-memory storage (data lost on restart)"
    );
  }

  // 2. Initialize file storage
  // Falls back to in-memory file storage when Pinata JWT is not configured
  let fileStorage: IFileStorage;

  if (config.pinataJwt) {
    const pinata = new PinataStorage({
      jwt: config.pinataJwt,
      gateway: config.pinataGateway,
    });
    await pinata.initialize();
    fileStorage = pinata;
    console.log("✓ File storage ready (Pinata IPFS)");
  } else {
    fileStorage = new MemoryFileStorage();
    console.warn(
      "⚠ PINATA_JWT not set — using in-memory file storage (data lost on restart)"
    );
  }

  // 4. Initialize encrypted storage wrapper
  // IFileStorage is a superset of MinimalFileStorage at runtime; the double cast
  // bridges a TypeScript incompatibility in optional retrieve() parameter signatures.
  const encryptedStorage = new EncryptedFileStorage(
    fileStorage as unknown as MinimalFileStorage
  );
  console.log("✓ Encrypted storage ready");

  // 5. Initialize server signing key (for witness attestations)
  let serverSigningKey: string | undefined;
  let serverPublicKey: string | undefined;

  if (config.serverSigningKey) {
    serverSigningKey = config.serverSigningKey;
    serverPublicKey = await derivePublicKey(config.serverSigningKey);
    console.log(`✓ Server signing key ready (pubkey: ${serverPublicKey!.slice(0, 16)}...)`);
  } else if (config.proofPolicy !== "off") {
    console.warn(
      "[proof-policy] No SERVER_SIGNING_KEY configured — server witness attestations will be skipped"
    );
  }

  // 6. Initialize blockchain client (optional)
  let blockchain: AppContext["blockchain"];

  if (
    config.blockchainRpcUrl &&
    config.blockchainChainId &&
    config.blockchainContractAddress &&
    config.blockchainPrivateKey
  ) {
    const chain: Chain = {
      id: config.blockchainChainId,
      name: config.blockchainChainName ?? `Chain ${config.blockchainChainId}`,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: {
        default: { http: [config.blockchainRpcUrl] },
      },
    };

    const account = privateKeyToAccount(
      config.blockchainPrivateKey as `0x${string}`
    );

    const publicClient = createPublicClient({
      chain,
      transport: http(config.blockchainRpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(config.blockchainRpcUrl),
    });

    blockchain = {
      publicClient,
      walletClient,
      contractAddress: config.blockchainContractAddress as `0x${string}`,
      chainId: config.blockchainChainId,
      chainName: chain.name,
    };

    console.log(
      `✓ Blockchain client ready (${chain.name}, contract: ${config.blockchainContractAddress})`
    );
  }

  ctx = {
    dbStorage,
    fileStorage,
    encryptedStorage,
    ipfsGateway: config.pinataGateway,
    supabase: supabaseClient,
    generateKey,
    serverSigningKey,
    serverPublicKey,
    blockchain,
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
    projectFileStorageCache.clear();
    console.log("Context closed");
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Per-Project File Storage                                      |
 |                                                              |
 | When a project has its own IPFS credentials set, the API     |
 | uses those for file uploads instead of the platform defaults. |
 | This lets developers pin to their own Pinata/IPFS account.   |
\*─────────────────────────────────────────────────────────────*/

/**
 * Cache of per-project file storage adapters.
 * Key: `{projectId}:{ipfsProvider}:{ipfsApiKey}` — invalidated if config changes.
 */
const projectFileStorageCache = new Map<string, IFileStorage>();

/**
 * Resolve the file storage adapter for a request.
 *
 * If the request's auth identity carries per-project IPFS credentials
 * (populated by the Drizzle auth provider via a JOIN on app_projects),
 * those are used to instantiate or retrieve a cached per-project adapter.
 *
 * Falls back to the platform-level file storage from the global context.
 */
export async function resolveFileStorage(
  identity?: AuthIdentity | null
): Promise<IFileStorage> {
  const projectId = identity?.claims?.["projectId"] as string | undefined;
  const ipfsApiKey = identity?.claims?.["ipfsApiKey"] as string | undefined;
  const ipfsProvider = (identity?.claims?.["ipfsProvider"] as string | undefined) ?? "pinata";
  const ipfsGateway = identity?.claims?.["ipfsGateway"] as string | undefined;

  // No per-project config — use platform default
  if (!projectId || !ipfsApiKey) {
    return getContext().fileStorage;
  }

  const cacheKey = `${projectId}:${ipfsProvider}:${ipfsApiKey}`;
  const cached = projectFileStorageCache.get(cacheKey);
  if (cached) return cached;

  // Instantiate the appropriate adapter for this project
  let adapter: IFileStorage;

  if (ipfsProvider === "pinata" || !ipfsProvider) {
    const pinata = new PinataStorage({
      jwt: ipfsApiKey,
      gateway: ipfsGateway,
    });
    await pinata.initialize();
    adapter = pinata;
  } else {
    // Unknown provider — fall back to platform default
    return getContext().fileStorage;
  }

  projectFileStorageCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Resolve an EncryptedFileStorage wrapping the per-project (or platform default)
 * file storage adapter. Used by the activity service for encrypted uploads.
 */
export async function resolveEncryptedFileStorage(
  identity?: AuthIdentity | null
): Promise<EncryptedFileStorage> {
  const fileStorage = await resolveFileStorage(identity);
  const globalCtx = getContext();

  // If resolved to the same object as the global adapter, reuse the pre-warmed
  // encrypted wrapper — avoids unnecessary construction on every request.
  if (fileStorage === globalCtx.fileStorage) {
    return globalCtx.encryptedStorage;
  }

  // Per-project adapter — wrap in a fresh EncryptedFileStorage.
  return new EncryptedFileStorage(fileStorage as unknown as MinimalFileStorage);
}
