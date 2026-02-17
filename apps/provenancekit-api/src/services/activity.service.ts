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

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  cidRef,
  setExtension,
  type Resource,
  type Action,
  type Attribution,
} from "@arttribute/eaa-types";
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
import { getContext } from "../context.js";
import { config } from "../config.js";
import { EmbeddingService, type ResourceKind } from "../embedding/service.js";
import { toDataURI, inferKindFromMime } from "../utils.js";
import { ProvenanceKitError } from "../errors.js";
import type { AuthIdentity } from "../middleware/auth.js";

/*─────────────────────────────────────────────────────────────*\
 | Embedding Service                                            |
\*─────────────────────────────────────────────────────────────*/

const embedder = new EmbeddingService();

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
  tokensUsed: z.number().optional(),
  generationTime: z.number().optional(),
  seed: z.number().optional(),
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
}

function overallStatus(claims: ClaimTracker): "verified" | "partial" | "unverified" | "skipped" {
  const all = [claims.identity, claims.action, claims.output, claims.tool, claims.inputs]
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

  let validCount = 0;
  for (const inputCid of inputCids) {
    const exists = await dbStorage.resourceExists(inputCid);
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
  const { dbStorage, fileStorage, encryptedStorage, ipfsGateway } = getContext();

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

  const { entity: ent, action: act, resourceType, projectId, sessionId, attribution: attr, encrypt } = parsed.data;

  if (!ent.role?.trim()) {
    throw new ProvenanceKitError("MissingField", "entity.role is required");
  }

  // 2. Resolve entity identity
  const entityId = ent.id ?? uuidv4();

  // Use registerOrUpdateEntity for identity protection
  const { registerOrUpdateEntity } = await import("./entity.service.js");
  const { entity: resolvedEntity } = await registerOrUpdateEntity({
    id: entityId,
    role: ent.role,
    name: ent.name,
    wallet: ent.wallet,
    publicKey: ent.publicKey,
    registrationSignature: ent.registrationSignature,
  });

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

  // 2a. Auth-to-entity binding check
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

  // 5. Upload file to IPFS
  let cid: string;
  let size: number;
  let encrypted = false;
  let encryptionKey: Uint8Array | undefined;

  if (encrypt) {
    encryptionKey = getContext().generateKey();
    const result = await encryptedStorage.uploadEncrypted(bytes, {
      key: encryptionKey,
      filename: file.name || "file.bin",
      contentType: mime,
    });
    cid = result.ref.ref;
    size = result.encryptedSize;
    encrypted = true;
  } else {
    const result = await fileStorage.upload(bytes, {
      name: file.name || "file.bin",
      mimeType: mime,
    });
    cid = result.ref.ref!;
    size = result.size;
  }

  // 6. Check for exact duplicate
  const existing = await dbStorage.getResource(cid);
  if (existing) {
    throw new ProvenanceKitError("Duplicate", "Resource with identical CID already exists", {
      recovery: "Use the existing CID instead of uploading again",
      details: { cid, similarity: 1 },
    });
  }

  // 7. Generate embedding and check for near-duplicates.
  // Embeddings are generated from plaintext BEFORE encryption obscures content.
  // For encrypted resources: the vector is encrypted with the resource key and
  // stored as an opaque blob — only the key holder can search it client-side.
  // For non-encrypted resources: the vector is stored in pgvector for server-side search.
  let embedding: number[] | null = null;
  embedding = await embedder.vector(kind, toDataURI(bytes, mime));

  if (!encrypted) {
    // Server-side duplicate detection only applies to non-encrypted resources.
    // Cross-key dedup is fundamentally incompatible with encryption — the server
    // cannot compare vectors it cannot read. Same-key dedup is handled client-side
    // by the SDK before upload.
    const nearMatch = await embedder.matchTop1(embedding, config.duplicateThreshold, kind);
    if (nearMatch) {
      throw new ProvenanceKitError("Duplicate", "Very similar resource already exists", {
        recovery: "Consider using the existing resource",
        details: { cid: nearMatch.cid, similarity: nearMatch.score },
      });
    }
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
  const { serverSigningKey } = getContext();
  if (serverSigningKey && act.actionProof) {
    const proofHash = await hashActionProof(act.actionProof as ActionProof);
    const witness = await createServerWitness(
      { actionId, entityId, outputCid: cid, actionProofHash: proofHash },
      serverSigningKey
    );
    action = withWitness(action, witness);
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
      tokensUsed: act.aiTool.tokensUsed,
      generationTime: act.aiTool.generationTime,
      seed: act.aiTool.seed,
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
    },
    verifiedAt: new Date().toISOString(),
    policyUsed: config.proofPolicy,
  });

  await dbStorage.createAction(action);

  // 9. Create resource with storage extension
  let resource: Resource = {
    address: cidRef(cid, size),
    type: kind,
    locations: [{ uri: `${ipfsGateway}/${cid}`, provider: "ipfs" }],
    createdAt: timestamp,
    createdBy: entityId,
    rootAction: actionId,
  };

  // Add session context as namespaced extension on resource too
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

  // Add license if provided
  if (attr?.license) {
    if (typeof attr.license === "string") {
      const preset = Licenses[attr.license as keyof typeof Licenses];
      resource = withLicense(resource, preset ?? { type: attr.license });
    } else {
      resource = withLicense(resource, attr.license);
    }
  }

  await dbStorage.createResource(resource);

  // 10. Store embedding
  if (embedding && !encrypted) {
    await embedder.store(cid, embedding);
  } else if (embedding && encrypted && encryptionKey) {
    // Encrypt the embedding vector so only the key holder can search.
    // The server stores an opaque blob — no semantic information leaks.
    await embedder.storeEncrypted(cid, embedding, encryptionKey, kind);
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

  // 12. Create source attributions for inputs
  for (const inputCid of act.inputCids) {
    await dbStorage.createAttribution({
      resourceRef: cidRef(cid),
      actionId,
      entityId,
      role: "source",
      note: `Source: ${inputCid}`,
    });
  }

  // 13. Optionally record on-chain
  const { blockchain } = getContext();
  let txHash: string | undefined;

  if (blockchain) {
    try {
      const { request } = await blockchain.publicClient.simulateContract({
        address: blockchain.contractAddress,
        abi: REGISTRY_WRITE_ABI,
        functionName: "recordActionAndRegisterOutputs",
        args: [act.type, act.inputCids, [cid], kind],
        account: blockchain.walletClient.account,
      });

      const hash = await blockchain.walletClient.writeContract(request);

      const receipt = await blockchain.publicClient.waitForTransactionReceipt({
        hash,
      });

      txHash = receipt.transactionHash;

      // Update action extensions with on-chain data
      const updatedAction = withOnchain(action, {
        chainId: blockchain.chainId,
        chainName: blockchain.chainName,
        blockNumber: Number(receipt.blockNumber),
        transactionHash: receipt.transactionHash,
        contractAddress: blockchain.contractAddress,
        confirmed: receipt.status === "success",
      });

      // Persist the on-chain extension back to DB via storage interface
      await dbStorage.updateAction(actionId, {
        extensions: updatedAction.extensions,
      });

      console.log(`✓ On-chain: tx ${txHash} (block ${receipt.blockNumber})`);
    } catch (error) {
      // On-chain failure does NOT roll back off-chain records
      console.error(
        "On-chain recording failed (off-chain records saved):",
        error
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
