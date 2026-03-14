import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { z } from 'zod';
import { AIAgentExtension, AIToolExtension, ContribExtension, LicenseExtension, OnchainExtension, VerificationExtension, WitnessExtension } from '@provenancekit/extensions';
import { ClassValue } from 'clsx';

/**
 * Entity schema representing an agent that performs actions.
 *
 * @remarks
 * Maps to **W3C PROV Agent**. Represents humans, AI systems, organizations,
 * or any actor that can create, modify, or verify resources.
 *
 * | W3C PROV Relation      | EAA Equivalent                     |
 * |------------------------|------------------------------------|
 * | prov:wasAssociatedWith | Action.performedBy → Entity.id     |
 * | prov:actedOnBehalfOf   | Use extensions for delegation      |
 */
declare const Entity: z.ZodObject<{
    /** Unique identifier (DID, wallet address, UUID, etc.) */
    id: z.ZodString;
    /** Human-readable name */
    name: z.ZodOptional<z.ZodString>;
    /** Role classification */
    role: z.ZodUnion<[z.ZodEnum<["human", "ai", "organization"]>, z.ZodString]>;
    /** Public key for signature verification (optional) */
    publicKey: z.ZodOptional<z.ZodString>;
    /** Arbitrary metadata (keep minimal, use extensions for domain data) */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Extension data (namespaced key-value pairs) */
    extensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id?: string;
    name?: string;
    role?: string;
    publicKey?: string;
    metadata?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
}, {
    id?: string;
    name?: string;
    role?: string;
    publicKey?: string;
    metadata?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
}>;
type Entity = z.infer<typeof Entity>;
/**
 * Resource schema for content-addressed artifacts.
 *
 * @remarks
 * Maps to **W3C PROV Entity**. Represents any artifact with provenance
 * (files, images, text, models, datasets, etc.) identified by content reference.
 *
 * **Identity vs Storage**
 *
 * The `address` field is the **identity** - it uniquely identifies WHAT the resource IS.
 * The `locations` field is optional **storage hints** - WHERE the resource CAN BE FOUND.
 *
 * - `address`: Immutable identifier (CID recommended). This IS the resource.
 * - `locations`: Mutable access points. These may change, expire, or be added.
 *
 * For complex storage needs (pinning status, replication, etc.), use extensions:
 * - `ext:storage@1.0.0` - Storage metadata extension
 *
 * @example
 * // Minimal resource (identity only)
 * {
 *   address: { ref: "bafyabc...", scheme: "cid" },
 *   type: "image",
 *   createdAt: "2024-01-01T00:00:00Z",
 *   createdBy: "did:key:abc",
 *   rootAction: "action-123"
 * }
 *
 * // With optional storage hints
 * {
 *   address: { ref: "bafyabc...", scheme: "cid" },
 *   type: "image",
 *   locations: [{ uri: "https://gateway.ipfs.io/ipfs/bafyabc..." }],
 *   // ...
 * }
 */
declare const Resource: z.ZodObject<{
    /** Content reference - the immutable identity of this resource */
    address: z.ZodObject<{
        /**
         * The content identifier or locator.
         * For CIDs: the full CID string (e.g., "bafyabc..." or "Qm...")
         * For URLs: the full URL
         * For hashes: "algorithm:hex" format
         */
        ref: z.ZodString;
        /** Addressing scheme used. Use "cid" for IPFS (recommended). */
        scheme: z.ZodUnion<[z.ZodEnum<["cid", "ar", "http", "hash"]>, z.ZodString]>;
        /**
         * Content hash for verification (optional).
         * Required for non-self-verifying schemes (http).
         * Not needed for cid, ar, or hash schemes.
         * Format: "algorithm:hex" (e.g., "sha256:abc123...")
         */
        integrity: z.ZodOptional<z.ZodString>;
        /** Size in bytes (optional, useful for resources) */
        size: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }>;
    /** Type classification */
    type: z.ZodUnion<[z.ZodEnum<["text", "image", "audio", "video", "code", "dataset", "model", "other"]>, z.ZodString]>;
    /**
     * Optional storage location hints.
     *
     * These are convenience pointers for WHERE to find the resource.
     * They are NOT part of the resource identity and may change over time.
     * The `address` field is the authoritative identifier.
     */
    locations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** URI to access the resource (ipfs://, https://, ar://, etc.) */
        uri: z.ZodString;
        /** Provider name (optional, e.g., "pinata", "arweave") */
        provider: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        uri?: string;
        provider?: string;
    }, {
        uri?: string;
        provider?: string;
    }>, "many">>;
    /** When created (ISO 8601 timestamp) */
    createdAt: z.ZodString;
    /** Who created it (Entity.id) */
    createdBy: z.ZodString;
    /** Root action that created this resource (Action.id) */
    rootAction: z.ZodString;
    /** Extension data (for licensing, NFTs, storage metadata, etc.) */
    extensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type?: string;
    extensions?: Record<string, unknown>;
    address?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    };
    locations?: {
        uri?: string;
        provider?: string;
    }[];
    createdAt?: string;
    createdBy?: string;
    rootAction?: string;
}, {
    type?: string;
    extensions?: Record<string, unknown>;
    address?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    };
    locations?: {
        uri?: string;
        provider?: string;
    }[];
    createdAt?: string;
    createdBy?: string;
    rootAction?: string;
}>;
type Resource = z.infer<typeof Resource>;
/**
 * Action schema representing an activity performed by an entity.
 *
 * @remarks
 * Maps to **W3C PROV Activity**. Represents a transformation: inputs → process → outputs.
 * This is the core of provenance tracking.
 *
 * | W3C PROV Relation    | EAA Equivalent                              |
 * |----------------------|---------------------------------------------|
 * | prov:used            | Action.inputs (resources consumed)          |
 * | prov:wasGeneratedBy  | Action.outputs (resources produced)         |
 * | prov:wasAssociatedWith | Action.performedBy (agent responsible)    |
 * | prov:startedAtTime   | Action.timestamp                            |
 * | prov:wasInformedBy   | Use extensions for action-to-action links   |
 */
