import { z } from "zod";

/**
 * Context URI for ProvenanceKit bundles
 * Used for versioning and identifying the schema
 */
export const CONTEXT_URI = "https://provenancekit.org/context/v2" as const;

/**
 * Extension namespace validation pattern.
 *
 * @remarks
 * Format: `ext:namespace[:sub]`
 *
 * @example
 * Valid namespaces: `ext:x402`, `ext:myorg:payments`
 */
const extensionNamespaceRegex = /^ext:[a-zA-Z]\w*(?::\w+)*$/;

/*─────────────────────────────────────────────────────────────*\
 | Content Addressing                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Core addressing schemes for content references.
 *
 * @remarks
 * - `cid`: Content Identifier (IPFS CIDv0/v1) - self-verifying
 * - `ar`: Arweave transaction ID - self-verifying
 * - `http`: HTTP/HTTPS URL - requires integrity hash for verification
 * - `hash`: Raw content hash - self-verifying
 *
 * Use `ext:namespace` pattern for custom schemes.
 */
export const AddressingSchemeCore = ["cid", "ar", "http", "hash"] as const;

/**
 * Extensible addressing scheme.
 * Accepts core schemes or custom `ext:namespace` extensions.
 */
export const AddressingScheme = z.union([
  z.enum(AddressingSchemeCore),
  z.string().regex(extensionNamespaceRegex, {
    message: 'Custom schemes must use "ext:" prefix (e.g., "ext:filecoin")',
  }),
]);
export type AddressingScheme = z.infer<typeof AddressingScheme>;

/**
 * Content reference for flexible content addressing.
 *
 * @remarks
 * **RECOMMENDED: Use IPFS CIDs (scheme: "cid") whenever possible.**
 *
 * CIDs are strongly recommended because they are:
 * - Self-verifying (hash is the identifier)
 * - Immutable (content cannot change)
 * - Decentralized (no single point of failure)
 * - Interoperable (supported by many systems)
 *
 * Other schemes are supported for flexibility, but may require additional
 * verification (integrity field) and don't guarantee immutability.
 *
 * @example
 * // IPFS CID (RECOMMENDED - self-verifying, immutable)
 * { ref: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", scheme: "cid" }
 *
 * // Arweave (self-verifying, immutable)
 * { ref: "ar://abc123xyz", scheme: "ar" }
 *
 * // HTTP with integrity hash (verifiable, but URL may change)
 * { ref: "https://example.com/file.png", scheme: "http", integrity: "sha256:abc123..." }
 *
 * // Raw hash (self-verifying, requires separate location)
 * { ref: "sha256:abc123...", scheme: "hash" }
 */
export const ContentReference = z.object({
  /**
   * The content identifier or locator.
   * For CIDs: the full CID string (e.g., "bafyabc..." or "Qm...")
   * For URLs: the full URL
   * For hashes: "algorithm:hex" format
   */
  ref: z.string().min(1),

  /** Addressing scheme used. Use "cid" for IPFS (recommended). */
  scheme: AddressingScheme,

  /**
   * Content hash for verification (optional).
   * Required for non-self-verifying schemes (http).
   * Not needed for cid, ar, or hash schemes.
   * Format: "algorithm:hex" (e.g., "sha256:abc123...")
   */
  integrity: z.string().optional(),

  /** Size in bytes (optional, useful for resources) */
  size: z.number().int().min(0).optional(),
});

export type ContentReference = z.infer<typeof ContentReference>;

/*─────────────────────────────────────────────────────────────*\
 | Content Reference Helpers                                     |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a CID-based content reference (recommended).
 *
 * @example
 * const ref = cidRef("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
 * // { ref: "bafy...", scheme: "cid" }
 */
export function cidRef(
  cid: string,
  size?: number
): z.infer<typeof ContentReference> {
  return { ref: cid, scheme: "cid", size };
}

/**
 * Create an HTTP-based content reference.
 * Requires integrity hash for verification.
 *
 * @example
 * const ref = httpRef("https://example.com/file.png", "sha256:abc123...");
 */
export function httpRef(
  url: string,
  integrity: string,
  size?: number
): z.infer<typeof ContentReference> {
  return { ref: url, scheme: "http", integrity, size };
}

/**
 * Create an Arweave-based content reference.
 *
 * @example
 * const ref = arRef("abc123xyz");
 */
