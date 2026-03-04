/**
 * Distribution Calculator for ProvenanceKit
 *
 * Calculates payment distributions based on attribution contribution weights.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  IMPORTANT DISCLAIMERS - PLEASE READ CAREFULLY  ⚠️
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. NOT FINANCIAL OR LEGAL ADVICE
 *    This module provides mathematical calculations only. It does not constitute
 *    financial, legal, or tax advice. Users should consult qualified professionals
 *    before relying on these calculations for actual payment distributions.
 *
 * 2. ROUNDING IS MATHEMATICALLY UNAVOIDABLE
 *    When distributing discrete units (tokens, cents, wei) according to percentages,
 *    rounding is unavoidable. This implementation uses the Largest Remainder Method
 *    (Hamilton's method) which is mathematically fair but still involves rounding.
 *
 * 3. VERIFY INDEPENDENTLY
 *    For high-value distributions, users SHOULD verify calculations independently
 *    and/or use multiple implementations to cross-check results.
 *
 * 4. DUST AND REMAINDERS
 *    When splitting amounts, small remainders ("dust") may occur. The splitAmount
 *    function returns dust separately so callers can handle it appropriately
 *    (e.g., send to treasury, distribute to largest recipient, etc.).
 *
 * 5. INPUT VALIDATION
 *    This module validates inputs and throws errors for invalid data. However,
 *    the correctness of the output depends on the correctness of the input
 *    attribution weights. Garbage in = garbage out.
 *
 * 6. NO WARRANTY
 *    This software is provided "as is" without warranty of any kind. The authors
 *    are not liable for any damages arising from its use.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ALGORITHM: Largest Remainder Method (Hamilton's Method)
 *
 * This method is used for proportional allocation in electoral systems worldwide
 * and is considered mathematically fair for distributing integer quantities
 * according to fractional entitlements.
 *
 * Steps:
 * 1. Calculate each party's exact (fractional) share
 * 2. Give each party their floor (integer part)
 * 3. Calculate remainder for each party
 * 4. Distribute remaining units to parties with largest remainders
 *
 * Properties:
 * - Quota rule: Each party gets floor(quota) or ceil(quota), never more/less
 * - Minimizes total rounding error
 * - No systematic bias toward any position in the list
 *
 * @module distribution
 * @packageDocumentation
 */

import type { Attribution, ContentReference } from "@provenancekit/eaa-types";
import { getContribBps, getContrib } from "./contrib";
import { getPayment, type PaymentExtension } from "./payment";

/*─────────────────────────────────────────────────────────────────────────────*\
 | Constants                                                                     |
\*─────────────────────────────────────────────────────────────────────────────*/

/**
 * Standard total for basis points (100% = 10000 bps).
 * 1 basis point = 0.01%
 */
export const BPS_TOTAL = 10000;

/**
 * Maximum safe integer for basis points calculations.
 * Weights above this may cause precision issues.
 */
export const MAX_SAFE_WEIGHT = Number.MAX_SAFE_INTEGER;

/*─────────────────────────────────────────────────────────────────────────────*\
 | Types                                                                         |
\*─────────────────────────────────────────────────────────────────────────────*/

/**
 * A single entry in a payment distribution.
 */
export interface DistributionEntry {
  /** Entity receiving the payment */
  entityId: string;

  /**
   * Share in basis points (6000 = 60%).
   * Always an integer between 0 and 10000.
   */
  bps: number;

  /** Payment configuration (if available from attribution) */
  payment?: PaymentExtension;
}

/**
 * Complete distribution for a resource.
 */
export interface Distribution {
  /** The resource this distribution applies to */
  resourceRef: ContentReference;

  /**
   * Distribution entries (one per unique contributor).
   * Entries are sorted by bps descending for consistency.
   */
  entries: DistributionEntry[];

  /**
   * Total basis points.
   * Will be exactly 10000 for valid distributions, or 0 for empty ones.
   */
  totalBps: number;

  /**
   * Metadata about the distribution calculation.
   */
  metadata: DistributionMetadata;
}

/**
 * Metadata about how the distribution was calculated.
 * Useful for auditing and debugging.
 */