declare const Action: z.ZodObject<{
    /** Unique identifier (UUID, tx hash, etc.) */
    id: z.ZodString;
    /** Type of action performed */
    type: z.ZodUnion<[z.ZodEnum<["create", "transform", "aggregate", "verify"]>, z.ZodString]>;
    /** Entity that performed this action (Entity.id) */
    performedBy: z.ZodString;
    /** When action occurred (ISO 8601 timestamp) */
    timestamp: z.ZodString;
    /** Input resources consumed */
    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /**
         * The content identifier or locator.
         * For CIDs: the full CID string (e.g., "bafyabc..." or "Qm...")
         * For URLs: the full URL
         * For hashes: "algorithm:hex" format
         */
        ref: z.ZodString;
        /** Addressing scheme used. Use "cid" for IPFS (recommended). */
        scheme: z.ZodUnion<[z.ZodEnum<["cid", "ar", "http", "hash"]>, z.ZodString]>;
        /**
         * Content hash for verification (optional).
         * Required for non-self-verifying schemes (http).
         * Not needed for cid, ar, or hash schemes.
         * Format: "algorithm:hex" (e.g., "sha256:abc123...")
         */
        integrity: z.ZodOptional<z.ZodString>;
        /** Size in bytes (optional, useful for resources) */
        size: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }>, "many">>;
    /** Output resources produced */
    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /**
         * The content identifier or locator.
         * For CIDs: the full CID string (e.g., "bafyabc..." or "Qm...")
         * For URLs: the full URL
         * For hashes: "algorithm:hex" format
         */
        ref: z.ZodString;
        /** Addressing scheme used. Use "cid" for IPFS (recommended). */
        scheme: z.ZodUnion<[z.ZodEnum<["cid", "ar", "http", "hash"]>, z.ZodString]>;
        /**
         * Content hash for verification (optional).
         * Required for non-self-verifying schemes (http).
         * Not needed for cid, ar, or hash schemes.
         * Format: "algorithm:hex" (e.g., "sha256:abc123...")
         */
        integrity: z.ZodOptional<z.ZodString>;
        /** Size in bytes (optional, useful for resources) */
        size: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }>, "many">>;
    /** Cryptographic proof (signature, tx hash, etc.) */
    proof: z.ZodOptional<z.ZodString>;
    /** Extension data (for tools, plans, timing, etc.) */
    extensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type?: string;
    id?: string;
    extensions?: Record<string, unknown>;
    performedBy?: string;
    timestamp?: string;
    inputs?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }[];
    outputs?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }[];
    proof?: string;
}, {
    type?: string;
    id?: string;
    extensions?: Record<string, unknown>;
    performedBy?: string;
    timestamp?: string;
    inputs?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }[];
    outputs?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }[];
    proof?: string;
}>;
type Action = z.infer<typeof Action>;
/**
 * Attribution schema linking an entity to a resource or action.
 *
 * @remarks
 * Maps to **W3C PROV Attribution/Association**. Records WHO was involved in creating WHAT.
 * Pure attribution with no assumptions about weights or payments - those belong in extensions.
 *
 * **Choosing Between resourceRef and actionId**
 *
 * | Target        | Use When                                       | Example                          |
 * |---------------|------------------------------------------------|----------------------------------|
 * | `resourceRef` | Attributing the **artifact itself**            | "Alice created this image"       |
 * | `actionId`    | Attributing the **process/activity**           | "Bob reviewed this transformation" |
 *
 * **resourceRef (Artifact-focused)**
 * Use when you want to say "this entity contributed to this specific output":
 * - Creator attribution: "Alice is the creator of image X"
 * - Source attribution: "Image Y was used to create image X"
 *
 * **actionId (Process-focused)**
 * Use when you want to say "this entity was involved in this activity":
 * - Multi-contributor actions: "Alice and Bob collaborated on this transformation"
 * - Reviewer attribution: "Carol verified this action"
 * - When the same action produces multiple outputs
 *
 * At least one of resourceRef or actionId must be provided.
 *
 * **ID Generation (Optional)**
 *
 * The `id` field is optional. If you need IDs, here are recommended approaches:
 *
 * 1. **Content-based (recommended)**: Deterministic hash of (target, entityId, role)
 *    - Provides natural deduplication (same attribution = same ID)
 *    - Verifiable and reproducible across systems
 *    - Use `generateAttributionId()` helper
 *
 * 2. **UUID**: Random unique identifier
 *    - Simple, guaranteed unique
 *    - No deduplication (same attribution can have different IDs)
 *
 * 3. **Custom**: Any string format your system requires
 *    - Database sequences, composite keys, etc.
 *
 * Choose based on your needs. Content-based is recommended for provenance systems.
 *
 * **Extensions for Domain-Specific Data**
 *
 * Use extensions for weights, payments, and other domain-specific data:
 * - `ext:contrib@1.0.0` - Contribution weights
 * - `ext:x402@1.0.0` - Payment configuration
 * - `ext:license@1.0.0` - License terms
 */
