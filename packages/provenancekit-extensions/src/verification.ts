import { z } from "zod";

/**
 * Namespace for verification result extension.
 * @example "ext:verification@1.0.0"
 */
export const VERIFICATION_NAMESPACE = "ext:verification@1.0.0" as const;

/**
 * Claim verification status levels.
 *
 * - `verified`: Cryptographically verified (signature checked, proof valid)
 * - `receipt-backed`: Backed by API receipt but not cryptographic proof
 * - `unverified`: Self-declared, no evidence provided
 * - `failed`: Verification was attempted but the proof was invalid
 * - `skipped`: Verification was skipped (proofPolicy = "off" or not applicable)
 */
export const ClaimStatus = z.enum([
  "verified",
  "receipt-backed",
  "unverified",
  "failed",
  "skipped",
]);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

/**
 * Per-claim verification detail.
 */
const ClaimDetail = z.object({
  /** Verification status for this claim */
  status: ClaimStatus,
  /** Human-readable detail about the verification */
  detail: z.string().optional(),
});

/**
 * Verification result extension schema.
 *
 * Attached to every Action to provide a transparent record of what
 * provenance claims were verified and to what level. Consumers can
 * inspect this to understand the trustworthiness of the provenance.
 *
 * @example
 * ```typescript
 * const action = withVerification(act, {
 *   status: "verified",
 *   claims: {
 *     identity: { status: "verified", detail: "key-ownership" },
 *     action: { status: "verified", detail: "Ed25519 signature valid" },
 *     output: { status: "verified", detail: "server witness present" },
 *     tool: { status: "receipt-backed", detail: "API receipt included" },
 *     inputs: { status: "verified", detail: "2/2 inputs exist" },
 *   },
 *   verifiedAt: "2025-01-15T10:00:00Z",
 *   policyUsed: "enforce",
 * });
 * ```
 */
export const VerificationExtension = z.object({
  /** Overall verification status */
  status: z.enum(["verified", "partial", "unverified", "skipped"]),

  /** Per-claim verification breakdown */
  claims: z.object({
    /** Entity identity verification */
    identity: ClaimDetail,
    /** Action authorization verification */
    action: ClaimDetail,
    /** Output binding verification */
    output: ClaimDetail,
    /** Tool usage attestation (optional — only present if tool was declared) */
    tool: ClaimDetail.optional(),
    /** Input existence validation (optional — only present if inputs were declared) */
    inputs: ClaimDetail.optional(),
  }),

  /** When verification was performed (ISO 8601) */
  verifiedAt: z.string().datetime(),

  /** The proof policy that was active during verification */
  policyUsed: z.enum(["enforce", "warn", "off"]),
});

export type VerificationExtension = z.infer<typeof VerificationExtension>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add verification result extension to an action.
 *
 * @param obj - The action to extend
 * @param verification - Verification result data
 * @returns Action with verification extension
 */
export function withVerification<T extends Extensible>(
  obj: T,
  verification: z.input<typeof VerificationExtension>
): T {
  const validated = VerificationExtension.parse(verification);
  return {
    ...obj,
    extensions: {
      ...obj.extensions,
      [VERIFICATION_NAMESPACE]: validated,
    },
  };
}

/**
 * Get verification result extension from an action.
 *
 * @param obj - The action to read from
 * @returns Verification result or undefined if not present
 */
export function getVerification(
  obj: Extensible
): VerificationExtension | undefined {
  const data = obj.extensions?.[VERIFICATION_NAMESPACE];
  if (!data) return undefined;
  return VerificationExtension.parse(data);
}

/**
 * Check if an action has been fully verified (all claims verified).
 *
 * @param obj - The action to check
 * @returns True if overall status is "verified"
 */
export function isFullyVerified(obj: Extensible): boolean {
  const v = getVerification(obj);
  return v?.status === "verified";
}
