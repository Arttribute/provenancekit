import { z } from "zod";

/**
 * Namespace for action proof extension.
 * @example "ext:proof@1.0.0"
 */
export const PROOF_NAMESPACE = "ext:proof@1.0.0" as const;

/**
 * Action proof extension schema.
 *
 * Cryptographic proof that a specific entity authorized an action.
 * Binds the entity's identity to the action via a signature over the
 * canonical action payload (entityId, actionType, inputs, timestamp).
 *
 * @example
 * ```typescript
 * const action = withProof(act, {
 *   algorithm: "Ed25519",
 *   publicKey: "ab12...",
 *   signature: "cd34...",
 *   timestamp: "2025-01-15T10:00:00Z",
 * });
 * ```
 */
export const ProofExtension = z.object({
  /** Signing algorithm used */
  algorithm: z.enum(["Ed25519", "ECDSA-secp256k1"]),

  /** Public key of the signer (hex-encoded) */
  publicKey: z.string(),

  /** Signature bytes (hex-encoded) */
  signature: z.string(),

  /** When the proof was created (ISO 8601) */
  timestamp: z.string().datetime(),
});

export type ProofExtension = z.infer<typeof ProofExtension>;

/**
 * Convenience alias — the proof data shape used by signing functions.
 */
export type ActionProof = ProofExtension;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add proof extension to any extensible object (typically an Action).
 *
 * @param obj - The object to extend
 * @param proof - Proof data
 * @returns Object with proof extension
 */
export function withProof<T extends Extensible>(
  obj: T,
  proof: z.input<typeof ProofExtension>
): T {
  const validated = ProofExtension.parse(proof);
  return {
    ...obj,
    extensions: { ...obj.extensions, [PROOF_NAMESPACE]: validated },
  };
}

/**
 * Get proof extension from any extensible object.
 *
 * @param obj - The object to read from
 * @returns Proof data or undefined if not present
 */
export function getProof(obj: Extensible): ProofExtension | undefined {
  const data = obj.extensions?.[PROOF_NAMESPACE];
  if (!data) return undefined;
  return ProofExtension.parse(data);
}

/**
 * Check if an object has proof extension.
 *
 * @param obj - The object to check
 * @returns True if proof extension exists
 */
export function hasProof(obj: Extensible): boolean {
  return obj.extensions?.[PROOF_NAMESPACE] !== undefined;
}
