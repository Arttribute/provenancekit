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
 * Uses:
 * - @provenancekit/storage: Database and file storage
 * - @provenancekit/extensions: Contrib, license, payment, AI extensions
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
  Licenses,
  type ActionProof,
} from "@provenancekit/extensions";
import { verifyAction, type ActionSignPayload } from "@provenancekit/sdk";
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
    extensions: z.record(z.unknown()).optional(),
    aiTool: AIToolSchema.optional(),
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
 | Proof Verification                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Verify an action proof against the entity's registered public key.
 *
 * Behaviour depends on `config.proofPolicy`:
 * - `enforce`: reject unsigned actions from entities with registered public keys
 * - `warn`: accept but log a warning
 * - `off`: skip verification entirely
 */
async function verifyActionProof(
  actionProof: ActionProof | undefined,
  entity: { id: string; publicKey?: string },
  actionType: string,
  inputCids: string[],
  timestamp: string
): Promise<void> {
  if (config.proofPolicy === "off") return;

  // Structured proof provided — verify it
  if (actionProof) {
    // Check public key matches entity's registered key
    if (entity.publicKey && actionProof.publicKey !== entity.publicKey) {
      throw new ProvenanceKitError("Forbidden", "Proof public key does not match entity's registered public key", {
        recovery: "Sign the action with the private key corresponding to the entity's registered public key",
      });
    }

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
    return;
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
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Activity Creation                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a new provenance activity.
 *
 * This is the main entry point for recording provenance:
 * 1. Uploads the file to IPFS (optionally encrypted)
 * 2. Checks for duplicates (exact and near-duplicate)
 * 3. Creates entity, action, resource, and attribution records
 * 4. Applies extensions (contrib, license, payment, AI, storage)
 */
export async function createActivity(
  file: File,
  body: unknown,
  authIdentity?: AuthIdentity
): Promise<ActivityResult> {
  const { dbStorage, fileStorage, encryptedStorage, ipfsGateway } = getContext();

  // 1. Validate request
  const parsed = ActivityPayload.safeParse(body);
  if (!parsed.success) {
    throw ProvenanceKitError.fromZod(parsed.error);
  }

  const { entity: ent, action: act, resourceType, projectId, sessionId, attribution: attr, encrypt } = parsed.data;

  if (!ent.role?.trim()) {
    throw new ProvenanceKitError("MissingField", "entity.role is required");
  }

  // 2. Read file and determine type
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const kind = (resourceType ?? inferKindFromMime(mime) ?? "other") as ResourceKind;

  // 3. Upload file to IPFS
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

  // 4. Check for exact duplicate
  const existing = await dbStorage.getResource(cid);
  if (existing) {
    throw new ProvenanceKitError("Duplicate", "Resource with identical CID already exists", {
      recovery: "Use the existing CID instead of uploading again",
      details: { cid, similarity: 1 },
    });
  }

  // 5. Generate embedding and check for near-duplicates
  let embedding: number[] | null = null;
  if (!encrypted) {
    embedding = await embedder.vector(kind, toDataURI(bytes, mime));
    const nearMatch = await embedder.matchTop1(embedding, config.duplicateThreshold, kind);
    if (nearMatch) {
      throw new ProvenanceKitError("Duplicate", "Very similar resource already exists", {
        recovery: "Consider using the existing resource",
        details: { cid: nearMatch.cid, similarity: nearMatch.score },
      });
    }
  }

  // 6. Create records
  const entityId = ent.id ?? uuidv4();
  const actionId = uuidv4();
  const timestamp = new Date().toISOString();

  // 6a. Upsert entity
  await dbStorage.upsertEntity({
    id: entityId,
    role: ent.role as "human" | "ai" | "organization",
    name: ent.name,
    publicKey: ent.publicKey,
    metadata: ent.wallet ? { wallet: ent.wallet } : undefined,
  });

  // 6a'. Verify action proof
  await verifyActionProof(
    act.actionProof as ActionProof | undefined,
    { id: entityId, publicKey: ent.publicKey },
    act.type,
    act.inputCids,
    timestamp
  );

  // 6b. Create action
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

  // Add AI tool extension if provided
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
  }

  await dbStorage.createAction(action);

  // 6c. Create resource with storage extension
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

  // 6d. Store embedding
  if (embedding) {
    await embedder.store(cid, embedding);
  }

  // 6e. Create attribution
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

  // 6f. Create source attributions for inputs
  for (const inputCid of act.inputCids) {
    await dbStorage.createAttribution({
      resourceRef: cidRef(cid),
      actionId,
      entityId,
      role: "source",
      note: `Source: ${inputCid}`,
    });
  }

  // 7. Optionally record on-chain
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

      // Persist the on-chain extension back to DB
      const { supabase } = getContext();
      await supabase
        .from("pk_action")
        .update({ extensions: updatedAction.extensions })
        .eq("id", actionId);

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