export function arRef(
  txId: string,
  size?: number
): z.infer<typeof ContentReference> {
  return { ref: txId, scheme: "ar", size };
}

/**
 * Core entity roles defining who can perform actions.
 *
 * @remarks
 * Maps to **W3C PROV Agent types**.
 * This is a minimal set. Use the `ext:namespace` pattern for domain-specific roles.
 *
 * | EAA Role       | W3C PROV Equivalent |
 * |----------------|---------------------|
 * | `human`        | prov:Person         |
 * | `ai`           | prov:SoftwareAgent  |
 * | `organization` | prov:Organization   |
 */
export const EntityRoleCore = ["human", "ai", "organization"] as const;

/**
 * Core action types defining what operations can be performed.
 *
 * @remarks
 * Maps to **W3C PROV Activity patterns**.
 * Keep minimal and generic. Extend for specific domains using extensions.
 *
 * | EAA Action   | W3C PROV Equivalent    | Description                          |
 * |--------------|------------------------|--------------------------------------|
 * | `create`     | prov:Generation        | Create new resource from scratch     |
 * | `transform`  | prov:Derivation        | Transform input(s) into output(s)    |
 * | `aggregate`  | prov:Derivation        | Combine multiple inputs into one     |
 * | `verify`     | (extension)            | Attestation/validation of content    |
 *
 * For domain-specific actions, use extensions:
 * - `ext:ml:train` - Machine learning training
 * - `ext:code:commit` - Code commit
 * - `ext:media:remix` - Media remix
 */
export const ActionTypeCore = [
  "create",
  "transform",
  "aggregate",
  "verify",
] as const;

/**
 * Core attribution roles defining how entities relate to resources.
 *
 * @remarks
 * Maps to **W3C PROV Attribution/Association**.
 * Minimal set for general attribution. Use extensions for domain-specific roles.
 *
 * | EAA Role      | W3C PROV Equivalent       | Description                     |
 * |---------------|---------------------------|---------------------------------|
 * | `creator`     | prov:wasAttributedTo      | Primary creator of the resource |
 * | `contributor` | prov:wasAssociatedWith    | Contributed to the action       |
 * | `source`      | prov:wasDerivedFrom       | Provided source material        |
 *
 * For domain-specific roles, use extensions:
 * - `ext:media:editor` - Media editor
 * - `ext:code:reviewer` - Code reviewer
 * - `ext:ai:prompter` - AI prompt author
 */
export const AttributionRoleCore = [
  "creator",
  "contributor",
  "source",
] as const;

/**
 * Core resource types defining what content can be tracked.
 *
 * @remarks
 * Covers common content types. Use extensions for specialized types.
 */
export const ResourceTypeCore = [
  "text",
  "image",
  "audio",
  "video",
  "code",
  "dataset",
  "model",
  "other",
] as const;

/**
 * Creates an extensible enum that accepts core values or custom extensions.
 *
 * @remarks
 * Allows domain-specific extensions using the `ext:namespace` pattern while
 * maintaining type safety for core values.
 *
 * @param core - The core Zod enum to extend
 * @returns A union schema accepting core values or extension strings
 */
const makeExtensibleEnum = <T extends z.ZodEnum<[string, ...string[]]>>(
  core: T
) =>
  z.union([
    core,
    z.string().regex(extensionNamespaceRegex, {
      message:
        'Custom values must use "ext:" namespace prefix (e.g., "ext:myorg:type")',
    }),
  ]);

/**
 * Extensible entity role schema and type.
 * Accepts core roles or custom `ext:namespace` extensions.
 */
export const EntityRole = makeExtensibleEnum(z.enum(EntityRoleCore));
export type EntityRole = z.infer<typeof EntityRole>;

/**
 * Extensible action type schema and type.
 * Accepts core actions or custom `ext:namespace` extensions.
 */
export const ActionType = makeExtensibleEnum(z.enum(ActionTypeCore));
export type ActionType = z.infer<typeof ActionType>;

/**
 * Extensible attribution role schema and type.
 * Accepts core roles or custom `ext:namespace` extensions.
 */
export const AttributionRole = makeExtensibleEnum(z.enum(AttributionRoleCore));
export type AttributionRole = z.infer<typeof AttributionRole>;

/**
 * Extensible resource type schema and type.
 * Accepts core types or custom `ext:namespace` extensions.
 */