declare const Attribution: z.ZodEffects<z.ZodObject<{
    /**
     * Optional unique identifier for this attribution record.
     *
     * Recommended format: "attr:{hash}" where hash is derived from content.
     * Use `generateAttributionId()` for the recommended approach.
     */
    id: z.ZodOptional<z.ZodString>;
    /** The resource being attributed (optional if actionId provided) */
    resourceRef: z.ZodOptional<z.ZodObject<{
        /**
         * The content identifier or locator.
         * For CIDs: the full CID string (e.g., "bafyabc..." or "Qm...")
         * For URLs: the full URL
         * For hashes: "algorithm:hex" format
         */
        ref: z.ZodString;
        /** Addressing scheme used. Use "cid" for IPFS (recommended). */
        scheme: z.ZodUnion<[z.ZodEnum<["cid", "ar", "http", "hash"]>, z.ZodString]>;
        /**
         * Content hash for verification (optional).
         * Required for non-self-verifying schemes (http).
         * Not needed for cid, ar, or hash schemes.
         * Format: "algorithm:hex" (e.g., "sha256:abc123...")
         */
        integrity: z.ZodOptional<z.ZodString>;
        /** Size in bytes (optional, useful for resources) */
        size: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }, {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    }>>;
    /** The action being attributed (optional if resourceRef provided) */
    actionId: z.ZodOptional<z.ZodString>;
    /** The entity receiving attribution (Entity.id) */
    entityId: z.ZodString;
    /** Their role in the creation */
    role: z.ZodUnion<[z.ZodEnum<["creator", "contributor", "source"]>, z.ZodString]>;
    /** Optional note explaining the contribution */
    note: z.ZodOptional<z.ZodString>;
    /** Extension data (for weights, payments, etc.) */
    extensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id?: string;
    role?: string;
    extensions?: Record<string, unknown>;
    resourceRef?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    };
    actionId?: string;
    entityId?: string;
    note?: string;
}, {
    id?: string;
    role?: string;
    extensions?: Record<string, unknown>;
    resourceRef?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    };
    actionId?: string;
    entityId?: string;
    note?: string;
}>, {
    id?: string;
    role?: string;
    extensions?: Record<string, unknown>;
    resourceRef?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    };
    actionId?: string;
    entityId?: string;
    note?: string;
}, {
    id?: string;
    role?: string;
    extensions?: Record<string, unknown>;
    resourceRef?: {
        ref?: string;
        scheme?: string;
        integrity?: string;
        size?: number;
    };
    actionId?: string;
    entityId?: string;
    note?: string;
}>;
type Attribution = z.infer<typeof Attribution>;

/**
 * Bundle Signing Utilities
 *
 * Sign and verify ProvenanceKit bundles using Ed25519.
 * Uses @noble/ed25519 for cryptographic operations.
 *
 * @example
 * ```typescript
 * import { signBundle, verifyBundle, generateKeyPair } from "@provenancekit/sdk/signing";
 *
 * const { privateKey, publicKey } = await generateKeyPair();
 * const signedBundle = await signBundle(bundle, privateKey);
 * const isValid = await verifyBundle(signedBundle);
 * ```
 */

/** Structured action proof (matches ext:proof@1.0.0 extension schema) */
interface ActionProof {
    algorithm: "Ed25519" | "ECDSA-secp256k1";
    publicKey: string;
    signature: string;
    timestamp: string;
}

interface ApiClientOptions {
    baseUrl?: string;
    apiKey?: string;
    fetchFn?: typeof fetch;
}
/** Parameters for recording an action on-chain. */
interface RecordActionParams {
    /** EAA action type (e.g. "create", "transform"). */
    actionType: string;
    /** Content references (CIDs) of input resources. */
    inputs: string[];
    /** Content references (CIDs) of output resources. */
    outputs: string[];
}
/** Result returned after an on-chain action recording. */
interface RecordActionResult {
    /** Transaction hash of the recording transaction. */
    txHash: string;
    /** On-chain action ID as a hex string (bytes32). */
    actionId: string;
}
/**
 * Adapter interface for on-chain provenance recording.
 *
 * Implement this to record actions on any EVM-compatible blockchain.
 * The SDK is chain-client agnostic — use `createViemAdapter` for viem,
 * or implement your own for ethers.js, wagmi hooks, etc.
 */
interface IChainAdapter {
    /** Record a provenance action on-chain. */
    recordAction(params: RecordActionParams): Promise<RecordActionResult>;
    /** Chain ID for the `ext:onchain@1.0.0` extension. Optional. */
    chainId?: number;
    /** Human-readable chain name (e.g. "base", "arbitrum"). Optional. */
    chainName?: string;
    /** Address of the deployed ProvenanceRegistry contract. */
    contractAddress: string;
}