export interface DistributionMetadata {
  /** Number of attributions processed */
  attributionsProcessed: number;

  /** Number of attributions filtered out (wrong resource, zero weight, etc.) */
  attributionsFiltered: number;

  /** Whether normalization was applied */
  normalized: boolean;

  /** Original total before normalization (if normalized) */
  originalTotal?: number;

  /** Rounding adjustments applied (entity -> adjustment in bps) */
  roundingAdjustments: Map<string, number>;

  /** Timestamp of calculation */
  calculatedAt: string;

  /** Algorithm version for future compatibility */
  algorithmVersion: string;
}

/**
 * Result of splitting an amount according to a distribution.
 */
export interface SplitResult {
  /** Map of entityId to their share */
  shares: Map<string, bigint>;

  /**
   * Dust (remainder) that couldn't be distributed due to integer division.
   * Callers should handle this appropriately (e.g., treasury, largest recipient).
   */
  dust: bigint;

  /** Total amount that was distributed (shares sum) */
  distributed: bigint;

  /** Original amount requested */
  originalAmount: bigint;
}

/**
 * Error thrown when distribution validation fails.
 */
export class DistributionError extends Error {
  constructor(
    message: string,
    public readonly code: DistributionErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DistributionError";
  }
}

export type DistributionErrorCode =
  | "INVALID_WEIGHT"
  | "INVALID_DISTRIBUTION"
  | "INVALID_AMOUNT"
  | "EMPTY_DISTRIBUTION"
  | "DUPLICATE_ENTITY"
  | "OVERFLOW";

/*─────────────────────────────────────────────────────────────────────────────*\
 | Internal Helpers                                                              |
\*─────────────────────────────────────────────────────────────────────────────*/

/**
 * Validate that a weight is a valid non-negative finite number.
 */
function validateWeight(weight: number, entityId: string): void {
  if (!Number.isFinite(weight)) {
    throw new DistributionError(
      `Invalid weight for entity "${entityId}": ${weight} (must be a finite number)`,
      "INVALID_WEIGHT",
      { entityId, weight }
    );
  }
  if (weight < 0) {
    throw new DistributionError(
      `Negative weight for entity "${entityId}": ${weight} (weights must be >= 0)`,
      "INVALID_WEIGHT",
      { entityId, weight }
    );
  }
  if (weight > MAX_SAFE_WEIGHT) {
    throw new DistributionError(
      `Weight too large for entity "${entityId}": ${weight} (max: ${MAX_SAFE_WEIGHT})`,
      "OVERFLOW",
      { entityId, weight, max: MAX_SAFE_WEIGHT }
    );
  }
}

/**
 * Apply Largest Remainder Method (Hamilton's method) to distribute
 * a total among entries proportionally.
 *
 * This is the mathematically fair way to round fractional allocations
 * to integers while ensuring they sum to exactly the target total.
 *
 * @param entries - Array of {entityId, rawWeight} to distribute among
 * @param targetTotal - The exact total that results must sum to (e.g., 10000)
 * @returns Array of {entityId, bps, adjustment} with integer allocations
 */
function applyLargestRemainderMethod(
  entries: Array<{ entityId: string; rawWeight: number; payment?: PaymentExtension }>,
  targetTotal: number
): Array<{ entityId: string; bps: number; payment?: PaymentExtension; adjustment: number }> {
  const totalWeight = entries.reduce((sum, e) => sum + e.rawWeight, 0);

  if (totalWeight === 0) {
    return entries.map((e) => ({ ...e, bps: 0, adjustment: 0 }));
  }

  // Step 1: Calculate exact quotas and floor values
  const withQuotas = entries.map((entry) => {
    const exactQuota = (entry.rawWeight / totalWeight) * targetTotal;
    const floorValue = Math.floor(exactQuota);
    const remainder = exactQuota - floorValue;

    return {
      entityId: entry.entityId,
      payment: entry.payment,
      exactQuota,
      floorValue,
      remainder,
      bps: floorValue, // Start with floor
      adjustment: 0,
    };
  });

  // Step 2: Calculate how many extra units we need to distribute
  const floorSum = withQuotas.reduce((sum, e) => sum + e.floorValue, 0);
  let remaining = targetTotal - floorSum;

  // Step 3: Sort by remainder descending to determine who gets extra units
  // Use entityId as tiebreaker for deterministic results
  const sortedByRemainder = [...withQuotas].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    // Tiebreaker: alphabetical by entityId for determinism
    return a.entityId.localeCompare(b.entityId);
  });

  // Step 4: Give one extra unit to entries with largest remainders
  for (const entry of sortedByRemainder) {
    if (remaining <= 0) break;

    // Find this entry in the original array and increment
    const original = withQuotas.find((e) => e.entityId === entry.entityId)!;
    original.bps += 1;
    original.adjustment = 1;
    remaining -= 1;
  }

  // Return in original order, mapped to final structure
  return withQuotas.map(({ entityId, bps, payment, adjustment }) => ({
    entityId,
    bps,
    payment,
    adjustment,
  }));
}

