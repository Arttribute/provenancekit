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
    console.log("Context closed");
  }
}
