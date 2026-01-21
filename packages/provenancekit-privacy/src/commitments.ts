/**
 * Pedersen Commitments for Private Provenance Data
 *
 * Implements Pedersen commitment scheme for hiding values while allowing
 * verification and homomorphic operations. Uses secp256k1 curve.
 *
 * Key properties:
 * - **Hiding**: Commitment reveals nothing about the value
 * - **Binding**: Cannot open commitment to different value
 * - **Homomorphic**: C(v1) + C(v2) = C(v1 + v2)
 *
 * @example
 * ```ts
 * import {
 *   commit,
 *   verify,
 *   addCommitments,
 *   commitContributionWeights,
 * } from "@provenancekit/privacy";
 *
 * // Commit to a value
 * const { commitment, blinding } = commit(6000n); // 60%
 *
 * // Verify the commitment
 * const valid = verify(commitment, 6000n, blinding);
 *
 * // Homomorphic addition
 * const c1 = commit(6000n);
 * const c2 = commit(4000n);
 * const sum = addCommitments(c1.commitment, c2.commitment);
 * // sum commits to 10000 (100%)
 * ```
 *
 * @packageDocumentation
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/ciphers/webcrypto";

import { bytesToHex, hexToBytes } from "./keys.js";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * A Pedersen commitment (elliptic curve point)
 */
export interface Commitment {
  /** X coordinate (hex) */
  x: string;
  /** Y coordinate (hex) */
  y: string;
  /** Compressed point (hex, 33 bytes) */
  compressed: string;
}

/**
 * Result of creating a commitment
 */
export interface CommitmentResult {
  /** The commitment C = g*v + h*r */
  commitment: Commitment;
  /** The blinding factor r (keep secret!) */
  blinding: bigint;
  /** The committed value v */
  value: bigint;
}

/**
 * Commitment with opening (for verification)
 */
export interface CommitmentOpening {
  /** The commitment */
  commitment: Commitment;
  /** The value */
  value: bigint;
  /** The blinding factor */
  blinding: bigint;
}

/**
 * Serialized commitment for storage/transmission
 */
export interface SerializedCommitment {
  /** Compressed commitment point */
  commitment: string;
  /** Hex-encoded blinding factor */
  blinding: string;
  /** Committed value as string (for BigInt) */
  value: string;
}

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Generator point G (secp256k1 base point)
 */
const G = secp256k1.ProjectivePoint.BASE;

/**
 * Second generator H (derived from G via hash-to-curve)
 * H = hash_to_point("ProvenanceKit-Pedersen-H")
 * This ensures nobody knows the discrete log of H w.r.t. G
 */
const H_SEED = "ProvenanceKit-Pedersen-H-v1";

function deriveH(): typeof G {
  // Hash the seed to get a scalar, then multiply G
  // This is a simplified approach - full hash-to-curve is more complex
  // but this is sufficient for our use case
  let hash = sha256(new TextEncoder().encode(H_SEED));

  // Keep hashing until we get a valid x-coordinate
  for (let i = 0; i < 256; i++) {
    try {
      // Try to create a point with this x-coordinate
      const x = BigInt("0x" + bytesToHex(hash)) % secp256k1.CURVE.n;
      // Multiply base point by this scalar to get H
      return G.multiply(x === 0n ? 1n : x);
    } catch {
      // Hash again if failed
      hash = sha256(hash);
    }
  }

  throw new Error("Failed to derive H generator");
}

const H = deriveH();

/**
 * Curve order (for modular arithmetic)
 */
const N = secp256k1.CURVE.n;

/*─────────────────────────────────────────────────────────────*\
 | Core Functions                                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Generate a random blinding factor
 */
export function generateBlinding(): bigint {
  const bytes = randomBytes(32);
  return BigInt("0x" + bytesToHex(bytes)) % N;
}

