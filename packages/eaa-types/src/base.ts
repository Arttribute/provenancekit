import { z } from "zod";

/**
 * Context URI for ProvenanceKit bundles
 * Used for versioning and identifying the schema
 */
export const CONTEXT_URI = "https://provenancekit.org/context/v1" as const;

/**
 * IPFS CID validation pattern for v0 and v1 CIDs.
 *
 * @remarks
 * - CIDv0: Starts with "Qm" (base58, 46 chars)
 * - CIDv1: Starts with "bafy" (base32, 59+ chars)
 */
const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[1-9A-HJ-NP-Za-km-z]{56,})$/;

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

/**
 * Core entity roles defining who can perform actions.
 *
 * @remarks
 * This is a minimal set. Use the `ext:namespace` pattern for domain-specific roles.
 */
export const EntityRoleCore = ["human", "ai", "organization"] as const;

/**
 * Core action types defining what operations can be performed.
 *
 * @remarks
 * Keep minimal and generic. Extend for specific domains using extensions.
 *
 * - `create`: Created from scratch
 * - `transform`: Transformed from inputs
 * - `aggregate`: Combined multiple inputs
 * - `verify`: Verified/validated
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
 * Minimal set for general attribution. Use extensions for domain-specific roles.
 *
 * - `creator`: Primary creator
 * - `contributor`: Contributed to creation
 * - `source`: Provided source material
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
 * Content-addressed identifier for IPFS resources.
 *
 * @remarks
 * Provides an immutable reference to content using cryptographic hashing.
 * Supports both CIDv0 and CIDv1 formats.
 */
export const ContentAddress = z.object({
  /** IPFS Content Identifier */
  cid: z.string().regex(cidRegex, { message: "Invalid IPFS CID format" }),

  /** Size in bytes */
  size: z.number().int().min(0),

  /** Hashing algorithm used */
  algorithm: z.enum(["sha256", "blake3"]).default("sha256"),
});

export type ContentAddress = z.infer<typeof ContentAddress>;

/**
 * Entity schema representing an agent that performs actions.
 *
 * @remarks
 * Maps to W3C PROV Agent. Represents humans, AI systems, organizations,
 * or any actor that can create, modify, or verify resources.
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
 * Maps to W3C PROV Entity. Represents any artifact with provenance
 * (files, images, text, models, datasets, etc.) identified by content hash.
 */
export const Resource = z.object({
  /** Content address (primary key, immutable) */
  address: ContentAddress,

  /** Type classification */
  type: ResourceType,

  /** Where this resource can be accessed (at least one location) */
  locations: z.array(Location).min(1),

  /** When created (ISO 8601 timestamp) */
  createdAt: z.string().datetime(),

  /** Who created it (Entity.id) */
  createdBy: z.string(),

  /** Root action that created this resource (Action.id) */
  rootAction: z.string(),

  /** Extension data (for licensing, NFTs, etc.) */
  extensions: z.record(z.unknown()).optional(),
});

export type Resource = z.infer<typeof Resource>;

/**
 * Action schema representing an activity performed by an entity.
 *
 * @remarks
 * Maps to W3C PROV Activity. Represents a transformation: inputs → process → outputs.
 * This is the core of provenance tracking.
 */
export const Action = z.object({
  /** Unique identifier (UUID, tx hash, CID of action description) */
  id: z.string().min(1),

  /** Type of action performed */
  type: ActionType,

  /** Entity that performed this action (Entity.id) */
  performedBy: z.string(),

  /** When action occurred (ISO 8601 timestamp) */
  timestamp: z.string().datetime(),

  /** Input resources consumed (CIDs) */
  inputs: z.array(z.string().regex(cidRegex)).default([]),

  /** Output resources produced (CIDs) */
  outputs: z.array(z.string().regex(cidRegex)).default([]),

  /** Cryptographic proof (signature, tx hash, etc.) */
  proof: z.string().optional(),

  /** Extension data (for tools, plans, timing, etc.) */
  extensions: z.record(z.unknown()).optional(),
});

export type Action = z.infer<typeof Action>;

/**
 * Attribution schema linking an entity to a resource.
 *
 * @remarks
 * Maps to W3C PROV Attribution. Records WHO was involved in creating WHAT.
 * Pure attribution with no assumptions about weights or payments.
 */
export const Attribution = z.object({
  /** The resource being attributed (CID) */
  resourceCid: z.string().regex(cidRegex),

  /** The entity receiving attribution (Entity.id) */
  entityId: z.string(),

  /** Their role in creating the resource */
  role: AttributionRole,

  /** Optional note explaining the contribution */
  note: z.string().optional(),

  /** Extension data (for weights, payments, etc.) */
  extensions: z.record(z.unknown()).optional(),
});

export type Attribution = z.infer<typeof Attribution>;

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
});

export type ProvenanceBundle = z.infer<typeof ProvenanceBundle>;

// Re-export core enum values for convenience
export type EntityRoleCore = (typeof EntityRoleCore)[number];
export type ActionTypeCore = (typeof ActionTypeCore)[number];
export type AttributionRoleCore = (typeof AttributionRoleCore)[number];
export type ResourceTypeCore = (typeof ResourceTypeCore)[number];
