import { z } from "zod";

/**
 * Namespace for identity proof extension.
 * @example "ext:identity@1.0.0"
 */
export const IDENTITY_NAMESPACE = "ext:identity@1.0.0" as const;

/**
 * Identity proof extension schema.
 *
 * Records how an entity proved ownership of their identity (public key)
 * at registration time. This is attached to the Entity record.
 *
 * @example
 * ```typescript
 * const entity = withIdentityProof(ent, {
 *   method: "key-ownership",
 *   verifiedAt: "2025-01-15T10:00:00Z",
 *   registrationSignature: "ab12...",
 * });
 * ```
 */
export const IdentityProofExtension = z.object({
  /** Method used to prove identity */
  method: z.enum(["key-ownership", "did-auth", "custom"]),

  /** When the identity was verified (ISO 8601) */
  verifiedAt: z.string().datetime(),

  /** Signature over the deterministic registration message (for key-ownership method) */
  registrationSignature: z.string().optional(),
});

export type IdentityProofExtension = z.infer<typeof IdentityProofExtension>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add identity proof extension to an entity.
 *
 * @param obj - The entity to extend
 * @param proof - Identity proof data
 * @returns Entity with identity proof extension
 */
export function withIdentityProof<T extends Extensible>(
  obj: T,
  proof: z.input<typeof IdentityProofExtension>
): T {
  const validated = IdentityProofExtension.parse(proof);
  return {
    ...obj,
    extensions: { ...obj.extensions, [IDENTITY_NAMESPACE]: validated },
  };
}

/**
 * Get identity proof extension from an entity.
 *
 * @param obj - The entity to read from
 * @returns Identity proof data or undefined if not present
 */
export function getIdentityProof(
  obj: Extensible
): IdentityProofExtension | undefined {
  const data = obj.extensions?.[IDENTITY_NAMESPACE];
  if (!data) return undefined;
  return IdentityProofExtension.parse(data);
}

/**
 * Check if an entity has an identity proof extension.
 *
 * @param obj - The entity to check
 * @returns True if identity proof extension exists
 */
export function hasIdentityProof(obj: Extensible): boolean {
  return obj.extensions?.[IDENTITY_NAMESPACE] !== undefined;
}