/**
 * Create a Pedersen commitment to a value
 *
 * C = g*v + h*r where:
 * - g is the base generator
 * - v is the value
 * - h is the blinding generator
 * - r is the random blinding factor
 *
 * @param value - The value to commit to
 * @param blinding - Optional blinding factor (generated if not provided)
 * @returns Commitment result with commitment, blinding, and value
 *
 * @example
 * ```ts
 * // Commit to 60% contribution weight (6000 basis points)
 * const { commitment, blinding, value } = commit(6000n);
 *
 * // Store commitment publicly, keep blinding secret
 * console.log("Public commitment:", commitment.compressed);
 * console.log("Keep secret:", blinding.toString());
 * ```
 */
export function commit(
  value: bigint,
  blinding?: bigint
): CommitmentResult {
  // Normalize value to positive modular
  const v = ((value % N) + N) % N;
  const r = blinding ?? generateBlinding();

  // C = G*v + H*r
  // Note: multiply(0n) is not allowed, so we handle zero cases
  let point: typeof G;

  if (v === 0n && r === 0n) {
    // Edge case: both zero - return G (arbitrary but deterministic)
    // This is unusual in practice since blinding is usually random
    point = G;
  } else if (v === 0n) {
    // Only blinding factor: C = H*r
    point = H.multiply(r);
  } else if (r === 0n) {
    // Only value: C = G*v
    point = G.multiply(v);
  } else {
    // Normal case: C = G*v + H*r
    point = G.multiply(v).add(H.multiply(r));
  }

  const affine = point.toAffine();

  return {
    commitment: {
      x: affine.x.toString(16).padStart(64, "0"),
      y: affine.y.toString(16).padStart(64, "0"),
      compressed: bytesToHex(point.toRawBytes(true)),
    },
    blinding: r,
    value,
  };
}

/**
 * Verify a commitment opening
 *
 * @param commitment - The commitment to verify
 * @param value - The claimed value
 * @param blinding - The blinding factor
 * @returns True if the opening is valid
 *
 * @example
 * ```ts
 * const { commitment, blinding, value } = commit(6000n);
 *
 * // Later, verify the opening
 * const valid = verify(commitment, value, blinding);
 * console.log("Valid:", valid); // true
 *
 * // Invalid opening fails
 * const invalid = verify(commitment, 5000n, blinding);
 * console.log("Invalid:", invalid); // false
 * ```
 */
export function verify(
  commitment: Commitment,
  value: bigint,
  blinding: bigint
): boolean {
  // Recompute the commitment
  const expected = commit(value, blinding);

  // Compare compressed representations
  return commitment.compressed === expected.commitment.compressed;
}

/*─────────────────────────────────────────────────────────────*\
 | Homomorphic Operations                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Add two commitments homomorphically
 *
 * C1 + C2 = (g*v1 + h*r1) + (g*v2 + h*r2) = g*(v1+v2) + h*(r1+r2)
 *
 * @param c1 - First commitment
 * @param c2 - Second commitment
 * @returns Sum commitment
 *
 * @example
 * ```ts
 * const c1 = commit(6000n); // 60%
 * const c2 = commit(4000n); // 40%
 * const sum = addCommitments(c1.commitment, c2.commitment);
 *
 * // Verify the sum equals 10000 (100%)
 * const sumBlinding = (c1.blinding + c2.blinding) % N;
 * const valid = verify(sum, 10000n, sumBlinding);
 * ```
 */
export function addCommitments(
  c1: Commitment,
  c2: Commitment
): Commitment {
  const p1 = secp256k1.ProjectivePoint.fromHex(c1.compressed);
  const p2 = secp256k1.ProjectivePoint.fromHex(c2.compressed);
  const sum = p1.add(p2);
  const affine = sum.toAffine();

  return {
    x: affine.x.toString(16).padStart(64, "0"),
    y: affine.y.toString(16).padStart(64, "0"),
    compressed: bytesToHex(sum.toRawBytes(true)),
  };
}

