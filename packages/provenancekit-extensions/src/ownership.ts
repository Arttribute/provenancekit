import { z } from "zod";

/**
 * Namespace for ownership claim extension.
 *
 * Attaches to an Action of type "ext:ownership:claim@1.0.0" to record
 * that an entity is asserting they are the rightful owner of a resource.
 * Filing a claim does NOT change the current ownership state — it creates
 * an immutable, timestamped record in the provenance chain that any
 * external resolution process can reference.
 */
export const OWNERSHIP_CLAIM_NAMESPACE = "ext:ownership:claim@1.0.0" as const;

/**
 * Namespace for ownership transfer extension.
 *
 * Attaches to an Action of type "ext:ownership:transfer@1.0.0" to record
 * that ownership of a resource moved from one entity to another.
 * The transfer is recorded permissively — any entity can submit one.
 * Trust is conveyed by the ext:verification@1.0.0 extension on the same
 * Action: "verified" means the current owner's registered key signed it;
 * "unverified" means it is a bare assertion that consumers may disregard.
 */
export const OWNERSHIP_TRANSFER_NAMESPACE =
  "ext:ownership:transfer@1.0.0" as const;

/**
 * Evidence types that a claimant can provide when asserting ownership.
 * The system records the type and an optional opaque reference — it does
 * not validate the evidence itself (that is the consumer's concern).
 */
export const OwnershipEvidenceType = z.enum([
  "self-declaration",       // No external proof — just a formal assertion
  "signed-content",         // Claimant can produce a signature over the raw content bytes
  "external-timestamp",     // Third-party timestamp (OpenTimestamps, RFC 3161, etc.)
  "legal-document",         // Court order, registered copyright, contract
  "third-party-attestation", // Another entity vouches for this claimant
]);
export type OwnershipEvidenceType = z.infer<typeof OwnershipEvidenceType>;

/**
 * Ownership claim extension schema.
 *
 * Attached to an Action of type "ext:ownership:claim@1.0.0".
 * The action's performedBy field identifies the claimant.
 * The action's inputs[0] is the resource being claimed.
 *
 * @example
 * ```typescript
 * const action = withOwnershipClaim(claimAction, {
 *   targetRef: "bafy...",
 *   evidenceType: "signed-content",
 *   evidenceRef: "sha256:abc123...",
 *   note: "I created this image on 2024-01-01, before it was registered.",
 * });
 * ```
 */
export const OwnershipClaimExtension = z.object({
  /** Content reference of the resource being claimed */
  targetRef: z.string(),

  /**
   * Type of evidence the claimant provides.
   * The system records this without validating it — resolution is external.
   */
  evidenceType: OwnershipEvidenceType,

  /**
   * Opaque reference to the evidence: a hash, URL, document ID, or any
   * string meaningful to the evidence type. Optional — a self-declaration
   * has no external reference by definition.
   */
  evidenceRef: z.string().optional(),

  /** Human-readable note providing context for the claim */
  note: z.string().optional(),
});

export type OwnershipClaimExtension = z.infer<typeof OwnershipClaimExtension>;

/**
 * Transfer types describe the authority under which ownership moved.
 * This is metadata for consumers — the system enforces nothing about it.
 */
export const OwnershipTransferType = z.enum([
  "voluntary",    // The current owner willingly transferred ownership
  "authorized",   // A system operator or trusted party authorized the transfer
  "adjudicated",  // An external arbiter (court, DAO vote, etc.) resolved a dispute
]);
export type OwnershipTransferType = z.infer<typeof OwnershipTransferType>;

/**
 * Ownership transfer extension schema.
 *
 * Attached to an Action of type "ext:ownership:transfer@1.0.0".
 * The action's performedBy field is the entity that submitted the transfer.
 * Trust is conveyed by ext:verification@1.0.0 on the same Action:
 *   - "verified"       → performedBy signed with the current owner's registered key
 *   - "receipt-backed" → server recorded it; a proof exists but not from the owner's key
 *   - "unverified"     → no cryptographic proof; bare assertion
 *
 * @example
 * ```typescript
 * const action = withOwnershipTransfer(transferAction, {
 *   targetRef: "bafy...",
 *   fromEntityId: "entity:alice",
 *   toEntityId: "entity:bob",
 *   transferType: "voluntary",
 *   note: "Alice transferred to Bob per their licensing agreement.",
 * });
 * ```
 */
