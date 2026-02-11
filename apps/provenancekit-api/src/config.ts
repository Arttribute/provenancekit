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
  });

  if (!result.success) {
    console.error("Configuration validation failed:");
    console.error(result.error.flatten());
    throw new Error("Invalid configuration");
  }

  return result.data;
}

export const config = loadConfig();