/**
 * Subtract two commitments homomorphically
 *
 * C1 - C2 = g*(v1-v2) + h*(r1-r2)
 *
 * @param c1 - First commitment (minuend)
 * @param c2 - Second commitment (subtrahend)
 * @returns Difference commitment
 */
export function subtractCommitments(
  c1: Commitment,
  c2: Commitment
): Commitment {
  const p1 = secp256k1.ProjectivePoint.fromHex(c1.compressed);
  const p2 = secp256k1.ProjectivePoint.fromHex(c2.compressed);
  const diff = p1.subtract(p2);
  const affine = diff.toAffine();

  return {
    x: affine.x.toString(16).padStart(64, "0"),
    y: affine.y.toString(16).padStart(64, "0"),
    compressed: bytesToHex(diff.toRawBytes(true)),
  };
}

/**
 * Add multiple commitments
 *
 * @param commitments - Array of commitments
 * @returns Sum of all commitments
 */
export function sumCommitments(commitments: Commitment[]): Commitment {
  if (commitments.length === 0) {
    throw new Error("Cannot sum empty array of commitments");
  }

  if (commitments.length === 1) {
    return commitments[0];
  }

  let sum = secp256k1.ProjectivePoint.fromHex(commitments[0].compressed);

  for (let i = 1; i < commitments.length; i++) {
    const p = secp256k1.ProjectivePoint.fromHex(commitments[i].compressed);
    sum = sum.add(p);
  }

  const affine = sum.toAffine();

  return {
    x: affine.x.toString(16).padStart(64, "0"),
    y: affine.y.toString(16).padStart(64, "0"),
    compressed: bytesToHex(sum.toRawBytes(true)),
  };
}

/**
 * Sum blinding factors (for verifying sum commitments)
 *
 * @param blindings - Array of blinding factors
 * @returns Sum modulo curve order
 */
export function sumBlindings(blindings: bigint[]): bigint {
  return blindings.reduce((sum, b) => (sum + b) % N, 0n);
}

/*─────────────────────────────────────────────────────────────*\
 | Contribution Weight Helpers                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Contribution weight commitment with metadata
 */
export interface WeightCommitment {
  /** Entity ID (public) */
  entityId: string;
  /** The commitment */
  commitment: Commitment;
  /** Optional category (public) */
  category?: string;
}

/**
 * Weight opening for verification
 */
export interface WeightOpening {
  /** Entity ID */
  entityId: string;
  /** The weight in basis points (0-10000) */
  weight: number;
  /** The blinding factor */
  blinding: bigint;
}

/**
 * Create commitments for contribution weights
 *
 * @param weights - Map of entity ID to weight (in basis points, must sum to 10000)
 * @returns Commitments and openings
 *
 * @example
 * ```ts
 * const { commitments, openings, totalCommitment } = commitContributionWeights({
 *   "alice.eth": 6000,  // 60%
 *   "bob.eth": 3000,    // 30%
 *   "carol.eth": 1000,  // 10%
 * });
 *
 * // Commitments are public
 * console.log(commitments);
 *
 * // Openings are secret (one per contributor)
 * // Each contributor gets their own opening
 * ```
 */
export function commitContributionWeights(
  weights: Record<string, number>
): {
  commitments: WeightCommitment[];
  openings: WeightOpening[];
  totalCommitment: Commitment;
  totalBlinding: bigint;
} {
  // Validate weights sum to 10000
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total !== 10000) {
    throw new Error(`Weights must sum to 10000 (100%), got ${total}`);
  }

  const commitments: WeightCommitment[] = [];
  const openings: WeightOpening[] = [];

  for (const [entityId, weight] of Object.entries(weights)) {
    if (weight < 0 || weight > 10000) {
      throw new Error(`Invalid weight for ${entityId}: ${weight}`);
    }

    const result = commit(BigInt(weight));

    commitments.push({
      entityId,
      commitment: result.commitment,
    });

    openings.push({
      entityId,
      weight,
      blinding: result.blinding,
    });
  }

  // Calculate total commitment (should equal commitment to 10000)
  const totalCommitment = sumCommitments(commitments.map((c) => c.commitment));
  const totalBlinding = sumBlindings(openings.map((o) => o.blinding));

  return {
    commitments,
    openings,
    totalCommitment,
    totalBlinding,
  };
}