export const ResourceType = makeExtensibleEnum(z.enum(ResourceTypeCore));
export type ResourceType = z.infer<typeof ResourceType>;


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
export const Entity = z.object({
  /** Unique identifier (DID, wallet address, UUID, etc.) */
  id: z.string().min(1),

  /** Human-readable name */
  name: z.string().optional(),

  /** Role classification */
  role: EntityRole,

  /** Public key for signature verification (optional) */
  publicKey: z.string().optional(),

  /** Arbitrary metadata (keep minimal, use extensions for domain data) */
  metadata: z.record(z.unknown()).optional(),

  /** Extension data (namespaced key-value pairs) */
  extensions: z.record(z.unknown()).optional(),
});

export type Entity = z.infer<typeof Entity>;

/**
 * Location schema specifying where a resource can be accessed.
 */
export const Location = z.object({
  /** URI to access the resource (ipfs://, https://, ar://, etc.) */
  uri: z.string(),

  /** Provider name (optional, e.g., "pinata", "arweave") */
  provider: z.string().optional(),
});

export type Location = z.infer<typeof Location>;

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
export const Resource = z.object({
  /** Content reference - the immutable identity of this resource */
  address: ContentReference,

  /** Type classification */
  type: ResourceType,

  /**
   * Optional storage location hints.
   *
   * These are convenience pointers for WHERE to find the resource.
   * They are NOT part of the resource identity and may change over time.
   * The `address` field is the authoritative identifier.
   */
  locations: z.array(Location).default([]),

  /** When created (ISO 8601 timestamp) */
  createdAt: z.string().datetime(),

  /** Who created it (Entity.id) */
  createdBy: z.string(),

  /** Root action that created this resource (Action.id) */
  rootAction: z.string(),

  /** Extension data (for licensing, NFTs, storage metadata, etc.) */
  extensions: z.record(z.unknown()).optional(),
});

export type Resource = z.infer<typeof Resource>;

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
export const Action = z.object({
  /** Unique identifier (UUID, tx hash, etc.) */
  id: z.string().min(1),

  /** Type of action performed */
  type: ActionType,

  /** Entity that performed this action (Entity.id) */
  performedBy: z.string(),

  /** When action occurred (ISO 8601 timestamp) */
  timestamp: z.string().datetime(),

  /** Input resources consumed */
  inputs: z.array(ContentReference).default([]),

  /** Output resources produced */
  outputs: z.array(ContentReference).default([]),

  /** Cryptographic proof (signature, tx hash, etc.) */
  proof: z.string().optional(),

  /** Extension data (for tools, plans, timing, etc.) */
  extensions: z.record(z.unknown()).optional(),
});

export type Action = z.infer<typeof Action>;

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
export const Attribution = z
  .object({
    /**
     * Optional unique identifier for this attribution record.
     *
     * Recommended format: "attr:{hash}" where hash is derived from content.
     * Use `generateAttributionId()` for the recommended approach.
     */
    id: z.string().optional(),

    /** The resource being attributed (optional if actionId provided) */
    resourceRef: ContentReference.optional(),

    /** The action being attributed (optional if resourceRef provided) */
    actionId: z.string().optional(),

    /** The entity receiving attribution (Entity.id) */
    entityId: z.string(),

    /** Their role in the creation */
    role: AttributionRole,

    /** Optional note explaining the contribution */
    note: z.string().optional(),

    /** Extension data (for weights, payments, etc.) */
    extensions: z.record(z.unknown()).optional(),
  })
  .refine((data) => data.resourceRef || data.actionId, {
    message: "Either resourceRef or actionId must be provided",
  });

export type Attribution = z.infer<typeof Attribution>;

/*─────────────────────────────────────────────────────────────*\
 | Attribution ID Generation                                     |
\*─────────────────────────────────────────────────────────────*/

/**
 * Standard attribution ID prefix.
 * Recommended format: "attr:{hash}"
 */
export const ATTRIBUTION_ID_PREFIX = "attr:" as const;

/**
 * Create a canonical string for attribution ID generation.
 *
 * This creates a deterministic string from attribution content that can be hashed.
 * The same attribution will always produce the same canonical string.
 *
 * @param attr - Attribution data (without id)
 * @returns Canonical string representation
 *
 * @example
 * const canonical = getAttributionCanonical({
 *   resourceRef: { ref: "bafy...", scheme: "cid" },
 *   entityId: "user123",
 *   role: "creator"
 * });
 * // "res:bafy...|ent:user123|role:creator"
 */
