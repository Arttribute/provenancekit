/**
 * Activity Service
 *
 * Core business logic for creating provenance activities.
 *
 * An activity represents a single provenance event:
 * - An entity performs an action
 * - The action consumes inputs and produces outputs
 * - The output resource is uploaded and tracked
 *
 * Claim Verification Pipeline:
 * 1. Identity — entity's publicKey is immutable; new registrations require key ownership proof
 * 2. Auth binding — if auth is active, authIdentity.entityId must match claimed entity
 * 3. Input validation — all declared inputs must exist in storage
 * 4. Action proof — entity signs intent (entityId, actionType, inputs, timestamp)
 * 5. Server witness — server signs output binding (actionId, entityId, outputCid, proofHash)
 * 6. Tool attestation — AI tool claims are tiered: provider-signed > receipt-backed > self-declared
 * 7. Verification summary — ext:verification@1.0.0 attached to every action
 *
 * Uses:
 * - @provenancekit/storage: Database and file storage
 * - @provenancekit/extensions: Contrib, license, payment, AI, proof, witness, verification extensions
 * - @provenancekit/privacy: Encrypted uploads
 */

import { createHash } from "crypto";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  cidRef,
  setExtension,
  type Resource,
  type Action,
  type Attribution,
} from "@provenancekit/eaa-types";
import {
  withContrib,
  withLicense,
  withAITool,
  withStorage,
  withPayment,
  withOnchain,
  withProof,
  withWitness,
  withToolAttestation,
  withVerification,
  Licenses,
  type ActionProof,
  type ClaimStatus,
} from "@provenancekit/extensions";
import {
  verifyAction,
  verifyFullAction,
  createServerWitness,
  hashActionProof,
  verifyEd25519Signature,
  type ActionSignPayload,
  type FullActionSignPayload,
} from "@provenancekit/sdk";
import { eq } from "drizzle-orm";
import { getContext, resolveFileStorage, resolveEncryptedFileStorage } from "../context.js";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { pkApiEntityFlags } from "../db/schema.js";
import { EmbeddingService, type ResourceKind } from "../embedding/service.js";
import { toDataURI, inferKindFromMime } from "../utils.js";
import { ProvenanceKitError } from "../errors.js";
import type { AuthIdentity } from "../middleware/auth.js";

/*─────────────────────────────────────────────────────────────*\
 | Embedding Service                                            |
\*─────────────────────────────────────────────────────────────*/

const embedder = new EmbeddingService();

/*─────────────────────────────────────────────────────────────*\
 | Content hash → CID cache                                     |
 |                                                              |
 | Avoids re-uploading identical file bytes across retries.     |
 | When the retry logic re-submits a file that was already      |
 | accepted in a previous attempt, we detect the duplicate in   |
 | microseconds rather than spending 500-2000ms re-uploading to |
 | IPFS before the DB duplicate check fires.                    |
 |                                                              |
 | Key:   SHA-256 hex of raw file bytes                         |
 | Value: IPFS CID returned by the storage layer                |
 |                                                              |
 | Uses globalThis so the cache survives module re-evaluations  |
 | during development hot-reloads and Cloud Run revision warm-  |
 | up, while still being scoped to a single Node.js process.    |
\*─────────────────────────────────────────────────────────────*/
declare global {
  // eslint-disable-next-line no-var
  var _pkContentCidCache: Map<string, string> | undefined;
}
const contentCidCache: Map<string, string> = (global._pkContentCidCache ??= new Map());
// Evict oldest entries when the cache grows beyond this size (~5k entries × ~100 bytes ≈ 500KB)
const CONTENT_CACHE_MAX = 5000;

/*─────────────────────────────────────────────────────────────*\
 | Request Schemas                                              |
\*─────────────────────────────────────────────────────────────*/

/** AI tool metadata (when AI is used as a tool in the action) */
const AIToolSchema = z.object({
  provider: z.string(),
  model: z.string(),
  version: z.string().optional(),
  promptHash: z.string().optional(),
  prompt: z.string().optional(),
  systemPrompt: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  tokensUsed: z.number().nullish(),
  generationTime: z.number().nullish(),
  seed: z.number().nullish(),
});

/** Tool attestation evidence */
const ToolAttestationSchema = z.object({
  level: z.enum(["provider-signed", "receipt-backed", "self-declared"]),
  providerSignature: z.object({
    publicKey: z.string(),
    signature: z.string(),
    algorithm: z.enum(["Ed25519", "ECDSA-secp256k1"]),
    signedPayloadHash: z.string(),
  }).optional(),
  receipt: z.object({
    requestId: z.string().optional(),
    responseHash: z.string().optional(),
    headers: z.record(z.string()).optional(),
    responseTimestamp: z.string().optional(),
  }).optional(),
  outputHash: z.string().optional(),
});

