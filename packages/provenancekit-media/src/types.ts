/**
 * Core types for @provenancekit/media
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type {
  Action as EAAAction,
  Attribution as EAAAttribution,
  Entity as EAAEntity,
  ContentReference,
} from "@provenancekit/eaa-types";

/*─────────────────────────────────────────────────────────────*\
 | Internal Media Types                                         |
 |                                                               |
 | These are simplified types for the media package that are    |
 | easier to work with than the strict EAA types. They can be   |
 | converted to/from EAA types when needed.                     |
\*─────────────────────────────────────────────────────────────*/

/**
 * Simplified Resource type for media package.
 * Contains the essential fields for media provenance.
 */
export interface MediaResource {
  /** Unique identifier */
  id: string;

  /** Resource type (image, video, audio, other) */
  type: string;

  /** Content reference for addressing */
  contentRef: ContentReference;

  /** Human-readable name/title */
  name?: string;

  /** Content hash */
  hash?: string;

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;

  /** Extension data */
  extensions?: Record<string, unknown>;
}

/**
 * Simplified Action type for media package.
 */
export interface MediaAction {
  /** Unique identifier */
  id: string;

  /** Action type */
  type: string;

  /** Entity that performed this action */
  performedBy: string;

  /** When action occurred */
  timestamp: string;

  /** Input references */
  inputs: ContentReference[];

  /** Output references */
  outputs: ContentReference[];

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;

  /** Extension data */
  extensions?: Record<string, unknown>;
}

/**
 * Simplified Attribution type for media package.
 */
export interface MediaAttribution {
  /** Optional identifier */
  id?: string;

  /** Entity receiving attribution */
  entityId: string;

  /** Attribution role */
  role: string;

  /** Resource reference (optional) */
  resourceRef?: ContentReference;

  /** Action ID (optional) */
  actionId?: string;

  /** Optional note */
  note?: string;

  /** Extension data */
  extensions?: Record<string, unknown>;
}

/**
 * Simplified Entity type for media package.
 */
export interface MediaEntity {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name?: string;

  /** Role (human, ai, organization) */
  role: string;

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;

  /** Extension data */
  extensions?: Record<string, unknown>;
}

// Re-export for backwards compatibility
export type Resource = MediaResource;
export type Action = MediaAction;
export type Attribution = MediaAttribution;
export type Entity = MediaEntity;

/*─────────────────────────────────────────────────────────────*\
 | C2PA Extension Schema                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Namespace for C2PA extension.
 * @example "ext:c2pa@1.0.0"
 */
export const C2PA_NAMESPACE = "ext:c2pa@1.0.0" as const;

/**
 * C2PA action types as defined in the specification.
 */
export const C2PAActionType = z.enum([
  "c2pa.created",
  "c2pa.placed",
  "c2pa.cropped",
  "c2pa.resized",
  "c2pa.edited",
  "c2pa.filtered",
  "c2pa.color_adjusted",
  "c2pa.orientation",
  "c2pa.converted",
  "c2pa.opened",
  "c2pa.unknown",
  "c2pa.drawing",
  "c2pa.published",
  "c2pa.transcoded",
  "c2pa.repackaged",
  "c2pa.removed",
]);

export type C2PAActionType = z.infer<typeof C2PAActionType>;

/**
 * C2PA actor (who performed an action).
 */
export const C2PAActor = z.object({
  /** Actor type (human, AI, organization) */
  type: z.enum(["human", "ai", "organization"]).optional(),

  /** Actor name */
  name: z.string().optional(),

  /** Actor identifier (URI, DID, etc.) */
  identifier: z.string().optional(),

  /** Credentials or certificates */
  credentials: z
    .array(
      z.object({
        type: z.string(),
        url: z.string().optional(),
      })
    )
    .optional(),
});

export type C2PAActor = z.infer<typeof C2PAActor>;

/**
 * C2PA action record.
 */