/**
 * Create distribution metadata.
 */
function createMetadata(
  attributionsProcessed: number,
  attributionsFiltered: number,
  normalized: boolean,
  originalTotal: number | undefined,
  roundingAdjustments: Map<string, number>
): DistributionMetadata {
  return {
    attributionsProcessed,
    attributionsFiltered,
    normalized,
    originalTotal,
    roundingAdjustments,
    calculatedAt: new Date().toISOString(),
    algorithmVersion: "largest-remainder-v1",
  };
}

/*─────────────────────────────────────────────────────────────────────────────*\
 | Main Distribution Functions                                                   |
\*─────────────────────────────────────────────────────────────────────────────*/

/**
 * Calculate payment distribution from attributions.
 *
 * Takes a list of attributions for a resource and calculates how
 * payments should be split based on contribution weights.
 *
 * ⚠️ IMPORTANT: See module-level disclaimers about rounding and limitations.
 *
 * @param resourceRef - The resource to calculate distribution for
 * @param attributions - All attributions (will be filtered to relevant ones)
 * @returns Distribution with normalized entries summing to exactly 10000 bps
 *
 * @throws {DistributionError} If any weight is invalid (negative, NaN, Infinity)
 *
 * @example
 * ```typescript
 * const attributions = [
 *   withContrib(attr1, { weight: 6000 }), // Alice: 60%
 *   withContrib(attr2, { weight: 3000 }), // Bob: 30%
 *   withContrib(attr3, { weight: 1000 }), // Carol: 10%
 * ];
 *
 * const distribution = calculateDistribution(cidRef("bafy..."), attributions);
 * // distribution.entries = [
 * //   { entityId: "alice", bps: 6000 },
 * //   { entityId: "bob", bps: 3000 },
 * //   { entityId: "carol", bps: 1000 },
 * // ]
 * // distribution.totalBps = 10000
 * ```
 */