interface EntityResult {
    entity: Entity;
    isAIAgent: boolean;
    aiAgent?: AIAgentExtension | null;
}
interface EntityListResult {
    entities: Entity[];
    count: number;
}
interface EntityListOpts {
    role?: string;
    limit?: number;
    offset?: number;
}
interface AIAgentResult {
    agentData: AIAgentExtension;
}
type OwnershipEvidenceType = "self-declaration" | "signed-content" | "external-timestamp" | "legal-document" | "third-party-attestation";
type OwnershipTransferType = "voluntary" | "authorized" | "adjudicated";
interface OwnershipProof {
    algorithm: "Ed25519" | "ECDSA-secp256k1";
    publicKey: string;
    signature: string;
    timestamp: string;
}
interface OwnershipState {
    resourceRef: string;
    /** Entity who originally uploaded the resource (immutable) */
    registrant: Entity;
    /** Current authoritative owner */
    currentOwner: Entity;
    /** True if ownership has never been transferred */
    neverTransferred: boolean;
    /** Most recent transfer action, if any */
    lastTransfer: Action | null;
    /** Full history of claim and transfer actions, oldest first */
    history: Action[];
}
interface OwnershipClaimOpts {
    entity: {
        id?: string;
        role?: string;
        name?: string;
        publicKey?: string;
        registrationSignature?: string;
    };
    evidenceType: OwnershipEvidenceType;
    evidenceRef?: string;
    proof?: OwnershipProof;
    note?: string;
}
interface OwnershipTransferOpts {
    performedBy: {
        id?: string;
        role?: string;
        name?: string;
        publicKey?: string;
        registrationSignature?: string;
    };
    toEntityId: string;
    transferType: OwnershipTransferType;
    authorizationRef?: string;
    proof?: OwnershipProof;
    note?: string;
}
interface OwnershipActionResult {
    action: Action;
    attribution: Attribution;
}
interface DuplicateDetails {
    cid: string;
    similarity: number;
}
interface Match {
    cid: string;
    type: string;
    score: number;
}
interface UploadMatchResult {
    verdict: "auto" | "review" | "no-match";
    matches: Match[];
}
type NodeType = "resource" | "action" | "entity";
interface GraphNode {
    id: string;
    type: NodeType;
    label: string;
    data: Record<string, any>;
}
interface GraphEdge {
    from: string;
    to: string;
    type: "produces" | "consumes" | "tool" | "performedBy";
}
interface ProvenanceGraph$1 {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
interface SessionProvenance {
    sessionId: string;
    actions: Action[];
    resources: Resource[];
    entities: Entity[];
    attributions: Attribution[];
    summary: {
        actions: number;
        resources: number;
        entities: number;
        attributions: number;
    };
}
/**
 * Provenance bundle as returned by the API.
 *
 * This is a relaxed version of the canonical ProvenanceBundle from eaa-types
 * where `context` is optional (may not be set by all API versions).
 * For strict validation, use ProvenanceBundle from @provenancekit/eaa-types.
 */
interface ProvenanceBundle {
    context?: string;
    resources: Resource[];
    actions: Action[];
    entities: Entity[];
    attributions: Attribution[];
    extensions?: Record<string, unknown>;
}
interface DistributionEntry {
    entityId: string;
    bps: number;
    percentage: string;
    payment?: {
        address?: string;
        chainId?: number;
    };
}
interface Distribution {
    resourceRef: {
        ref: string;
        scheme: string;
    };
    entries: DistributionEntry[];
    totalBps: number;
    metadata: {
        attributionsProcessed: number;
        attributionsFiltered: number;
        normalized: boolean;
        algorithmVersion: string;
    };
}
interface DistributionPreviewItem {
    cid: string;
    entries: {
        entityId: string;
        bps: number;
        percentage: string;
    }[];
    totalBps: number;
}
interface DistributionPreviewResult {
    distributions: DistributionPreviewItem[];
    summary: {
        resourcesProcessed: number;
        uniqueContributors: number;
    };
}
interface C2PAAction {
    action: string;
    when?: string;
    softwareAgent?: {
        name: string;
        version?: string;
    };
    digitalSourceType?: string;
}
interface C2PAIngredient {
    title: string;
    format?: string;
    hash?: string;
    relationship?: "parentOf" | "componentOf" | "inputTo";
}
interface C2PAManifest {
    manifestLabel: string;
    claimGenerator: string;
    claimGeneratorVersion?: string;
    title?: string;
    format?: string;
    instanceId?: string;
    actions?: C2PAAction[];
    ingredients?: C2PAIngredient[];
    signature?: {
        algorithm: string;
        issuer?: string;
        timestamp?: string;
    };
    validationStatus?: {
        isValid: boolean;
        errors?: string[];
        warnings?: string[];
    };
    aiDisclosure?: {
        isAIGenerated: boolean;
        aiTool?: string;
        trainingDataUsed?: boolean;
    };
    creativeWork?: {
        author?: string[];
        dateCreated?: string;
        copyright?: string;
    };
}
interface MediaReadResult {
    hasManifest: boolean;
    message?: string;
    c2pa?: C2PAManifest;
    resource?: Resource;
    actions?: Action[];
    entities?: Entity[];
    attributions?: Attribution[];
    isAIGenerated?: boolean;
    validationStatus?: {
        isValid: boolean;
        errors?: string[];
        warnings?: string[];
    };
}
interface MediaVerifyResult {
    verified: boolean;
    signature?: {
        algorithm?: string;
        issuer?: string;
        timestamp?: string;
    };
    issuer?: string;
    signedAt?: string;
    errors?: string[];
    warnings?: string[];
    error?: string;
}
interface MediaImportResult {
    success: boolean;
    cid: string;
    imported: {
        entities: number;
        actions: number;
        resource: number;
        attributions: number;
    };
    c2pa?: {
        title?: string;
        isAIGenerated?: boolean;
        creator?: string[];
    };
}
interface AICheckResult {
    hasC2PA: boolean;
    isAIGenerated: boolean | null;
    message?: string;
    aiTool?: string;
    disclosure?: {
        isAIGenerated?: boolean;
        aiTool?: string;
        trainingDataUsed?: boolean;
    };
}
interface SupportedFormat {
    mimeType: string;
    extensions: string[];
    canRead: boolean;
    canWrite: boolean;
}
interface TextSearchResult {
    matches: Match[];
}
interface SearchOpts {
    topK?: number;
    minScore?: number;
    type?: string;
    /** Encryption key for searching encrypted resources (base64 or Uint8Array) */
    encryptionKey?: string | Uint8Array;
}
interface SearchResult {
    cid: string;
    score: number;
    type?: string;
    /** True if this result came from an encrypted resource (decrypted client-side) */
    encrypted?: boolean;
}

interface AIToolOpts {
    provider: string;
    model: string;
    version?: string;
    promptHash?: string;
    prompt?: string;
    systemPrompt?: string;
    parameters?: Record<string, unknown>;
    tokensUsed?: number;
    generationTime?: number;
    seed?: number;
}
interface FileOpts {
    entity: {
        id?: string;
        role: string;
        name?: string;
        publicKey?: string;
    };
    action?: {
        type?: string;
        inputCids?: string[];
        toolCid?: string;
        proof?: string;
        /** Structured action proof (ext:proof@1.0.0) */
        actionProof?: ActionProof;
        extensions?: Record<string, any>;
        /** AI tool metadata — stored as ext:ai@1.0.0 with proper withAITool() processing */
        aiTool?: AIToolOpts;
    };
    resourceType?: string;
    sessionId?: string;
}
interface UploadOptions {
    type?: string;
    topK?: number;
    min?: number;
}
interface OnchainRecord {
    /** Transaction hash of the on-chain recording. */
    txHash: string;
    /** On-chain action ID (bytes32 as hex). */
    actionId: string;
    /** Chain ID where the action was recorded. */
    chainId?: number;
    /** Human-readable chain name. */
    chainName?: string;
    /** Address of the ProvenanceRegistry contract. */
    contractAddress: string;
}
interface FileResult {
    cid: string;
    actionId?: string;
    entityId?: string;
    duplicate?: DuplicateDetails;
    matched?: Match;
    /** Present when on-chain recording succeeded via a configured chain adapter. */
    onchain?: OnchainRecord;
}
interface ProvenanceKitOptions extends ApiClientOptions {
    /**
     * Project ID for multi-tenant isolation.
     *
     * **Optional when using the ProvenanceKit dashboard (pk-app).**
     * API keys created in the dashboard embed the project ID server-side —
     * the API derives it automatically from the key, so you don't need to pass it here.
     *
     * Only required when using the legacy static `API_KEYS` env-var auth (self-hosted),
     * or when you want to explicitly override the key's project for testing.
     */
    projectId?: string;
    /**
     * Hex-encoded Ed25519 private key for auto-signing actions.
     * When set, all actions created via `file()` are automatically signed.
     */
    signingKey?: string;
    /**
     * Entity ID to bind to signed actions.
     * Required when `signingKey` is set.
     */
    signingEntityId?: string;
    /**
     * Optional on-chain adapter. When set, actions recorded via `file()` are
     * also recorded on the ProvenanceRegistry smart contract. The result will
     * include an `onchain` field with the transaction hash and on-chain action ID.
     *
     * On-chain recording is fire-and-forget by default (failures are non-fatal).
     * Use `createViemAdapter` to create a viem-backed adapter, or implement
     * `IChainAdapter` directly for other EVM clients (ethers.js, wagmi, etc.).
     */
    chain?: IChainAdapter;
}
declare class ProvenanceKit {
    private readonly api;
    private readonly projectId?;
    private readonly signingKey?;
    private readonly signingEntityId?;
    private readonly chainAdapter?;
    readonly unclaimed = "ent:unclaimed";
    constructor(opts?: ProvenanceKitOptions);
    private form;
    uploadAndMatch(file: Blob | File | Buffer | Uint8Array, o?: UploadOptions): Promise<UploadMatchResult>;
    file(file: Blob | File | Buffer | Uint8Array, opts: FileOpts): Promise<FileResult>;
    graph(cid: string, depth?: number): Promise<ProvenanceGraph$1>;
    entity(e: {
        role: string;
        name?: string;
        publicKey?: string;
        /** AI agent model config — include when role is "ai" */
        aiAgent?: {
            model: {
                provider: string;
                model: string;
                version?: string;
            };
            delegatedBy?: string;
            autonomyLevel?: "autonomous" | "supervised" | "assistive";
        };
    }): Promise<string>;
    health(): Promise<string>;
    /**
     * Get a single entity by ID, including AI agent info if applicable.
     */
    getEntity(id: string): Promise<EntityResult>;
    /**
     * List entities with optional filtering by role and pagination.
     */
    listEntities(opts?: EntityListOpts): Promise<EntityListResult>;
    /**
     * Get AI agent extension data for an entity.
     * Throws if the entity is not an AI agent.
     */
    getAIAgent(id: string): Promise<AIAgentResult>;
    /**
     * Get the current ownership state and full history for a resource.
     */
    ownership(cid: string): Promise<OwnershipState>;
    /**
     * Record an ownership claim for a resource.
     * Does NOT change ownership state — trust level is conveyed via
     * ext:verification@1.0.0 on the returned action.
     */
    ownershipClaim(cid: string, opts: OwnershipClaimOpts): Promise<OwnershipActionResult>;
    /**
     * Transfer ownership of a resource to a new entity.
     * Always updates ownership state. The returned action carries
     * ext:verification@1.0.0 showing whether the transfer was authorized.
     */
    ownershipTransfer(cid: string, opts: OwnershipTransferOpts): Promise<OwnershipActionResult>;
    /**
     * Get all provenance records linked to an app-managed session.
     * Returns actions, resources, entities, and attributions
     * that were created with the given sessionId.
     *
     * Scoped by projectId: uses the value set on this client instance,
     * or the project embedded in the API key when using dashboard-issued keys.
     */
    sessionProvenance(sessionId: string): Promise<SessionProvenance>;
    /**
     * Get the full provenance bundle for a resource.
     * Includes resource, actions, entities, attributions, and lineage.
     */
    bundle(cid: string): Promise<ProvenanceBundle>;
    /**
     * Get the provenance chain for a resource.
     * Returns the same data as bundle() - alias for compatibility.
     */
    provenance(cid: string): Promise<ProvenanceBundle>;
    /**
     * Find resources similar to the given resource.
     */
    similar(cid: string, topK?: number): Promise<Match[]>;
    /**
     * Search for similar resources by text query.
     */
    searchText(query: string, opts?: {
        topK?: number;
        type?: string;
    }): Promise<TextSearchResult>;
    /**
     * Unified search across encrypted and non-encrypted resources.
     *
     * Non-encrypted resources: server-side pgvector similarity search (fast, scalable).
     * Encrypted resources: SDK fetches encrypted vector blobs from the server,
     * decrypts them locally with the provided key, runs brute-force cosine
     * similarity in-memory, and merges results with server-side matches.
     *
     * The server never sees plaintext vectors for encrypted resources.
     * Without an encryptionKey, only non-encrypted results are returned.
     */
    search(query: string, opts?: SearchOpts): Promise<SearchResult[]>;
    /**
     * Fetch encrypted vector blobs, decrypt locally, and run similarity search.
     * This is the client-side leg of the unified search — the server only
     * provides opaque encrypted blobs it cannot read.
     */
    private searchEncryptedVectors;
    /**
     * Calculate payment distribution for a resource based on its attributions.
     */
    distribution(cid: string): Promise<Distribution>;
    /**
     * Preview distribution for multiple resources.
     * Optionally combine them into a single distribution.
     */
    distributionPreview(cids: string[], combine?: boolean): Promise<DistributionPreviewResult>;
    /**
     * Get list of supported media formats for C2PA operations.
     */
    mediaFormats(): Promise<SupportedFormat[]>;
    /**
     * Read C2PA manifest from a media file.
     */
    mediaRead(file: Blob | File | Buffer | Uint8Array): Promise<MediaReadResult>;
    /**
     * Verify C2PA manifest in a media file.
     */
    mediaVerify(file: Blob | File | Buffer | Uint8Array): Promise<MediaVerifyResult>;
    /**
     * Import C2PA provenance from a media file as EAA records.
     */
    mediaImport(file: Blob | File | Buffer | Uint8Array, opts?: {
        sessionId?: string;
    }): Promise<MediaImportResult>;
    /**
     * Check if a resource was AI-generated based on C2PA or extension data.
     */
    aiCheck(cid: string): Promise<AICheckResult>;
}

interface ProvenanceKitTheme {
    nodeResourceColor?: string;
    nodeActionColor?: string;
    nodeEntityColor?: string;
    roleHumanColor?: string;
    roleAiColor?: string;
    roleOrgColor?: string;
    verifiedColor?: string;
    partialColor?: string;
    failedColor?: string;
    badgeBg?: string;
    badgeFg?: string;
    radius?: string;
}
interface ProvenanceKitContextValue {
    pk: ProvenanceKit | null;
}
interface ProvenanceKitProviderProps {
    children: React.ReactNode;
    /** Pre-configured SDK instance (takes priority over apiUrl/apiKey) */
    pk?: ProvenanceKit;
    /** API URL for auto-creating SDK instance */
    apiUrl?: string;
    /** API key for auto-creating SDK instance */
    apiKey?: string;
    /** CSS custom property overrides applied as inline styles */
    theme?: ProvenanceKitTheme;
}
declare function ProvenanceKitProvider({ children, pk: pkProp, apiUrl, apiKey, theme, }: ProvenanceKitProviderProps): react_jsx_runtime.JSX.Element;
declare function useProvenanceKit(): ProvenanceKitContextValue;

interface UseProvenanceGraphResult {
    data: ProvenanceGraph$1 | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}
declare function useProvenanceGraph(cid: string | null | undefined, options?: {
    depth?: number;
    enabled?: boolean;
}): UseProvenanceGraphResult;

interface UseProvenanceBundleResult {
    data: ProvenanceBundle | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}
declare function useProvenanceBundle(cid: string | null | undefined, options?: {
    enabled?: boolean;
}): UseProvenanceBundleResult;

interface UseSessionProvenanceResult {
    data: SessionProvenance | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}
declare function useSessionProvenance(sessionId: string | null | undefined, options?: {
    enabled?: boolean;
    /** Poll interval in ms. Set to 0 or undefined to disable polling. */
    pollInterval?: number;
}): UseSessionProvenanceResult;

interface UseDistributionResult {
    data: Distribution | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}
declare function useDistribution(cid: string | null | undefined, options?: {
    enabled?: boolean;
}): UseDistributionResult;

declare function cn(...inputs: ClassValue[]): string;

/**
 * Formatting utilities for ProvenanceKit UI components.
 * All functions are pure (no side effects) and null-safe.
 */
/** Truncate a CID to `prefix...suffix` format */
declare function formatCid(cid: string | undefined | null, prefixLen?: number, suffixLen?: number): string;
/** Format an ISO 8601 date string to a human-readable relative string */
declare function formatDate(iso: string | undefined | null): string;
/** Format an ISO 8601 date to absolute display string */
declare function formatDateAbsolute(iso: string | undefined | null): string;
/**
 * Format basis points (0–10000) as a human-readable percentage string.
 * @example formatBps(7500) → "75%"
 */
declare function formatBps(bps: number | undefined | null): string;
/** Format an EAA entity role for display */
declare function formatRole(role: string | undefined | null): string;
/** Format an EAA action type for display */
declare function formatActionType(type: string | undefined | null): string;
/** Format a chain ID to a human-readable chain name */
declare function formatChainName(chainId: number | undefined | null): string;
/** Format a transaction hash for display (truncated) */
declare function formatTxHash(hash: string | undefined | null): string;
/** Format bytes to human-readable size */
declare function formatBytes(bytes: number | undefined | null): string;

/**
 * Type-safe, null-safe wrappers around @provenancekit/extensions helpers.
 * All functions return `null` instead of throwing when extension is not present.
 */

type AnyEaaType = Action | Entity | Resource | Attribution;
declare function getAIToolSafe(action: Action | null | undefined): AIToolExtension | null;
declare function getAIAgentSafe(entity: Entity | null | undefined): AIAgentExtension | null;
declare function getLicenseSafe(target: Resource | Attribution | null | undefined): LicenseExtension | null;
declare function getContribSafe(attribution: Attribution | null | undefined): ContribExtension | null;
declare function getOnchainSafe(target: AnyEaaType | null | undefined): OnchainExtension | null;
declare function getVerificationSafe(action: Action | null | undefined): VerificationExtension | null;
declare function getWitnessSafe(action: Action | null | undefined): WitnessExtension | null;
/** Check if any action in a bundle used an AI tool */
declare function bundleHasAI(actions: Action[]): boolean;
/** Get the primary creator attribution (role === "creator", or first) */
declare function getPrimaryCreator(attributions: Attribution[], entities: Entity[]): Entity | null;

interface EntityAvatarProps {
    role?: string;
    name?: string;
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}
declare function EntityAvatar({ role, name, size, className }: EntityAvatarProps): react_jsx_runtime.JSX.Element;

interface RoleBadgeProps {
    role?: string;
    className?: string;
}
declare function RoleBadge({ role, className }: RoleBadgeProps): react_jsx_runtime.JSX.Element;

type VerificationStatus = "verified" | "partial" | "unverified" | "skipped" | "failed";
interface VerificationIndicatorProps {
    status: VerificationStatus;
    showLabel?: boolean;
    size?: "sm" | "md";
    className?: string;
}
declare function VerificationIndicator({ status, showLabel, size, className, }: VerificationIndicatorProps): react_jsx_runtime.JSX.Element;

interface LicenseChipProps {
    license?: LicenseExtension | null;
    spdxId?: string;
    showIcons?: boolean;
    className?: string;
}
declare function LicenseChip({ license, spdxId, showIcons, className }: LicenseChipProps): react_jsx_runtime.JSX.Element | null;

interface TimestampProps {
    iso: string | undefined | null;
    className?: string;
}
declare function Timestamp({ iso, className }: TimestampProps): react_jsx_runtime.JSX.Element | null;

interface CidDisplayProps {
    cid: string | undefined | null;
    prefixLen?: number;
    suffixLen?: number;
    short?: boolean;
    showCopy?: boolean;
    className?: string;
}
declare function CidDisplay({ cid, prefixLen: prefixLenProp, suffixLen: suffixLenProp, short, showCopy, className, }: CidDisplayProps): react_jsx_runtime.JSX.Element | null;

interface ContributionBarProps {
    /** 0–1 decimal (e.g. 0.7 = 70%) */
    value: number;
    className?: string;
}
declare function ContributionBar({ value, className }: ContributionBarProps): react_jsx_runtime.JSX.Element;

type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type BadgeSize = "sm" | "md" | "lg";
type BadgeVariant = "floating" | "inline";
interface ProvenanceBadgeProps {
    cid?: string;
    bundle?: ProvenanceBundle;
    children?: React.ReactNode;
    position?: BadgePosition;
    size?: BadgeSize;
    variant?: BadgeVariant;
    popoverSide?: "top" | "bottom" | "left" | "right";
    onViewDetail?: () => void;
    loadingSlot?: React.ReactNode;
    errorSlot?: React.ReactNode;
    className?: string;
}
declare function ProvenanceBadge(props: ProvenanceBadgeProps): react_jsx_runtime.JSX.Element;

interface ProvenancePopoverProps {
    bundle: ProvenanceBundle;
    cid?: string;
    children: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
    onViewDetail?: () => void;
}
declare function ProvenancePopover({ bundle, cid, children, side, onViewDetail, }: ProvenancePopoverProps): react_jsx_runtime.JSX.Element;

interface ProvenanceGraphProps {
    /** Resource CID — auto-fetches graph if no nodes/edges provided */
    cid?: string;
    depth?: number;
    /** Headless mode — provide nodes and edges directly */
    nodes?: GraphNode[];
    edges?: GraphEdge[];
    height?: number | string;
    onNodeClick?: (node: GraphNode) => void;
    loadingSlot?: React.ReactNode;
    errorSlot?: React.ReactNode;
    className?: string;
}
declare function ProvenanceGraph({ cid, depth, nodes: nodesProp, edges: edgesProp, height, onNodeClick, loadingSlot, errorSlot, className, }: ProvenanceGraphProps): react_jsx_runtime.JSX.Element;

interface EntityCardProps {
    entity: Entity;
}
declare function EntityCard({ entity }: EntityCardProps): react_jsx_runtime.JSX.Element;

interface ActionCardProps {
    action: Action;
}
declare function ActionCard({ action }: ActionCardProps): react_jsx_runtime.JSX.Element;

interface ResourceCardProps {
    resource: Resource;
}
declare function ResourceCard({ resource }: ResourceCardProps): react_jsx_runtime.JSX.Element;

interface AttributionListProps {
    attributions: Attribution[];
    entities: Entity[];
    showContribution?: boolean;
}
declare function AttributionList({ attributions, entities, showContribution, }: AttributionListProps): react_jsx_runtime.JSX.Element;

interface ProvenanceBundleViewProps {
    cid?: string;
    bundle?: ProvenanceBundle;
    showEntities?: boolean;
    showActions?: boolean;
    showResources?: boolean;
    showAttributions?: boolean;
    showGraph?: boolean;
    graphHeight?: number;
    className?: string;
}
declare function ProvenanceBundleView({ cid, bundle: bundleProp, showEntities, showActions, showResources, showAttributions, showGraph, graphHeight, className, }: ProvenanceBundleViewProps): react_jsx_runtime.JSX.Element | null;

interface ProvenanceTrackerProps {
    /** Session ID — auto-polls pk.sessionProvenance() */
    sessionId?: string;
    pollInterval?: number;
    /** Headless mode — pass session directly */
    session?: SessionProvenance;
    maxActions?: number;
    showEntities?: boolean;
    showResources?: boolean;
    onNewAction?: (action: Action) => void;
    className?: string;
}
declare function ProvenanceTracker({ sessionId, pollInterval, session: sessionProp, maxActions, onNewAction, className, }: ProvenanceTrackerProps): react_jsx_runtime.JSX.Element;

interface ProvenanceSearchProps {
    mode?: "upload" | "cid" | "both";
    accept?: string;
    maxSize?: number;
    onResult?: (result: {
        cid: string;
    }) => void;
    className?: string;
}
declare function ProvenanceSearch({ mode, accept, maxSize, onResult, className, }: ProvenanceSearchProps): react_jsx_runtime.JSX.Element;

interface FileUploadZoneProps {
    onFile: (file: File) => void;
    accept?: string;
    maxSize?: number;
    disabled?: boolean;
    className?: string;
}
declare function FileUploadZone({ onFile, accept, maxSize, // 50MB
disabled, className, }: FileUploadZoneProps): react_jsx_runtime.JSX.Element;

declare function AIExtensionView({ extension, mode, className, }: {
    extension: AIToolExtension | AIAgentExtension;
    mode?: "tool" | "agent";
    className?: string;
}): react_jsx_runtime.JSX.Element;

interface LicenseExtensionViewProps {
    extension: LicenseExtension;
    className?: string;
}
declare function LicenseExtensionView({ extension, className }: LicenseExtensionViewProps): react_jsx_runtime.JSX.Element;

interface OnchainExtensionViewProps {
    extension: OnchainExtension;
    className?: string;
}
declare function OnchainExtensionView({ extension, className }: OnchainExtensionViewProps): react_jsx_runtime.JSX.Element;

interface VerificationViewProps {
    extension: VerificationExtension;
    showClaims?: boolean;
    className?: string;
}
declare function VerificationView({ extension, showClaims, className, }: VerificationViewProps): react_jsx_runtime.JSX.Element;

interface ContribExtensionViewProps {
    extension: ContribExtension;
    className?: string;
}
declare function ContribExtensionView({ extension, className }: ContribExtensionViewProps): react_jsx_runtime.JSX.Element;

interface FileOwnershipClaimResult {
    cid: string;
    status: "claimed" | "referenced";
}
interface FileOwnershipClaimProps {
    /**
     * Called when the user makes an ownership decision.
     * `owned = true`  → user created the file
     * `owned = false` → file is from an external / unknown source
     * Should return the CID of the recorded resource.
     */
    onClaim: (owned: boolean) => Promise<FileOwnershipClaimResult>;
    className?: string;
}
declare function FileOwnershipClaim({ onClaim, className }: FileOwnershipClaimProps): react_jsx_runtime.JSX.Element;

interface FileProvenanceTagProps {
    /** The File or Blob to search for provenance */
    file: File | Blob;
    /** Called when user clicks "View Full Provenance" */
    onViewDetail?: (cid: string) => void;
    /**
     * Called when the file has no prior provenance and the user makes an ownership decision.
     * `owned = true` → record as "create" (user is the creator)
     * `owned = false` → record as "reference" (external/unknown source)
     * Should upload the file and return its CID + status.
     * If omitted, falls back to a plain "No prior provenance" label.
     */
    onClaim?: (owned: boolean) => Promise<FileOwnershipClaimResult>;
    /**
     * Called when existing provenance is found (match score ≥ threshold).
     * The host should use this CID as the inputCid for any subsequent provenance
     * actions (e.g. the generate action that uses this file as input), so that
     * the new action references the existing provenance chain rather than a
     * disconnected raw IPFS CID.
     */
    onMatchFound?: (cid: string) => void;
    /** Max matches to request (default 3) */
    topK?: number;
    className?: string;
}
declare function FileProvenanceTag({ file, onViewDetail, onClaim, onMatchFound, topK, className, }: FileProvenanceTagProps): react_jsx_runtime.JSX.Element | null;

export { AIExtensionView, ActionCard, AttributionList, CidDisplay, ContribExtensionView, ContributionBar, EntityAvatar, EntityCard, FileOwnershipClaim, type FileOwnershipClaimProps, type FileOwnershipClaimResult, FileProvenanceTag, type FileProvenanceTagProps, FileUploadZone, LicenseChip, LicenseExtensionView, OnchainExtensionView, ProvenanceBadge, type ProvenanceBadgeProps, ProvenanceBundleView, ProvenanceGraph, type ProvenanceGraphProps, ProvenanceKitProvider, type ProvenanceKitProviderProps, type ProvenanceKitTheme, ProvenancePopover, ProvenanceSearch, type ProvenanceSearchProps, ProvenanceTracker, type ProvenanceTrackerProps, ResourceCard, RoleBadge, Timestamp, type UseDistributionResult, type UseProvenanceBundleResult, type UseProvenanceGraphResult, type UseSessionProvenanceResult, VerificationIndicator, VerificationView, bundleHasAI, cn, formatActionType, formatBps, formatBytes, formatChainName, formatCid, formatDate, formatDateAbsolute, formatRole, formatTxHash, getAIAgentSafe, getAIToolSafe, getContribSafe, getLicenseSafe, getOnchainSafe, getPrimaryCreator, getVerificationSafe, getWitnessSafe, useDistribution, useProvenanceBundle, useProvenanceGraph, useProvenanceKit, useSessionProvenance };