/** Contribution weight configuration */
const ContribSchema = z.object({
  weight: z.number().min(0),
  basis: z.enum(["points", "percentage", "absolute"]).default("points"),
  source: z.enum(["self-declared", "agreed", "calculated", "verified", "default"]).optional(),
  category: z.string().optional(),
  note: z.string().optional(),
});

/** License configuration */
const LicenseSchema = z.union([
  z.string(), // Preset name like "CC-BY-4.0" or license key
  z.object({
    type: z.string(),
    commercial: z.boolean().optional(),
    derivatives: z.boolean().optional(),
    shareAlike: z.boolean().optional(),
    attribution: z.enum(["required", "requested", "none"]).optional(),
    termsUrl: z.string().url().optional(),
  }),
]);

/** Payment configuration */
const PaymentSchema = z.object({
  address: z.string(),
  chainId: z.number().optional(),
  method: z.string().optional(),
  currency: z.string().optional(),
});

/** Full activity request payload */
export const ActivityPayload = z.object({
  /** The entity performing the action */
  entity: z.object({
    id: z.string().optional(),
    role: z.string(),
    name: z.string().optional(),
    wallet: z.string().optional(),
    publicKey: z.string().optional(),
    /** Registration signature for new entities with publicKey */
    registrationSignature: z.string().optional(),
  }),

  /** The action being performed */
  action: z.object({
    type: z.string().default("create"),
    inputCids: z.array(z.string()).default([]),
    toolCid: z.string().optional(),
    proof: z.string().optional(),
    /** Structured action proof (ext:proof@1.0.0) — used for signature verification */
    actionProof: z.object({
      algorithm: z.enum(["Ed25519", "ECDSA-secp256k1"]),
      publicKey: z.string(),
      signature: z.string(),
      timestamp: z.string(),
    }).optional(),
    /** Output CIDs — if provided, the action proof is verified as a full action proof */
    outputCids: z.array(z.string()).optional(),
    extensions: z.record(z.unknown()).optional(),
    aiTool: AIToolSchema.optional(),
    /** Tool attestation evidence (replaces pure self-declaration for tool claims) */
    toolAttestation: ToolAttestationSchema.optional(),
  }),

  /** Resource type (inferred from MIME if not provided) */
  resourceType: z.string().optional(),

  /** Project ID — identifies the app/project (required for multi-tenant isolation) */
  projectId: z.string().optional(),

  /** Session ID for grouping activities (app-provided, any format) */
  sessionId: z.string().optional(),

  /** Attribution configuration */
  attribution: z
    .object({
      contrib: ContribSchema.optional(),
      license: LicenseSchema.optional(),
      payment: PaymentSchema.optional(),
    })
    .optional(),

  /** Whether to encrypt the file */
  encrypt: z.boolean().default(false),
});

export type ActivityPayload = z.infer<typeof ActivityPayload>;

/*─────────────────────────────────────────────────────────────*\
 | Response Types                                               |
\*─────────────────────────────────────────────────────────────*/

export interface ActivityResult {
  cid: string;
  actionId: string;
  entityId: string;
  resourceType: string;
  encrypted: boolean;
  /** Base64-encoded encryption key — only present when encrypt=true. Caller MUST store this to decrypt later. */
  encryptionKey?: string;
  /** Transaction hash if on-chain recording succeeded */
  txHash?: string;
}

/*─────────────────────────────────────────────────────────────*\
 | Blockchain ABI (minimal write interface)                     |
\*─────────────────────────────────────────────────────────────*/