export function calculateDistribution(
  resourceRef: ContentReference,
  attributions: Attribution[]
): Distribution {
  const totalAttributions = attributions.length;

  // Filter to attributions for this resource
  const relevant = attributions.filter(
    (a) => a.resourceRef?.ref === resourceRef.ref
  );

  const filteredCount = totalAttributions - relevant.length;

  if (relevant.length === 0) {
    return {
      resourceRef,
      entries: [],
      totalBps: 0,
      metadata: createMetadata(totalAttributions, filteredCount, false, undefined, new Map()),
    };
  }

  // Aggregate by entityId (handle duplicates by summing weights)
  const aggregated = new Map<
    string,
    { rawWeight: number; payment?: PaymentExtension }
  >();

  for (const attr of relevant) {
    const entityId = attr.entityId as string;
    const weight = getContribBps(attr);

    // Validate each weight
    validateWeight(weight, entityId);

    const existing = aggregated.get(entityId);
    if (existing) {
      existing.rawWeight += weight;
      // Keep first payment config encountered
    } else {
      aggregated.set(entityId, {
        rawWeight: weight,
        payment: getPayment(attr),
      });
    }
  }

  // Convert to array for processing
  const entries = Array.from(aggregated.entries()).map(([entityId, data]) => ({
    entityId,
    rawWeight: data.rawWeight,
    payment: data.payment,
  }));

  // Calculate total weight
  const totalWeight = entries.reduce((sum, e) => sum + e.rawWeight, 0);

  // If all weights are zero, return empty distribution
  if (totalWeight === 0) {
    return {
      resourceRef,
      entries: [],
      totalBps: 0,
      metadata: createMetadata(
        totalAttributions,
        filteredCount + relevant.length,
        false,
        undefined,
        new Map()
      ),
    };
  }

  // Apply Largest Remainder Method for fair rounding
  const distributed = applyLargestRemainderMethod(entries, BPS_TOTAL);

  // Track rounding adjustments for transparency
  const roundingAdjustments = new Map<string, number>();
  for (const entry of distributed) {
    if (entry.adjustment !== 0) {
      roundingAdjustments.set(entry.entityId, entry.adjustment);
    }
  }

  // Sort by bps descending for consistent output
  const sortedEntries = distributed
    .map(({ entityId, bps, payment }) => ({ entityId, bps, payment }))
    .filter((e) => e.bps > 0) // Remove zero allocations
    .sort((a, b) => {
      if (b.bps !== a.bps) return b.bps - a.bps;
      return a.entityId.localeCompare(b.entityId);
    });

  return {
    resourceRef,
    entries: sortedEntries,
    totalBps: sortedEntries.reduce((sum, e) => sum + e.bps, 0),
    metadata: createMetadata(
      totalAttributions,
      filteredCount,
      totalWeight !== BPS_TOTAL,
      totalWeight !== BPS_TOTAL ? totalWeight : undefined,
      roundingAdjustments
    ),
  };
}

/**
 * Calculate distribution for action-level attributions.
 *
 * Use this when attributions are tied to actions rather than resources.
 *
 * ⚠️ IMPORTANT: See module-level disclaimers about rounding and limitations.
 *
 * @param actionId - The action to calculate distribution for
 * @param attributions - All attributions (will be filtered to relevant ones)
 * @returns Distribution entries with normalized weights
 *
 * @throws {DistributionError} If any weight is invalid
 */
export function calculateActionDistribution(
  actionId: string,
  attributions: Attribution[]
): Omit<Distribution, "resourceRef"> & { actionId: string } {
  const totalAttributions = attributions.length;

  // Filter to attributions for this action
  const relevant = attributions.filter((a) => a.actionId === actionId);
  const filteredCount = totalAttributions - relevant.length;

  if (relevant.length === 0) {
    return {
      actionId,
      entries: [],
      totalBps: 0,
      metadata: createMetadata(totalAttributions, filteredCount, false, undefined, new Map()),
    };
  }

  // Aggregate by entityId (handle duplicates by summing weights)
  const aggregated = new Map<
    string,
    { rawWeight: number; payment?: PaymentExtension }
  >();

  for (const attr of relevant) {
    const entityId = attr.entityId as string;
    const weight = getContribBps(attr);

    validateWeight(weight, entityId);

    const existing = aggregated.get(entityId);
    if (existing) {
      existing.rawWeight += weight;
    } else {
      aggregated.set(entityId, {
        rawWeight: weight,
        payment: getPayment(attr),
      });
    }
  }

  const entries = Array.from(aggregated.entries()).map(([entityId, data]) => ({
    entityId,
    rawWeight: data.rawWeight,
    payment: data.payment,
  }));

  const totalWeight = entries.reduce((sum, e) => sum + e.rawWeight, 0);

  if (totalWeight === 0) {
    return {
      actionId,
      entries: [],
      totalBps: 0,
      metadata: createMetadata(
        totalAttributions,
        filteredCount + relevant.length,
        false,
        undefined,
        new Map()
      ),
    };
  }

  const distributed = applyLargestRemainderMethod(entries, BPS_TOTAL);

  const roundingAdjustments = new Map<string, number>();
  for (const entry of distributed) {
    if (entry.adjustment !== 0) {
      roundingAdjustments.set(entry.entityId, entry.adjustment);
    }
  }

  const sortedEntries = distributed
    .map(({ entityId, bps, payment }) => ({ entityId, bps, payment }))
    .filter((e) => e.bps > 0)
    .sort((a, b) => {
      if (b.bps !== a.bps) return b.bps - a.bps;
      return a.entityId.localeCompare(b.entityId);
    });

  return {
    actionId,
    entries: sortedEntries,
    totalBps: sortedEntries.reduce((sum, e) => sum + e.bps, 0),
    metadata: createMetadata(
      totalAttributions,
      filteredCount,
      totalWeight !== BPS_TOTAL,
      totalWeight !== BPS_TOTAL ? totalWeight : undefined,
      roundingAdjustments
    ),
  };
}

