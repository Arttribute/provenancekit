import { z } from "zod";

/**
 * Namespace for tool attestation extension.
 * @example "ext:tool-attestation@1.0.0"
 */
export const TOOL_ATTESTATION_NAMESPACE = "ext:tool-attestation@1.0.0" as const;

/**
 * Attestation trust levels for tool usage claims.
 *
 * - `provider-signed`: Tool provider cryptographically attests to the interaction
 * - `receipt-backed`: API receipt metadata (request ID, response hash, headers) included
 * - `self-declared`: Caller claims tool usage with no external evidence
 */
export const ToolAttestationLevel = z.enum([
  "provider-signed",
  "receipt-backed",
  "self-declared",
]);
export type ToolAttestationLevel = z.infer<typeof ToolAttestationLevel>;

/**
 * Provider signature for tool attestation.
 * The tool provider signs a payload attesting to the interaction.
 */
export const ProviderSignature = z.object({
  /** Provider's public key (hex-encoded) */
  publicKey: z.string(),

  /** Provider's signature (hex-encoded) */
  signature: z.string(),

  /** Signing algorithm */
  algorithm: z.enum(["Ed25519", "ECDSA-secp256k1"]),

  /** Hash of the signed payload (for transparency) */
  signedPayloadHash: z.string(),
});

/**
 * API receipt evidence for tool attestation.
 * Includes metadata from the tool provider's API response.
 */
export const ToolReceipt = z.object({
  /** Request ID from the API response */
  requestId: z.string().optional(),

  /** Hash of the API response body */
  responseHash: z.string().optional(),

  /** Relevant response headers (e.g., x-request-id, x-model-version) */
  headers: z.record(z.string()).optional(),

  /** Timestamp from the API response */
  responseTimestamp: z.string().optional(),
});

/**
 * Tool attestation extension schema.
 *
 * Records the level of evidence backing a tool usage claim.
 * Attached to Actions alongside the AI tool extension (ext:ai@1.0.0).
 *
 * @example
 * ```typescript
 * // Provider-signed attestation (highest trust)
 * const action = withToolAttestation(act, {
 *   level: "provider-signed",
 *   providerSignature: {
 *     publicKey: "ab12...",
 *     signature: "cd34...",
 *     algorithm: "Ed25519",
 *     signedPayloadHash: "sha256:...",
 *   },
 * });
 *
 * // Receipt-backed attestation (medium trust)
 * const action = withToolAttestation(act, {
 *   level: "receipt-backed",
 *   receipt: { requestId: "req_123", responseHash: "sha256:..." },
 * });
 *
 * // Self-declared (no external evidence)
 * const action = withToolAttestation(act, { level: "self-declared" });
 * ```
 */
export const ToolAttestationExtension = z.object({
  /** Attestation trust level */
  level: ToolAttestationLevel,

  /** Provider's cryptographic signature (for provider-signed level) */
  providerSignature: ProviderSignature.optional(),

  /** API receipt evidence (for receipt-backed level) */
  receipt: ToolReceipt.optional(),

  /** Hash of the tool's output for comparison with the resource */
  outputHash: z.string().optional(),
});

export type ToolAttestationExtension = z.infer<typeof ToolAttestationExtension>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add tool attestation extension to an action.
 *
 * @param obj - The action to extend
 * @param attestation - Tool attestation data
 * @returns Action with tool attestation extension
 */
export function withToolAttestation<T extends Extensible>(
  obj: T,
  attestation: z.input<typeof ToolAttestationExtension>
): T {
  const validated = ToolAttestationExtension.parse(attestation);
  return {
    ...obj,
    extensions: {
      ...obj.extensions,
      [TOOL_ATTESTATION_NAMESPACE]: validated,
    },
  };
}

/**
 * Get tool attestation extension from an action.
 *
 * @param obj - The action to read from
 * @returns Tool attestation data or undefined if not present
 */
export function getToolAttestation(
  obj: Extensible
): ToolAttestationExtension | undefined {
  const data = obj.extensions?.[TOOL_ATTESTATION_NAMESPACE];
  if (!data) return undefined;
  return ToolAttestationExtension.parse(data);
}

/**
 * Check if an action has a tool attestation extension.
 *
 * @param obj - The action to check
 * @returns True if tool attestation extension exists
 */
export function hasToolAttestation(obj: Extensible): boolean {
  return obj.extensions?.[TOOL_ATTESTATION_NAMESPACE] !== undefined;
}

/**
 * Get the attestation level for tool usage on an action.
 * Returns "self-declared" if no attestation is present (default assumption).
 *
 * @param obj - The action to check
 * @returns The attestation trust level
 */
export function getAttestationLevel(obj: Extensible): ToolAttestationLevel {
  const attestation = getToolAttestation(obj);
  return attestation?.level ?? "self-declared";
}