export const C2PAAction = z.object({
  /** Action type */
  action: C2PAActionType,

  /** When the action occurred */
  when: z.string().datetime().optional(),

  /** Software agent that performed the action */
  softwareAgent: z
    .object({
      name: z.string(),
      version: z.string().optional(),
    })
    .optional(),

  /** Actor who performed the action */
  actors: z.array(C2PAActor).optional(),

  /** Parameters for the action */
  parameters: z.record(z.unknown()).optional(),

  /** Digital source type */
  digitalSourceType: z.string().optional(),

  /** Reason for the action */
  reason: z.string().optional(),

  /** Related actions */
  relatedActions: z.array(z.string()).optional(),
});

export type C2PAAction = z.infer<typeof C2PAAction>;

/**
 * C2PA ingredient (source material).
 */
export const C2PAIngredient = z.object({
  /** Ingredient title */
  title: z.string(),

  /** Format/MIME type */
  format: z.string().optional(),

  /** Document ID */
  documentId: z.string().optional(),

  /** Instance ID */
  instanceId: z.string().optional(),

  /** Hash of the ingredient */
  hash: z.string().optional(),

  /** Whether this is the parent ingredient */
  isParent: z.boolean().optional(),

  /** Relationship to the current asset */
  relationship: z.enum(["parentOf", "componentOf", "inputTo"]).optional(),

  /** Thumbnail data */
  thumbnail: z
    .object({
      format: z.string(),
      data: z.string().optional(), // Base64
    })
    .optional(),

  /** Validation status */
  validationStatus: z
    .array(
      z.object({
        code: z.string(),
        url: z.string().optional(),
        explanation: z.string().optional(),
      })
    )
    .optional(),
});

export type C2PAIngredient = z.infer<typeof C2PAIngredient>;

/**
 * C2PA claim signature information.
 */
export const C2PASignature = z.object({
  /** Algorithm used */
  algorithm: z.string(),

  /** Certificate chain */
  certificateChain: z.array(z.string()).optional(),

  /** Issuer */
  issuer: z.string().optional(),

  /** Timestamp */
  timestamp: z.string().datetime().optional(),

  /** Time stamp authority URL */
  tsaUrl: z.string().optional(),
});

export type C2PASignature = z.infer<typeof C2PASignature>;

/**
 * C2PA manifest extension data.
 * Attached to Resource to represent C2PA content credentials.
 */