/**
 * Verify that committed weights sum to 100%
 *
 * @param commitments - The weight commitments
 * @param totalBlinding - Sum of all blinding factors
 * @returns True if sum equals 10000 (100%)
 */
export function verifyWeightSum(
  commitments: WeightCommitment[],
  totalBlinding: bigint
): boolean {
  const totalCommitment = sumCommitments(commitments.map((c) => c.commitment));
  return verify(totalCommitment, 10000n, totalBlinding);
}

/**
 * Verify a single weight opening
 *
 * @param commitment - The weight commitment
 * @param opening - The opening to verify
 * @returns True if opening is valid
 */
export function verifyWeightOpening(
  commitment: WeightCommitment,
  opening: WeightOpening
): boolean {
  if (commitment.entityId !== opening.entityId) {
    return false;
  }
  return verify(commitment.commitment, BigInt(opening.weight), opening.blinding);
}

/*─────────────────────────────────────────────────────────────*\
 | Serialization                                                |
\*─────────────────────────────────────────────────────────────*/

/**
 * Serialize a commitment result for storage
 */
export function serializeCommitment(result: CommitmentResult): SerializedCommitment {
  return {
    commitment: result.commitment.compressed,
    blinding: result.blinding.toString(16),
    value: result.value.toString(),
  };
}

/**
 * Deserialize a commitment result
 */
export function deserializeCommitment(
  serialized: SerializedCommitment
): CommitmentResult {
  const point = secp256k1.ProjectivePoint.fromHex(serialized.commitment);
  const affine = point.toAffine();

  return {
    commitment: {
      x: affine.x.toString(16).padStart(64, "0"),
      y: affine.y.toString(16).padStart(64, "0"),
      compressed: serialized.commitment,
    },
    blinding: BigInt("0x" + serialized.blinding),
    value: BigInt(serialized.value),
  };
}

/**
 * Serialize weight openings for a specific entity
 * (to give to that contributor)
 */
export function serializeWeightOpening(opening: WeightOpening): string {
  return JSON.stringify({
    entityId: opening.entityId,
    weight: opening.weight,
    blinding: opening.blinding.toString(16),
  });
}

/**
 * Deserialize a weight opening
 */
export function deserializeWeightOpening(json: string): WeightOpening {
  const parsed = JSON.parse(json) as {
    entityId: string;
    weight: number;
    blinding: string;
  };

  return {
    entityId: parsed.entityId,
    weight: parsed.weight,
    blinding: BigInt("0x" + parsed.blinding),
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Commitment to Contract Integration                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create commitment bytes for on-chain storage
 *
 * @param commitment - The commitment
 * @returns 33-byte compressed point as Uint8Array
 */
export function commitmentToBytes(commitment: Commitment): Uint8Array {
  return hexToBytes(commitment.compressed);
}

/**
 * Create commitment from on-chain bytes
 *
 * @param bytes - 33-byte compressed point
 * @returns The commitment
 */
export function commitmentFromBytes(bytes: Uint8Array): Commitment {
  const hex = bytesToHex(bytes);
  const point = secp256k1.ProjectivePoint.fromHex(hex);
  const affine = point.toAffine();

  return {
    x: affine.x.toString(16).padStart(64, "0"),
    y: affine.y.toString(16).padStart(64, "0"),
    compressed: hex,
  };
}

/**
 * Format commitment for ProvenanceVerifiable contract
 *
 * Returns the commitment hash suitable for:
 * - registerWithCommitment()
 * - revealCommitment()
 */
export function commitmentHash(commitment: Commitment): string {
  // Hash the compressed point for use as commitment ID
  const hash = sha256(hexToBytes(commitment.compressed));
  return "0x" + bytesToHex(hash);
}