export const OwnershipTransferExtension = z.object({
  /** Content reference of the resource being transferred */
  targetRef: z.string(),

  /** Entity ID of the previous owner at the time of this transfer */
  fromEntityId: z.string(),

  /** Entity ID of the new owner after this transfer */
  toEntityId: z.string(),

  /**
   * The authority under which this transfer is happening.
   * Does not affect system behaviour — informational for consumers.
   */
  transferType: OwnershipTransferType,

  /**
   * Optional reference linking this transfer to an authorizing event:
   * the Action ID of a prior claim, an external document hash, a legal ref, etc.
   */
  authorizationRef: z.string().optional(),

  /** Human-readable note */
  note: z.string().optional(),
});

export type OwnershipTransferExtension = z.infer<
  typeof OwnershipTransferExtension
>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/*──────────────────────────────────────────────────────────────*\
 | Ownership Claim helpers                                        |
\*──────────────────────────────────────────────────────────────*/

/**
 * Attach an ownership claim extension to an Action.
 *
 * @param obj   - The Action to extend
 * @param claim - Claim data (targetRef, evidenceType, …)
 * @returns The Action with the claim extension attached
 */
export function withOwnershipClaim<T extends Extensible>(
  obj: T,
  claim: z.input<typeof OwnershipClaimExtension>
): T {
  const validated = OwnershipClaimExtension.parse(claim);
  return {
    ...obj,
    extensions: { ...obj.extensions, [OWNERSHIP_CLAIM_NAMESPACE]: validated },
  };
}

/**
 * Read the ownership claim extension from an Action.
 *
 * @param obj - The Action to read from
 * @returns Claim data or undefined if not present
 */
export function getOwnershipClaim(
  obj: Extensible
): OwnershipClaimExtension | undefined {
  const data = obj.extensions?.[OWNERSHIP_CLAIM_NAMESPACE];
  if (!data) return undefined;
  return OwnershipClaimExtension.parse(data);
}

/**
 * Check whether an Action has an ownership claim extension.
 */
export function hasOwnershipClaim(obj: Extensible): boolean {
  return obj.extensions?.[OWNERSHIP_CLAIM_NAMESPACE] !== undefined;
}

/*──────────────────────────────────────────────────────────────*\
 | Ownership Transfer helpers                                     |
\*──────────────────────────────────────────────────────────────*/

/**
 * Attach an ownership transfer extension to an Action.
 *
 * @param obj      - The Action to extend
 * @param transfer - Transfer data (targetRef, fromEntityId, toEntityId, …)
 * @returns The Action with the transfer extension attached
 */
export function withOwnershipTransfer<T extends Extensible>(
  obj: T,
  transfer: z.input<typeof OwnershipTransferExtension>
): T {
  const validated = OwnershipTransferExtension.parse(transfer);
  return {
    ...obj,
    extensions: {
      ...obj.extensions,
      [OWNERSHIP_TRANSFER_NAMESPACE]: validated,
    },
  };
}

/**
 * Read the ownership transfer extension from an Action.
 *
 * @param obj - The Action to read from
 * @returns Transfer data or undefined if not present
 */
export function getOwnershipTransfer(
  obj: Extensible
): OwnershipTransferExtension | undefined {
  const data = obj.extensions?.[OWNERSHIP_TRANSFER_NAMESPACE];
  if (!data) return undefined;
  return OwnershipTransferExtension.parse(data);
}

/**
 * Check whether an Action has an ownership transfer extension.
 */
export function hasOwnershipTransfer(obj: Extensible): boolean {
  return obj.extensions?.[OWNERSHIP_TRANSFER_NAMESPACE] !== undefined;
}