/**
 * Normalize contribution weights so they sum to 10000 basis points.
 *
 * Uses Largest Remainder Method for fair rounding.
 *
 * @param attributions - Attributions to normalize
 * @returns New attributions with normalized contribution weights
 *
 * @throws {DistributionError} If any weight is invalid
 *
 * @example
 * ```typescript
 * const attrs = [
 *   withContrib(a1, { weight: 3 }),  // Arbitrary weight
 *   withContrib(a2, { weight: 1 }),
 * ];
 *
 * const normalized = normalizeContributions(attrs);
 * // a1 now has weight 7500 (75%)
 * // a2 now has weight 2500 (25%)
 * ```
 */
export function normalizeContributions(
  attributions: Attribution[]
): Attribution[] {
  if (attributions.length === 0) return [];

  // Get current weights
  const entries = attributions.map((attr, index) => {
    const weight = getContribBps(attr);
    const entityId = attr.entityId || `index-${index}`;
    validateWeight(weight, entityId);
    return { attr, weight, entityId };
  });

  const total = entries.reduce((sum, e) => sum + e.weight, 0);

  // If already normalized or zero, return as-is
  if (total === 0 || total === BPS_TOTAL) {
    return attributions;
  }

  // Apply Largest Remainder Method
  const distributed = applyLargestRemainderMethod(
    entries.map((e) => ({ entityId: e.entityId, rawWeight: e.weight })),
    BPS_TOTAL
  );

  // Map back to attributions
  return entries.map((entry) => {
    const normalized = distributed.find((d) => d.entityId === entry.entityId);
    const newWeight = normalized?.bps ?? 0;

    // Preserve existing contrib extension fields if present
    const existingContrib = getContrib(entry.attr);

    return {
      ...entry.attr,
      extensions: {
        ...entry.attr.extensions,
        "ext:contrib@1.0.0": {
          ...existingContrib,
          weight: newWeight,
          basis: "points" as const,
        },
      },
    };
  });
}

/**
 * Split an amount according to a distribution.
 *
 * Uses integer arithmetic to avoid floating point errors.
 * Returns dust (remainder) separately for the caller to handle.
 *
 * ⚠️ IMPORTANT:
 * - Dust WILL occur for most splits. Callers MUST decide how to handle it.
 * - Common strategies: send to treasury, give to largest recipient, burn, etc.
 * - This function does NOT automatically distribute dust.
 *
 * @param amount - Total amount to split (must be non-negative)
 * @param distribution - Distribution to use (must have totalBps === 10000)
 * @returns SplitResult with shares, dust, and totals
 *
 * @throws {DistributionError} If amount is negative or distribution is invalid
 *
 * @example
 * ```typescript
 * const result = splitAmount(1000n, distribution);
 * console.log(result.shares);     // Map { "alice" => 600n, "bob" => 400n }
 * console.log(result.dust);       // 0n (no dust in this case)
 * console.log(result.distributed); // 1000n
 *
 * // Handle dust
 * if (result.dust > 0n) {
 *   // Option 1: Give to treasury
 *   treasuryAmount += result.dust;
 *
 *   // Option 2: Give to largest recipient
 *   const largest = [...result.shares.entries()].sort((a, b) => Number(b[1] - a[1]))[0];
 *   result.shares.set(largest[0], largest[1] + result.dust);
 * }
 * ```
 */
