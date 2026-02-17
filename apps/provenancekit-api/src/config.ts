/**
 * ProvenanceKit API Configuration
 *
 * Zod-validated environment configuration.
 */

import { z } from "zod";
import "dotenv/config";

/*─────────────────────────────────────────────────────────────*\
 | Configuration Schema                                         |
\*─────────────────────────────────────────────────────────────*/

const ConfigSchema = z.object({
  // Server
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  // Authentication
  /** API keys (comma-separated). When set, all non-health endpoints require a Bearer token. */
  apiKeys: z.string().optional(),

  /** Proof policy for action signing verification */
  proofPolicy: z.enum(["enforce", "warn", "off"]).default("enforce"),

  /** Server Ed25519 private key for witness attestations (hex-encoded, 64 chars) */
  serverSigningKey: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),

  /** Whether to validate that input CIDs exist before creating actions */
  validateInputs: z.boolean().default(true),

  /** Minimum acceptable tool attestation level */
  minToolAttestationLevel: z
    .enum(["provider-signed", "receipt-backed", "self-declared"])
    .default("self-declared"),

  // Supabase (PostgreSQL + Vectors)
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  supabaseServiceKey: z.string().min(1).optional(),

  // Pinata (IPFS)
  pinataJwt: z.string().min(1),
  pinataGateway: z.string().url().default("https://gateway.pinata.cloud/ipfs"),

  // Vector search
  vectorDimension: z.coerce.number().default(768), // Xenova CLIP
  duplicateThreshold: z.coerce.number().default(0.95),
  matchThreshold: z.coerce.number().default(0.75),

  // Optional: OpenAI for alternative embeddings
  openaiApiKey: z.string().optional(),

  // Blockchain (optional - enables on-chain recording)
  /** RPC URL for the target blockchain */
  blockchainRpcUrl: z.string().url().optional(),
  /** Chain ID (e.g., 8453 for Base, 84532 for Base Sepolia) */
  blockchainChainId: z.coerce.number().optional(),
  /** Human-readable chain name */
  blockchainChainName: z.string().optional(),
  /** ProvenanceRegistry contract address */
  blockchainContractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  /** Private key for signing transactions (use env var, never hardcode) */
  blockchainPrivateKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/*─────────────────────────────────────────────────────────────*\
 | Load Configuration                                           |
\*─────────────────────────────────────────────────────────────*/

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
    vectorDimension: process.env.VECTOR_DIMENSION,
    duplicateThreshold: process.env.DUPLICATE_THRESHOLD,
    matchThreshold: process.env.MATCH_THRESHOLD,
    openaiApiKey: process.env.OPENAI_API_KEY,
    apiKeys: process.env.API_KEYS,
    proofPolicy: process.env.PROOF_POLICY,
    serverSigningKey: process.env.SERVER_SIGNING_KEY,
    validateInputs: process.env.VALIDATE_INPUTS === "false" ? false : true,
    minToolAttestationLevel: process.env.MIN_TOOL_ATTESTATION_LEVEL,
    blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL,
    blockchainChainId: process.env.BLOCKCHAIN_CHAIN_ID,
    blockchainChainName: process.env.BLOCKCHAIN_CHAIN_NAME,
    blockchainContractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
    blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY,
  });

  if (!result.success) {
    console.error("Configuration validation failed:");
    console.error(result.error.flatten());
    throw new Error("Invalid configuration");
  }

  return result.data;
}

export const config = loadConfig();
