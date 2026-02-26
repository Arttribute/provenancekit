import { z } from "zod";

/**
 * Namespace for server witness extension.
 * @example "ext:witness@1.0.0"
 */
export const WITNESS_NAMESPACE = "ext:witness@1.0.0" as const;

/**
 * Environment attestation report.
 *
 * Evidence that the server witness was produced inside a verifiable,
 * attested execution environment. The raw `report` is the base64-encoded
 * attestation document from the environment — verifiers use the appropriate
 * SDK for the given `type` to independently check it.
 *
 * Well-known type values: "intel-sgx", "aws-nitro", "marlin-oyster",
 * "amd-sev-snp", "tpm". Open string — custom environments are permitted.
 */
export const EnvironmentAttestation = z.object({
  /**
   * The attesting environment type.
   * Well-known: "intel-sgx" | "aws-nitro" | "marlin-oyster" | "amd-sev-snp" | "tpm"
   */
  type: z.string(),

  /** Base64-encoded raw attestation document produced by the environment */
  report: z.string(),

  /**
   * Environment-specific measurement values extracted from the report.
   * SGX: { mrenclave, mrsigner }
   * Nitro: { pcr0, pcr1, pcr2 }
   * TPM: { pcr0, pcr7, ... }
   */
  measurements: z.record(z.string()).optional(),

  /** Freshness nonce that was included when requesting the attestation */
  nonce: z.string().optional(),
});

export type EnvironmentAttestation = z.infer<typeof EnvironmentAttestation>;

/**
 * Server witness extension schema.
 *
 * A cryptographic attestation by the server that a specific action
 * by a specific entity produced a specific output CID. This binds
 * the entity's signed intent (action proof) to the actual output.
 *
 * Verification chain:
 * 1. Entity signs intent → ext:proof@1.0.0 (entityId, actionType, inputs, timestamp)
 * 2. Server uploads file → computes CID
 * 3. Server signs witness → ext:witness@1.0.0 (actionId, entityId, outputCid, actionProofHash)
 *
 * Anyone can verify: entity authorized the action (proof) AND server witnessed
 * the output (witness), linked via actionProofHash.
 *
 * @example
 * ```typescript
 * const action = withWitness(act, {
 *   actionId: "uuid",
 *   entityId: "user:alice",
 *   outputCid: "bafy...",
 *   actionProofHash: "sha256:...",
 *   serverSignature: "cd34...",
 *   serverPublicKey: "ef56...",
 *   timestamp: "2025-01-15T10:00:00Z",
 * });
 * ```
 */
export const WitnessExtension = z.object({
  /** Action ID that produced this output */
  actionId: z.string(),

  /** The entity that performed the action */
  entityId: z.string(),

  /** The output CID computed by the server */
  outputCid: z.string(),

  /** SHA-256 hash of the entity's action proof, linking witness to intent */
  actionProofHash: z.string(),

  /** Server's Ed25519 signature over the witness payload */
  serverSignature: z.string(),

  /** Server's public key (hex-encoded) */
  serverPublicKey: z.string(),

  /** When the witness attestation was created (ISO 8601) */
  timestamp: z.string().datetime(),

  /**
   * Environment attestation report.
   * Present when the server ran inside a verifiable attested environment
   * (TEE, TPM, HSM, etc.). Upgrades the software witness to an environment-
   * attested witness — verifiers can independently check the report to confirm
   * the witness was produced by the expected, unmodified server code.
   */
  attestation: EnvironmentAttestation.optional(),
});

export type WitnessExtension = z.infer<typeof WitnessExtension>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add server witness extension to an action.
 *
 * @param obj - The action to extend
 * @param witness - Server witness data
 * @returns Action with witness extension
 */
export function withWitness<T extends Extensible>(
  obj: T,
  witness: z.input<typeof WitnessExtension>
): T {
  const validated = WitnessExtension.parse(witness);
  return {
    ...obj,
    extensions: { ...obj.extensions, [WITNESS_NAMESPACE]: validated },
  };
}

/**
 * Get server witness extension from an action.
 *
 * @param obj - The action to read from
 * @returns Witness data or undefined if not present
 */
export function getWitness(obj: Extensible): WitnessExtension | undefined {
  const data = obj.extensions?.[WITNESS_NAMESPACE];
  if (!data) return undefined;
  return WitnessExtension.parse(data);
}

/**
 * Check if an action has a server witness extension.
 *
 * @param obj - The action to check
 * @returns True if witness extension exists
 */
export function hasWitness(obj: Extensible): boolean {
  return obj.extensions?.[WITNESS_NAMESPACE] !== undefined;
}