export function splitAmount(
  amount: bigint,
  distribution: Distribution
): SplitResult {
  // Validate amount
  if (amount < 0n) {
    throw new DistributionError(
      `Amount cannot be negative: ${amount}`,
      "INVALID_AMOUNT",
      { amount: amount.toString() }
    );
  }

  // Validate distribution
  if (distribution.entries.length > 0 && distribution.totalBps !== BPS_TOTAL) {
    throw new DistributionError(
      `Distribution totalBps must be ${BPS_TOTAL}, got ${distribution.totalBps}. ` +
        `Use calculateDistribution() to create a valid distribution.`,
      "INVALID_DISTRIBUTION",
      { totalBps: distribution.totalBps, expected: BPS_TOTAL }
    );
  }

  const shares = new Map<string, bigint>();
  let distributed = 0n;

  // Use Largest Remainder Method for bigint splitting too
  // First pass: calculate floor shares and remainders
  const entriesWithRemainder: Array<{
    entityId: string;
    floor: bigint;
    remainder: bigint;
  }> = [];

  const bpsTotal = BigInt(BPS_TOTAL);

  for (const entry of distribution.entries) {
    // Calculate exact share: amount * bps / 10000
    // We do (amount * bps) first, then divide, keeping the remainder
    const bps = BigInt(entry.bps);
    const product = amount * bps;
    const floor = product / bpsTotal;
    const remainder = product % bpsTotal;

    entriesWithRemainder.push({
      entityId: entry.entityId,
      floor,
      remainder,
    });

    shares.set(entry.entityId, floor);
    distributed += floor;
  }

  // Calculate dust
  let dust = amount - distributed;

  // Second pass: distribute dust using Largest Remainder Method
  // Sort by remainder descending, then by entityId for determinism
  const sortedByRemainder = [...entriesWithRemainder].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder > a.remainder ? 1 : -1;
    }
    return a.entityId.localeCompare(b.entityId);
  });

  // Give 1 unit to each entry with largest remainder until dust is exhausted
  for (const entry of sortedByRemainder) {
    if (dust <= 0n) break;

    const current = shares.get(entry.entityId)!;
    shares.set(entry.entityId, current + 1n);
    distributed += 1n;
    dust -= 1n;
  }

  return {
    shares,
    dust,
    distributed,
    originalAmount: amount,
  };
}

/**
 * Simple split that returns just the shares map.
 *
 * ⚠️ WARNING: This function may lose dust. For production use with significant
 * amounts, use splitAmount() instead and handle dust explicitly.
 *
 * @deprecated Use splitAmount() for production code
 */
export function splitAmountSimple(
  amount: bigint,
  distribution: Distribution
): Map<string, bigint> {
  return splitAmount(amount, distribution).shares;
}

/**
 * Merge multiple distributions into one.
 *
 * Useful for calculating combined distributions across multiple resources.
 * Uses Largest Remainder Method for fair normalization.
 *
 * @param distributions - Distributions to merge
 * @returns Combined distribution entries with normalized weights summing to 10000
 *
 * @example
 * ```typescript
 * // Alice has 100% of resource 1, and 50% of resource 2
 * // Bob has 50% of resource 2
 * const merged = mergeDistributions([dist1, dist2]);
 * // Alice: (10000 + 5000) / 20000 = 75% = 7500 bps
 * // Bob: 5000 / 20000 = 25% = 2500 bps
 * ```
 */
export function mergeDistributions(
  distributions: Distribution[]
): DistributionEntry[] {
  if (distributions.length === 0) return [];

  // Aggregate by entityId
  const aggregated = new Map<
    string,
    { totalBps: number; payment?: PaymentExtension }
  >();

  for (const dist of distributions) {
    for (const entry of dist.entries) {
      const existing = aggregated.get(entry.entityId);
      if (existing) {
        existing.totalBps += entry.bps;
        // Keep first payment config
      } else {
        aggregated.set(entry.entityId, {
          totalBps: entry.bps,
          payment: entry.payment,
        });
      }
    }
  }

  if (aggregated.size === 0) return [];

  // Convert to array for processing
  const entries = Array.from(aggregated.entries()).map(([entityId, data]) => ({
    entityId,
    rawWeight: data.totalBps,
    payment: data.payment,
  }));

  // Apply Largest Remainder Method
  const distributed = applyLargestRemainderMethod(entries, BPS_TOTAL);

  // Sort by bps descending
  return distributed
    .map(({ entityId, bps, payment }) => ({ entityId, bps, payment }))
    .filter((e) => e.bps > 0)
    .sort((a, b) => {
      if (b.bps !== a.bps) return b.bps - a.bps;
      return a.entityId.localeCompare(b.entityId);
    });
}