/** Minimal ABI for writing to ProvenanceRegistry */
const REGISTRY_WRITE_ABI = [
  {
    type: "function",
    name: "recordActionAndRegisterOutputs",
    inputs: [
      { name: "actionType", type: "string" },
      { name: "inputs", type: "string[]" },
      { name: "outputs", type: "string[]" },
      { name: "resourceType", type: "string" },
    ],
    outputs: [{ name: "actionId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

/*─────────────────────────────────────────────────────────────*\
 | Claim Verification Tracker                                   |
\*─────────────────────────────────────────────────────────────*/

/** Mutable tracker for per-claim verification status during activity creation. */
interface ClaimTracker {
  identity: { status: ClaimStatus; detail?: string };
  action: { status: ClaimStatus; detail?: string };
  output: { status: ClaimStatus; detail?: string };
  tool?: { status: ClaimStatus; detail?: string };
  inputs?: { status: ClaimStatus; detail?: string };
  attestation?: { status: ClaimStatus; detail?: string };
}

function overallStatus(claims: ClaimTracker): "verified" | "partial" | "unverified" | "skipped" {
  const all = [claims.identity, claims.action, claims.output, claims.tool, claims.inputs, claims.attestation]
    .filter(Boolean) as { status: ClaimStatus }[];

  if (all.every((c) => c.status === "skipped")) return "skipped";
  if (all.every((c) => c.status === "verified" || c.status === "skipped")) return "verified";
  if (all.some((c) => c.status === "verified" || c.status === "receipt-backed")) return "partial";
  return "unverified";
}

/*─────────────────────────────────────────────────────────────*\
 | Action Proof Verification                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Verify an action proof against the entity's registered public key.
 *
 * Behaviour depends on `config.proofPolicy`:
 * - `enforce`: reject unsigned actions from entities with registered public keys
 * - `warn`: accept but log a warning
 * - `off`: skip verification entirely
 *
 * @returns ClaimStatus for action verification
 */
async function verifyActionProof(
  actionProof: ActionProof | undefined,
  entity: { id: string; publicKey?: string },
  actionType: string,
  inputCids: string[],
  timestamp: string,
  outputCids?: string[]
): Promise<{ status: ClaimStatus; detail?: string }> {
  if (config.proofPolicy === "off") {
    return { status: "skipped", detail: "proofPolicy=off" };
  }

  // Structured proof provided — verify it
  if (actionProof) {
    // Check public key matches entity's registered key
    if (entity.publicKey && actionProof.publicKey !== entity.publicKey) {
      throw new ProvenanceKitError("Forbidden", "Proof public key does not match entity's registered public key", {
        recovery: "Sign the action with the private key corresponding to the entity's registered public key",
      });
    }

    // Try full action proof (with outputs) first
    if (outputCids && outputCids.length > 0) {
      const fullPayload: FullActionSignPayload = {
        entityId: entity.id,
        actionType,
        inputs: inputCids,
        outputs: outputCids,
        timestamp,
      };

      const valid = await verifyFullAction(fullPayload, actionProof);
      if (valid) {
        return { status: "verified", detail: "Full action proof (includes outputs)" };
      }
      // Fall through to try intent-only proof
    }

    // Intent-only proof (without outputs)
    const payload: ActionSignPayload = {
      entityId: entity.id,
      actionType,
      inputs: inputCids,
      timestamp,
    };

    const valid = await verifyAction(payload, actionProof);

    if (!valid) {
      throw new ProvenanceKitError("Forbidden", "Invalid action proof signature", {
        recovery: "Ensure the action payload matches what was signed (entityId, actionType, inputs, timestamp)",
      });
    }
    return { status: "verified", detail: "Intent proof (entity signed action intent)" };
  }

  // No proof but entity has a registered public key
  if (entity.publicKey) {
    if (config.proofPolicy === "enforce") {
      throw new ProvenanceKitError("Forbidden", "Action proof required for entities with registered public keys", {
        recovery: "Sign the action using signAction() from @provenancekit/sdk",
      });
    }
    if (config.proofPolicy === "warn") {
      console.warn(`[proof-policy] Unsigned action from entity ${entity.id} (has registered public key)`);
    }
    return { status: "unverified", detail: "Entity has publicKey but no proof provided" };
  }

  return { status: "unverified", detail: "No publicKey registered, no proof provided" };
}

/*─────────────────────────────────────────────────────────────*\
 | Input Validation                                             |
\*─────────────────────────────────────────────────────────────*/

async function validateInputs(
  inputCids: string[],
  dbStorage: { resourceExists: (ref: string) => Promise<boolean> }
): Promise<{ status: ClaimStatus; detail?: string }> {
  if (inputCids.length === 0) {
    return { status: "skipped", detail: "No inputs declared" };
  }

  if (!config.validateInputs || config.proofPolicy === "off") {
    return { status: "skipped", detail: "Input validation disabled" };
  }

  // Check all input CIDs in parallel — one round-trip per CID → one batch of concurrent calls.
  const existsResults = await Promise.all(inputCids.map((cid) => dbStorage.resourceExists(cid)));

  let validCount = 0;
  for (let i = 0; i < inputCids.length; i++) {
    const exists = existsResults[i];
    const inputCid = inputCids[i];
    if (!exists) {
      if (config.proofPolicy === "enforce") {
        throw new ProvenanceKitError("NotFound", `Input resource not found: ${inputCid}`, {
          recovery: "Ensure all input resources are registered before referencing them",
        });
      }
      if (config.proofPolicy === "warn") {
        console.warn(`[proof-policy] Referenced non-existent input: ${inputCid}`);
      }
    } else {
      validCount++;
    }
  }

  if (validCount === inputCids.length) {
    return { status: "verified", detail: `${validCount}/${inputCids.length} inputs exist` };
  }
  return { status: "unverified", detail: `${validCount}/${inputCids.length} inputs exist` };
}

/*─────────────────────────────────────────────────────────────*\
 | Tool Attestation Validation                                  |
\*─────────────────────────────────────────────────────────────*/

async function validateToolAttestation(
  attestation?: z.infer<typeof ToolAttestationSchema>
): Promise<{ status: ClaimStatus; detail?: string }> {
  if (!attestation) {
    return { status: "unverified", detail: "No attestation provided (self-declared)" };
  }

  const level = attestation.level;

  // Check against minimum level
  const levels = ["self-declared", "receipt-backed", "provider-signed"] as const;
  const minIdx = levels.indexOf(config.minToolAttestationLevel);
  const actualIdx = levels.indexOf(level);

  if (actualIdx < minIdx && config.proofPolicy === "enforce") {
    throw new ProvenanceKitError(
      "Forbidden",
      `Tool attestation level "${level}" does not meet minimum "${config.minToolAttestationLevel}"`,
      { recovery: `Provide at least "${config.minToolAttestationLevel}" level attestation` }
    );
  }

  if (level === "provider-signed") {
    const sig = attestation.providerSignature;

    // Require the signature fields to actually be present
    if (!sig?.publicKey || !sig?.signature || !sig?.signedPayloadHash) {
      if (config.proofPolicy === "enforce") {
        throw new ProvenanceKitError(
          "Forbidden",
          "Provider-signed attestation requires providerSignature with publicKey, signature, and signedPayloadHash",
          { recovery: "Include complete providerSignature fields in the tool attestation" }
        );
      }
      return { status: "unverified", detail: "Provider-signed claimed but signature fields missing" };
    }

    // Only Ed25519 is supported for now
    if (sig.algorithm !== "Ed25519") {
      return { status: "unverified", detail: `Unsupported signature algorithm: ${sig.algorithm}` };
    }

    // Verify the provider's signature over the payload hash
    const valid = await verifyEd25519Signature(
      sig.signature,
      sig.signedPayloadHash,
      sig.publicKey
    );

    if (!valid) {
      if (config.proofPolicy === "enforce") {
        throw new ProvenanceKitError(
          "Forbidden",
          "Provider tool attestation signature is invalid",
          { recovery: "Ensure the provider signed the correct payload hash with the declared key" }
        );
      }
      return { status: "failed", detail: "Provider signature verification failed" };
    }

    return { status: "verified", detail: "Provider signature cryptographically verified" };
  }

  if (level === "receipt-backed") {
    return { status: "receipt-backed", detail: "API receipt included" };
  }
  return { status: "unverified", detail: "Self-declared (no external evidence)" };
}

/*─────────────────────────────────────────────────────────────*\
 | Activity Creation                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a new provenance activity.
 *
 * This is the main entry point for recording provenance:
 * 1. Validates and verifies all claims (identity, action, output, tool, inputs)
 * 2. Uploads the file to IPFS (optionally encrypted)
 * 3. Checks for duplicates (exact and near-duplicate)
 * 4. Creates entity, action, resource, and attribution records
 * 5. Applies extensions (contrib, license, payment, AI, storage, witness, verification)
 */
export async function createActivity(
  file: File,
  body: unknown,
  authIdentity?: AuthIdentity
): Promise<ActivityResult> {
  const { dbStorage, ipfsGateway } = getContext();
  // Resolve per-project file storage adapters (uses project's own IPFS credentials
  // if configured, otherwise falls back to platform-level defaults).
  const [fileStorage, encryptedStorage] = await Promise.all([
    resolveFileStorage(authIdentity),
    resolveEncryptedFileStorage(authIdentity),
  ]);

  // Initialize claim tracker
  const claims: ClaimTracker = {
    identity: { status: "skipped" },
    action: { status: "skipped" },
    output: { status: "skipped" },
  };

  // 1. Validate request
  const parsed = ActivityPayload.safeParse(body);
  if (!parsed.success) {
    throw ProvenanceKitError.fromZod(parsed.error);
  }

  // projectId from auth claims is authoritative when using Supabase-backed keys.
  // It overrides anything the caller sends in the body, ensuring project isolation.
  const authProjectId = authIdentity?.claims?.["projectId"] as string | undefined;
  const { entity: ent, action: act, resourceType, sessionId, attribution: attr, encrypt } = parsed.data;
  const projectId = authProjectId ?? parsed.data.projectId;

  if (!ent.role?.trim()) {
    throw new ProvenanceKitError("MissingField", "entity.role is required");
  }

  // 2. Resolve entity identity
  const entityId = ent.id ?? uuidv4();

  // Run entity registration and flag check in parallel — they're independent DB operations.
  const { registerOrUpdateEntity } = await import("./entity.service.js");
  const db = getDb();
  const [{ entity: resolvedEntity }, flagRow] = await Promise.all([
    registerOrUpdateEntity({
      id: entityId,
      role: ent.role,
      name: ent.name,
      wallet: ent.wallet,
      publicKey: ent.publicKey,
      registrationSignature: ent.registrationSignature,
    }),
    db
      ? db
          .select({ flag: pkApiEntityFlags.flag, reason: pkApiEntityFlags.reason, expiresAt: pkApiEntityFlags.expiresAt })
          .from(pkApiEntityFlags)
          .where(eq(pkApiEntityFlags.entityId, entityId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  // 2a. Entity flag check (suspended/banned entities cannot create activities)
  if (flagRow) {
    const expired = flagRow.expiresAt && new Date(flagRow.expiresAt) < new Date();
    if (!expired) {
      throw new ProvenanceKitError(
        "Forbidden",
        `Entity is ${flagRow.flag}${flagRow.reason ? `: ${flagRow.reason}` : ""}`,
        { recovery: "Contact support if you believe this is an error" }
      );
    }
  }

  // Track identity verification status
  if (resolvedEntity.publicKey) {
    if (ent.registrationSignature) {
      claims.identity = { status: "verified", detail: "key-ownership" };
    } else if (config.proofPolicy !== "off") {
      // Existing entity with key — identity is established from prior registration
      const existing = await dbStorage.getEntity(entityId);
      if (existing?.publicKey) {
        claims.identity = { status: "verified", detail: "Previously registered key" };
      } else {
        claims.identity = { status: "unverified", detail: "No registration signature" };
      }
    }
  } else {
    claims.identity = config.proofPolicy === "off"
      ? { status: "skipped" }
      : { status: "unverified", detail: "No publicKey registered" };
  }

  // 2b. Auth-to-entity binding check
  if (authIdentity?.entityId && authIdentity.entityId !== entityId) {
    throw new ProvenanceKitError(
      "Forbidden",
      "Authenticated identity does not match claimed entity",
      { recovery: "Use the entity ID associated with your auth credentials" }
    );
  }

  // 3. Validate input existence
  claims.inputs = await validateInputs(act.inputCids, dbStorage);

  // 4. Read file and determine type
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const kind = (resourceType ?? inferKindFromMime(mime) ?? "other") as ResourceKind;

  // 4a. Fast duplicate pre-check using content hash (skips IPFS upload entirely).
  //
  // SHA-256 is computed locally in microseconds. If we've seen these exact bytes
  // in this process before, we can return 409 without uploading to IPFS — saving
  // 500-2000ms of network latency. This is the common path for retried requests
  // where the first attempt's file upload succeeded but the response was lost.
  //
  // Unencrypted only: encrypted uploads use a fresh random key every time, so
  // the same plaintext bytes produce a different ciphertext + CID each call.
  // contentSha256 is kept in scope so the cache can be populated after upload.
  const contentSha256 = !encrypt
    ? createHash("sha256").update(bytes).digest("hex")
    : null;

  if (contentSha256) {
    const cachedCid = contentCidCache.get(contentSha256);
    if (cachedCid) {
      // Double-check DB — if the resource was somehow deleted, the cache is stale
      const existing = await dbStorage.getResource(cachedCid);
      if (existing) {
        throw new ProvenanceKitError("Duplicate", "Resource with identical CID already exists", {
          recovery: "Use the existing CID instead of uploading again",
          details: { cid: cachedCid, similarity: 1 },
        });
      }
      contentCidCache.delete(contentSha256); // stale — fall through to upload
    }
  }

  // 5+7. Upload to IPFS and generate embedding in parallel.
  // Both operations only need `bytes` + `mime` (already in memory), so there's no
  // dependency between them. On Cloud Run, IPFS upload (~500-2000ms network) and
  // CLIP embedding (~100-500ms CPU) can overlap, cutting the wall-clock time by
  // roughly the shorter of the two.
  let encryptionKey: Uint8Array | undefined;
  if (encrypt) {
    encryptionKey = getContext().generateKey();
  }

  const [uploadResult, embeddingRaw] = await Promise.all([
    // 5. Upload
    encrypt && encryptionKey
      ? encryptedStorage.uploadEncrypted(bytes, {
          key: encryptionKey,
          filename: file.name || "file.bin",
          contentType: mime,
        })
      : fileStorage.upload(bytes, {
          name: file.name || "file.bin",
          mimeType: mime,
        }),
    // 7. Embedding (non-fatal)
    embedder.vector(kind, toDataURI(bytes, mime)).catch((err) => {
      console.error("[PK] embedder.vector failed (non-fatal — similarity search skipped):", err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  // Unpack upload result
  let cid: string;
  let size: number;
  let encrypted = false;

  if (encrypt && "ref" in uploadResult && "encryptedSize" in uploadResult) {
    cid = (uploadResult as { ref: { ref: string }; encryptedSize: number }).ref.ref;
    size = (uploadResult as { ref: { ref: string }; encryptedSize: number }).encryptedSize;
    encrypted = true;
  } else {
    const r = uploadResult as { ref: { ref?: string }; size: number };
    cid = r.ref.ref!;
    size = r.size;
  }

  const embedding: number[] | null = embeddingRaw;

  // Populate the content cache now that we have the CID.
  // Future requests with identical bytes (e.g. retries) will short-circuit before upload.
  if (contentSha256) {
    if (contentCidCache.size >= CONTENT_CACHE_MAX) {
      // Evict the oldest entry (Map iteration order is insertion order)
      const firstKey = contentCidCache.keys().next().value;
      if (firstKey !== undefined) contentCidCache.delete(firstKey);
    }
    contentCidCache.set(contentSha256, cid);
  }

  // 6. Check for exact duplicate (needs CID from upload above)
  const existing = await dbStorage.getResource(cid);
  if (existing) {
    throw new ProvenanceKitError("Duplicate", "Resource with identical CID already exists", {
      recovery: "Use the existing CID instead of uploading again",
      details: { cid, similarity: 1 },
    });
  }

  if (!encrypted && embedding) {
    // Near-duplicate detection: binary content only.
    //
    // CLIP/semantic embeddings measure *meaning*, not textual identity.
    // Two completely different texts about the same topic (e.g. two different
    // articles about the French Revolution, two different prompts asking for
    // "an image of a cat") can score well above any practical cosine threshold.
    //
    // For text/tool resources the only reliable duplicate signal is an exact
    // SHA-256 match — which is already checked above via CID collision.
    // Applying vector near-duplicate to text would cause false positives
    // (different user prompts linking to each other's provenance chains).
    //
    // Binary content (image/audio/video): semantic embeddings ARE a valid
    // near-duplicate signal because two near-identical images/recordings
    // will have nearly identical feature vectors regardless of minor edits,
    // re-encoding, or slight crops.
    const isBinaryKind = kind === "image" || kind === "audio" || kind === "video";
    if (isBinaryKind) {
      const nearMatch = await embedder.matchTop1(embedding, config.duplicateThreshold, kind);
      if (nearMatch) {
        throw new ProvenanceKitError("Duplicate", "Very similar resource already exists", {
          recovery: "Consider using the existing resource",
          details: { cid: nearMatch.cid, similarity: nearMatch.score },
        });
      }
    }
    // text/tool: skip near-duplicate — exact CID check above is sufficient
  }

  // 8. Create records
  const actionId = uuidv4();
  const timestamp = new Date().toISOString();

  // 8a. Verify action proof
  claims.action = await verifyActionProof(
    act.actionProof as ActionProof | undefined,
    { id: entityId, publicKey: resolvedEntity.publicKey },
    act.type,
    act.inputCids,
    timestamp,
    act.outputCids
  );

  // 8b. Create action
  let action: Action = {
    id: actionId,
    type: act.type as "create" | "transform" | "aggregate" | "verify",
    performedBy: entityId,
    timestamp,
    inputs: act.inputCids.map((ref) => cidRef(ref)),
    outputs: [cidRef(cid, size)],
    proof: act.proof,
    extensions: {
      ...act.extensions,
      ...(act.toolCid ? { toolCid: act.toolCid } : {}),
    },
  };

  // Add structured proof as extension
  if (act.actionProof) {
    action = withProof(action, act.actionProof as ActionProof);
  }

  // 8c. Create server witness (output binding)
  const { serverSigningKey, attestationProvider } = getContext();
  if (serverSigningKey && act.actionProof) {
    const proofHash = await hashActionProof(act.actionProof as ActionProof);
    const witness = await createServerWitness(
      { actionId, entityId, outputCid: cid, actionProofHash: proofHash },
      serverSigningKey
    );

    // Attach environment attestation if a provider is configured.
    // Uses the action proof hash as the nonce to bind freshness to this action.
    if (attestationProvider) {
      try {
        const envAttestation = await attestationProvider.getAttestation(proofHash);
        const witnessWithAttestation = { ...witness, attestation: envAttestation };
        action = withWitness(action, witnessWithAttestation);
        claims.attestation = { status: "verified", detail: `${envAttestation.type} attestation attached` };
      } catch (err) {
        console.warn("[attestation] Failed to get environment attestation:", err);
        action = withWitness(action, witness);
        claims.attestation = { status: "failed", detail: "Environment attestation generation failed" };
      }
    } else {
      action = withWitness(action, witness);
    }

    claims.output = { status: "verified", detail: "Server witness present" };
  } else if (serverSigningKey && !act.actionProof) {
    // No action proof to bind to — witness would be incomplete
    claims.output = { status: "unverified", detail: "No action proof to bind witness to" };
  } else {
    claims.output = config.proofPolicy === "off"
      ? { status: "skipped" }
      : { status: "unverified", detail: "No server signing key configured" };
  }

  // Add session context as namespaced extension
  if (sessionId || projectId) {
    const sessionData: Record<string, string> = {};
    if (sessionId) sessionData.sessionId = sessionId;
    if (projectId) sessionData.projectId = projectId;
    setExtension(action, "ext:session@1.0.0", sessionData);
  }

  // Add auth identity as extension for audit trail
  if (authIdentity) {
    setExtension(action, "ext:auth@1.0.0", {
      id: authIdentity.id,
      method: authIdentity.method,
      ...(authIdentity.entityId ? { entityId: authIdentity.entityId } : {}),
    });
  }

  // 8d. Add AI tool extension and validate attestation
  if (act.aiTool) {
    action = withAITool(action, {
      provider: act.aiTool.provider,
      model: act.aiTool.model,
      version: act.aiTool.version,
      promptHash: act.aiTool.promptHash,
      prompt: act.aiTool.prompt,
      systemPrompt: act.aiTool.systemPrompt,
      parameters: act.aiTool.parameters,
      tokensUsed: act.aiTool.tokensUsed ?? undefined,
      generationTime: act.aiTool.generationTime ?? undefined,
      seed: act.aiTool.seed ?? undefined,
    });

    // Validate and attach tool attestation
    const attestation = act.toolAttestation;
    claims.tool = await validateToolAttestation(attestation);

    if (attestation) {
      action = withToolAttestation(action, attestation);
    } else {
      action = withToolAttestation(action, { level: "self-declared" });
    }
  }

  // 8e. Attach verification summary
  action = withVerification(action, {
    status: overallStatus(claims),
    claims: {
      identity: claims.identity,
      action: claims.action,
      output: claims.output,
      ...(claims.tool ? { tool: claims.tool } : {}),
      ...(claims.inputs ? { inputs: claims.inputs } : {}),
      ...(claims.attestation ? { attestation: claims.attestation } : {}),
    },
    verifiedAt: new Date().toISOString(),
    policyUsed: config.proofPolicy,
  });

  // 9. Build resource record (sync — no I/O)
  let resource: Resource = {
    address: cidRef(cid, size),
    type: kind,
    locations: [{ uri: `${ipfsGateway}/${cid}`, provider: "ipfs" }],
    createdAt: timestamp,
    createdBy: entityId,
    rootAction: actionId,
  };

  if (sessionId || projectId) {
    const sessionData: Record<string, string> = {};
    if (sessionId) sessionData.sessionId = sessionId;
    if (projectId) sessionData.projectId = projectId;
    setExtension(resource, "ext:session@1.0.0", sessionData);
  }

  resource = withStorage(resource, {
    pinned: true,
    encrypted,
    contentType: mime,
    replicas: [{ provider: "ipfs-pinata", status: "active" }],
  });

  if (attr?.license) {
    if (typeof attr.license === "string") {
      const preset = Licenses[attr.license as keyof typeof Licenses];
      resource = withLicense(resource, preset ?? { type: attr.license });
    } else {
      resource = withLicense(resource, attr.license);
    }
  }

  // createAction and createResource are independent — run them in parallel.
  // initOwnershipState must run AFTER createResource because pk_ownership_state
  // has a FK constraint on pk_resource(ref). Running it in parallel causes a
  // FK violation when the INSERT into pk_ownership_state races the INSERT into
  // pk_resource and wins.
  await Promise.all([
    dbStorage.createAction(action),
    dbStorage.createResource(resource),
  ]);

  await dbStorage.initOwnershipState(cid, entityId).catch((err) => {
    console.error(
      "[PK] initOwnershipState failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  });

  // 10. Store embedding (non-fatal — similarity search is a secondary feature)
  // If the vector dimension doesn't match the DB column (e.g. pk_embedding was created
  // with vector(768) but CLIP ViT-Base/16 outputs 512-dim), the INSERT will fail.
  // Run 003_fix_embedding_dimension.sql to repair the table, then redeploy.
  // The provenance records (pk_resource, pk_action) are always written above.
  if (embedding && !encrypted) {
    try {
      await embedder.store(cid, embedding);
    } catch (err) {
      console.error(
        "[PK] embedder.store failed (non-fatal — run 003_fix_embedding_dimension.sql to fix):",
        err instanceof Error ? err.message : err
      );
    }
  } else if (embedding && encrypted && encryptionKey) {
    // Encrypt the embedding vector so only the key holder can search.
    // The server stores an opaque blob — no semantic information leaks.
    try {
      await embedder.storeEncrypted(cid, embedding, encryptionKey, kind);
    } catch (err) {
      console.error("[PK] embedder.storeEncrypted failed (non-fatal):", err instanceof Error ? err.message : err);
    }
  }

  // 11. Create attribution
  let attribution: Attribution = {
    resourceRef: cidRef(cid),
    actionId,
    entityId,
    role: "creator",
  };

  if (attr?.contrib) {
    attribution = withContrib(attribution, attr.contrib);
  }

  if (attr?.payment) {
    attribution = withPayment(attribution, {
      recipient: {
        address: attr.payment.address,
        chainId: attr.payment.chainId,
      },
      method: attr.payment.method,
      currency: attr.payment.currency,
    });
  }

  await dbStorage.createAttribution(attribution);

  // 12. Create source attributions for inputs (parallel — no ordering dependency)
  await Promise.all(
    act.inputCids.map((inputCid) =>
      dbStorage.createAttribution({
        resourceRef: cidRef(cid),
        actionId,
        entityId,
        role: "source",
        note: `Source: ${inputCid}`,
      })
    )
  );

  // 13. Optionally record on-chain (fire-and-forget)
  //
  // We simulate + submit the tx synchronously (fast: ~200ms) to get the tx hash,
  // then wait for the receipt in the background without blocking the response.
  // This drops badge latency from 20-30 s (block confirmation) to ~2 s (IPFS + Supabase).
  //
  // The action record is updated with on-chain data once the receipt arrives.
  // Callers can poll GET /activity/:id to check for the ext:onchain@1.0.0 extension.
  const { blockchain } = getContext();
  let txHash: string | undefined;

  if (blockchain) {
    try {
      const hash = await blockchain.walletClient.writeContract({
        address: blockchain.contractAddress,
        abi: REGISTRY_WRITE_ABI,
        functionName: "recordActionAndRegisterOutputs",
        args: [act.type, act.inputCids, [cid], kind],
        account: blockchain.walletClient.account ?? null,
        chain: blockchain.walletClient.chain,
      });
      txHash = hash;

      // Fire-and-forget: wait for receipt in background, then update the action record.
      // Cloud Run keeps the container warm between requests so the background promise
      // will complete even after the HTTP response has been sent.
      blockchain.publicClient
        .waitForTransactionReceipt({ hash })
        .then(async (receipt) => {
          try {
            const updatedAction = withOnchain(action, {
              chainId: blockchain.chainId,
              chainName: blockchain.chainName,
              blockNumber: Number(receipt.blockNumber),
              transactionHash: receipt.transactionHash,
              contractAddress: blockchain.contractAddress,
              confirmed: receipt.status === "success",
            });
            await dbStorage.updateAction(actionId, {
              extensions: updatedAction.extensions,
            });
            console.log(`✓ On-chain confirmed: tx ${receipt.transactionHash} (block ${receipt.blockNumber}) for CID ${cid}`);
          } catch (updateErr) {
            console.error(
              `[on-chain] Failed to update action ${actionId} after tx ${receipt.transactionHash}:`,
              updateErr instanceof Error ? updateErr.message : updateErr
            );
          }
        })
        .catch((error) => {
          console.error(
            `[on-chain] waitForTransactionReceipt failed for tx ${hash} (CID ${cid}):`,
            error instanceof Error ? error.message : error
          );
        });

      console.log(`→ On-chain tx submitted: ${hash} (awaiting confirmation in background)`);
    } catch (error) {
      // simulateContract or writeContract failed — on-chain failure does NOT roll back off-chain records
      console.error(
        "On-chain recording failed (off-chain records saved):",
        error instanceof Error ? error.message : error
      );
    }
  }

  return {
    cid,
    actionId,
    entityId,
    resourceType: kind,
    encrypted,
    ...(encryptionKey
      ? { encryptionKey: Buffer.from(encryptionKey).toString("base64") }
      : {}),
    ...(txHash ? { txHash } : {}),
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Activity Retrieval                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Get an activity by action ID.
 */
export async function getActivity(actionId: string): Promise<{
  action: Action;
  resource: Resource | null;
  attributions: Attribution[];
} | null> {
  const { dbStorage } = getContext();

  const action = await dbStorage.getAction(actionId);
  if (!action) return null;

  const outputs = action.outputs ?? [];
  const outputRef = outputs[0]?.ref;
  const resource = outputRef ? await dbStorage.getResource(outputRef) : null;
  const attributions = await dbStorage.getAttributionsByAction(actionId);

  return { action, resource, attributions };
}