export function getAttributionCanonical(
  attr: Omit<z.infer<typeof Attribution>, "id">
): string {
  // Determine target (resource or action)
  const target = attr.resourceRef
    ? `res:${attr.resourceRef.ref}`
    : `act:${attr.actionId}`;

  // Create canonical string: target|entity|role
  return `${target}|ent:${attr.entityId}|role:${attr.role}`;
}

/**
 * Generate an attribution ID using a simple hash.
 *
 * This is a RECOMMENDED approach, not required. Uses a simple
 * djb2 hash for environments without crypto APIs. For production,
 * consider using SHA-256 or similar.
 *
 * @param attr - Attribution data (without id)
 * @returns Attribution ID in format "attr:{hash}"
 *
 * @example
 * const id = generateAttributionId({
 *   resourceRef: { ref: "bafy...", scheme: "cid" },
 *   entityId: "user123",
 *   role: "creator"
 * });
 * // "attr:a1b2c3d4"
 */
export function generateAttributionId(
  attr: Omit<z.infer<typeof Attribution>, "id">
): string {
  const canonical = getAttributionCanonical(attr);
  const hash = simpleHash(canonical);
  return `${ATTRIBUTION_ID_PREFIX}${hash}`;
}

/**
 * Generate an attribution ID using a custom hash function.
 *
 * Use this when you need a specific hash algorithm (SHA-256, etc.)
 *
 * @param attr - Attribution data (without id)
 * @param hashFn - Your hash function (string -> string)
 * @returns Attribution ID in format "attr:{hash}"
 *
 * @example
 * // Using Web Crypto API
 * const id = await generateAttributionIdWithHash(attr, async (s) => {
 *   const bytes = new TextEncoder().encode(s);
 *   const hash = await crypto.subtle.digest('SHA-256', bytes);
 *   return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
 * });
 */
export function generateAttributionIdWithHash(
  attr: Omit<z.infer<typeof Attribution>, "id">,
  hashFn: (input: string) => string
): string {
  const canonical = getAttributionCanonical(attr);
  const hash = hashFn(canonical);
  return `${ATTRIBUTION_ID_PREFIX}${hash}`;
}

/**
 * Simple djb2 hash function.
 * Good enough for deduplication, not for security.
 * Returns 8 hex characters.
 *
 * @internal
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Bundle signature schema.
 *
 * @remarks
 * Contains the cryptographic signature of a provenance bundle's content,
 * enabling verification that the bundle has not been tampered with.
 */
export const BundleSignature = z.object({
  /** Signing algorithm used */
  algorithm: z.enum(["Ed25519", "ECDSA-secp256k1"]),

  /** Public key of the signer (hex-encoded) */
  publicKey: z.string(),

  /** Signature bytes (hex-encoded) */
  signature: z.string(),

  /** When the bundle was signed (ISO 8601) */
  timestamp: z.string().datetime(),
});

export type BundleSignature = z.infer<typeof BundleSignature>;

/**
 * ProvenanceBundle schema for complete provenance packages.
 *
 * @remarks
 * A self-contained bundle of all provenance information for one or more resources.
 * Can be exported, shared, and independently verified.
 */
export const ProvenanceBundle = z.object({
  /** Context identifier (for versioning and schema identification) */
  context: z.literal(CONTEXT_URI),

  /** All entities involved */
  entities: z.array(Entity).default([]),

  /** All resources tracked */
  resources: z.array(Resource).default([]),

  /** All actions performed */
  actions: z.array(Action).default([]),

  /** All attributions */
  attributions: z.array(Attribution).default([]),

  /** Extension data (bundle-level metadata) */
  extensions: z.record(z.unknown()).optional(),

  /** Optional cryptographic signature of the bundle */
  signature: BundleSignature.optional(),
});

export type ProvenanceBundle = z.infer<typeof ProvenanceBundle>;

// Re-export core enum values for convenience
export type EntityRoleCore = (typeof EntityRoleCore)[number];
export type ActionTypeCore = (typeof ActionTypeCore)[number];
export type AttributionRoleCore = (typeof AttributionRoleCore)[number];
export type ResourceTypeCore = (typeof ResourceTypeCore)[number];
export type AddressingSchemeCore = (typeof AddressingSchemeCore)[number];