/**
 * Validate a distribution for correctness.
 *
 * Checks:
 * - Total bps equals 10000 (or 0 for empty)
 * - All bps values are non-negative integers
 * - No duplicate entity IDs
 * - No NaN or Infinity values
 *
 * @param distribution - Distribution to validate
 * @returns true if valid
 * @throws {DistributionError} if invalid
 */
export function validateDistribution(distribution: Distribution): boolean {
  const seen = new Set<string>();

  let total = 0;
  for (const entry of distribution.entries) {
    // Check for duplicates
    if (seen.has(entry.entityId)) {
      throw new DistributionError(
        `Duplicate entity ID in distribution: ${entry.entityId}`,
        "DUPLICATE_ENTITY",
        { entityId: entry.entityId }
      );
    }
    seen.add(entry.entityId);

    // Validate bps
    if (!Number.isInteger(entry.bps)) {
      throw new DistributionError(
        `Non-integer bps for entity "${entry.entityId}": ${entry.bps}`,
        "INVALID_WEIGHT",
        { entityId: entry.entityId, bps: entry.bps }
      );
    }
    if (entry.bps < 0) {
      throw new DistributionError(
        `Negative bps for entity "${entry.entityId}": ${entry.bps}`,
        "INVALID_WEIGHT",
        { entityId: entry.entityId, bps: entry.bps }
      );
    }
    if (!Number.isFinite(entry.bps)) {
      throw new DistributionError(
        `Invalid bps for entity "${entry.entityId}": ${entry.bps}`,
        "INVALID_WEIGHT",
        { entityId: entry.entityId, bps: entry.bps }
      );
    }

    total += entry.bps;
  }

  // Check total
  if (distribution.entries.length > 0 && total !== BPS_TOTAL) {
    throw new DistributionError(
      `Distribution total is ${total}, expected ${BPS_TOTAL}`,
      "INVALID_DISTRIBUTION",
      { total, expected: BPS_TOTAL }
    );
  }

  if (total !== distribution.totalBps) {
    throw new DistributionError(
      `Distribution.totalBps (${distribution.totalBps}) doesn't match sum of entries (${total})`,
      "INVALID_DISTRIBUTION",
      { totalBps: distribution.totalBps, calculatedTotal: total }
    );
  }

  return true;
}

/*─────────────────────────────────────────────────────────────────────────────*\
 | Utility Functions                                                             |
\*─────────────────────────────────────────────────────────────────────────────*/

/**
 * Format a distribution as a human-readable string.
 * Useful for logging and debugging.
 */
export function formatDistribution(distribution: Distribution): string {
  const lines = [
    `Distribution for ${distribution.resourceRef.ref}:`,
    `  Total: ${distribution.totalBps} bps (${(distribution.totalBps / 100).toFixed(2)}%)`,
    `  Entries:`,
  ];

  for (const entry of distribution.entries) {
    const pct = (entry.bps / 100).toFixed(2);
    lines.push(`    - ${entry.entityId}: ${entry.bps} bps (${pct}%)`);
  }

  if (distribution.metadata.roundingAdjustments.size > 0) {
    lines.push(`  Rounding adjustments:`);
    for (const [entityId, adj] of distribution.metadata.roundingAdjustments) {
      lines.push(`    - ${entityId}: ${adj > 0 ? "+" : ""}${adj} bps`);
    }
  }

  return lines.join("\n");
}

/**
 * Create an empty distribution for a resource.
 */
export function emptyDistribution(resourceRef: ContentReference): Distribution {
  return {
    resourceRef,
    entries: [],
    totalBps: 0,
    metadata: createMetadata(0, 0, false, undefined, new Map()),
  };
}