export const C2PAExtension = z.object({
  /** Manifest label/identifier */
  manifestLabel: z.string(),

  /** Claim generator (tool that created the manifest) */
  claimGenerator: z.string(),

  /** Claim generator version */
  claimGeneratorVersion: z.string().optional(),

  /** Title of the asset */
  title: z.string().optional(),

  /** Format/MIME type */
  format: z.string().optional(),

  /** Instance ID */
  instanceId: z.string().optional(),

  /** Actions performed on the asset */
  actions: z.array(C2PAAction).optional(),

  /** Ingredients (source materials) */
  ingredients: z.array(C2PAIngredient).optional(),

  /** Signature information */
  signature: C2PASignature.optional(),

  /** Validation status */
  validationStatus: z
    .object({
      isValid: z.boolean(),
      errors: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),

  /** Whether manifest is embedded or remote */
  isEmbedded: z.boolean().optional(),

  /** Remote manifest URL (if not embedded) */
  remoteUrl: z.string().optional(),

  /** AI disclosure */
  aiDisclosure: z
    .object({
      isAIGenerated: z.boolean(),
      aiTool: z.string().optional(),
      trainingDataUsed: z.boolean().optional(),
    })
    .optional(),

  /** Creative work assertion */
  creativeWork: z
    .object({
      author: z.array(z.string()).optional(),
      dateCreated: z.string().optional(),
      copyright: z.string().optional(),
    })
    .optional(),
});

export type C2PAExtension = z.infer<typeof C2PAExtension>;

/*─────────────────────────────────────────────────────────────*\
 | Reader Types                                                 |
\*─────────────────────────────────────────────────────────────*/

/**
 * Options for reading C2PA manifests.
 */
export interface ReadManifestOptions {
  /** Whether to verify the manifest */
  verify?: boolean;

  /** Whether to verify trust chain */
  verifyTrust?: boolean;

  /** Path to trust anchors */
  trustAnchors?: string;

  /** Whether to fetch remote manifests */
  fetchRemote?: boolean;
}

/**
 * Result of reading a C2PA manifest.
 */
export interface ManifestReadResult {
  /** The C2PA extension data */
  c2pa: C2PAExtension;

  /** Converted EAA Resource */
  resource: Resource;

  /** Converted EAA Actions */
  actions: Action[];

  /** Converted EAA Attributions */
  attributions: Attribution[];

  /** Converted EAA Entities */
  entities: Entity[];

  /** Raw manifest JSON (for debugging/advanced use) */
  rawManifest?: unknown;
}

/*─────────────────────────────────────────────────────────────*\
 | Writer Types                                                 |
\*─────────────────────────────────────────────────────────────*/

/**
 * Signer configuration for writing manifests.
 */
export interface SignerConfig {
  /** Certificate (PEM or DER) */
  certificate: Buffer | string;

  /** Private key (PEM or DER) */
  privateKey: Buffer | string;

  /** Signing algorithm */
  algorithm: "es256" | "es384" | "es512" | "ps256" | "ps384" | "ps512" | "ed25519";

  /** Time stamp authority URL */
  tsaUrl?: string;
}

/**
 * Options for writing C2PA manifests.
 */
export interface WriteManifestOptions {
  /** Signer configuration */
  signer: SignerConfig;

  /** Claim generator info */
  claimGenerator?: {
    name: string;
    version?: string;
  };

  /** Title for the asset */
  title?: string;

  /** Actions to record */
  actions?: Array<{
    action: C2PAActionType;
    softwareAgent?: { name: string; version?: string };
    when?: string;
    digitalSourceType?: string;
  }>;

  /** Ingredients (source materials) */
  ingredients?: Array<{
    path: string;
    title?: string;
    relationship?: "parentOf" | "componentOf" | "inputTo";
  }>;

  /** AI disclosure */
  aiDisclosure?: {
    isAIGenerated: boolean;
    aiTool?: string;
  };

  /** Creative work info */
  creativeWork?: {
    author?: string[];
    copyright?: string;
  };
}

/**
 * Result of writing a C2PA manifest.
 */
export interface ManifestWriteResult {
  /** Path to the output file */
  outputPath: string;

  /** The manifest label */
  manifestLabel: string;

  /** The C2PA extension data */
  c2pa: C2PAExtension;

  /** Converted EAA Resource */
  resource: Resource;
}

/*─────────────────────────────────────────────────────────────*\
 | Error Types                                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Error codes for media operations.
 */
export type MediaErrorCode =
  | "NO_MANIFEST"
  | "INVALID_MANIFEST"
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "SIGNING_FAILED"
  | "READING_FAILED"
  | "C2PA_NOT_AVAILABLE";

/**
 * Error thrown by media operations.
 */
export class MediaError extends Error {
  constructor(
    message: string,
    public readonly code: MediaErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MediaError";
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Supported Formats                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Media formats supported by C2PA.
 */
export const SUPPORTED_FORMATS = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "application/pdf",
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/**
 * Check if a MIME type is supported.
 */
export function isSupportedFormat(mimeType: string): mimeType is SupportedFormat {
  return SUPPORTED_FORMATS.includes(mimeType as SupportedFormat);
}

/**
 * Get MIME type from file extension.
 */
export function getMimeTypeFromExtension(ext: string): SupportedFormat | undefined {
  const extLower = ext.toLowerCase().replace(/^\./, "");
  const mapping: Record<string, SupportedFormat> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    heif: "image/heif",
    avif: "image/avif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    pdf: "application/pdf",
  };
  return mapping[extLower];
}
