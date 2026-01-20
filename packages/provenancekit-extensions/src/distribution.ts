import type { Attribution, ContentReference } from "@arttribute/eaa-types";
import { getContribBps } from "./contrib";
import { getPayment, type PaymentExtension } from "./payment";

/**
 * A single entry in a payment distribution.
 */
export interface DistributionEntry {
  /** Entity receiving the payment */
  entityId: string;

  /** Share in basis points (6000 = 60%) */
  bps: number;

  /** Payment configuration (if available) */
  payment?: PaymentExtension;
}

/**
 * Complete distribution for a resource.
 */
export interface Distribution {
  /** The resource this distribution applies to */
  resourceRef: ContentReference;

  /** Distribution entries (one per contributor) */
  entries: DistributionEntry[];

  /** Total basis points (should be 10000 after normalization) */
  totalBps: number;
}

/**
 * Calculate payment distribution from attributions.
 *
 * Takes a list of attributions for a resource and calculates how
 * payments should be split based on contribution weights.
 *
 * @param resourceRef - The resource to calculate distribution for
 * @param attributions - All attributions (will be filtered to relevant ones)
 * @returns Distribution with normalized entries
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
 * // {
 * //   entries: [
 * //     { entityId: "alice", bps: 6000, payment: {...} },
 * //     { entityId: "bob", bps: 3000, payment: {...} },
 * //     { entityId: "carol", bps: 1000, payment: {...} },
 * //   ],
 * //   totalBps: 10000
 * // }
 * ```
 */
export function calculateDistribution(
  resourceRef: ContentReference,
  attributions: Attribution[]
): Distribution {
  // Filter to attributions for this resource
  const relevant = attributions.filter(
    (a) => a.resourceRef?.ref === resourceRef.ref
  );

  if (relevant.length === 0) {
    return { resourceRef, entries: [], totalBps: 0 };
  }

  // Build entries with contribution weights
  // Note: entityId is always required in Attribution, but Zod refine() affects inference
  const entries: DistributionEntry[] = relevant.map((attr) => ({
    entityId: attr.entityId as string,
    bps: getContribBps(attr),
    payment: getPayment(attr),
  }));

  // Calculate total
  const totalBps = entries.reduce((sum, e) => sum + e.bps, 0);

  // If weights don't sum to anything, can't distribute
  if (totalBps === 0) {
    return { resourceRef, entries: [], totalBps: 0 };
  }

  // Normalize to 10000 if not already
  const normalized =
    totalBps === 10000
      ? entries
      : entries.map((e) => ({
          ...e,
          bps: Math.round((e.bps / totalBps) * 10000),
        }));

  // Adjust for rounding errors (ensure sum is exactly 10000)
  const normalizedTotal = normalized.reduce((sum, e) => sum + e.bps, 0);
  if (normalizedTotal !== 10000 && normalized.length > 0) {
    normalized[0].bps += 10000 - normalizedTotal;
  }

  return {
    resourceRef,
    entries: normalized,
    totalBps: 10000,
  };
}

/**
 * Calculate distribution for action-level attributions.
 *
 * Use this when attributions are tied to actions rather than resources.
 *
 * @param actionId - The action to calculate distribution for
 * @param attributions - All attributions (will be filtered to relevant ones)
 * @returns Distribution entries with normalized weights
 */
export function calculateActionDistribution(
  actionId: string,
  attributions: Attribution[]
): Omit<Distribution, "resourceRef"> & { actionId: string } {
  // Filter to attributions for this action
  const relevant = attributions.filter((a) => a.actionId === actionId);

  if (relevant.length === 0) {
    return { actionId, entries: [], totalBps: 0 };
  }

  // Build entries with contribution weights
  // Note: entityId is always required in Attribution, but Zod refine() affects inference
  const entries: DistributionEntry[] = relevant.map((attr) => ({
    entityId: attr.entityId as string,
    bps: getContribBps(attr),
    payment: getPayment(attr),
  }));

  // Calculate total
  const totalBps = entries.reduce((sum, e) => sum + e.bps, 0);

  if (totalBps === 0) {
    return { actionId, entries: [], totalBps: 0 };
  }

  // Normalize to 10000
  const normalized =
    totalBps === 10000
      ? entries
      : entries.map((e) => ({
          ...e,
          bps: Math.round((e.bps / totalBps) * 10000),
        }));

  const normalizedTotal = normalized.reduce((sum, e) => sum + e.bps, 0);
  if (normalizedTotal !== 10000 && normalized.length > 0) {
    normalized[0].bps += 10000 - normalizedTotal;
  }

  return {
    actionId,
    entries: normalized,
    totalBps: 10000,
  };
}

/**
 * Normalize contribution weights so they sum to 10000 basis points.
 *
 * Useful when you have attributions with arbitrary weights that need
 * to be converted to a valid distribution.
 *
 * @param attributions - Attributions to normalize
 * @returns New attributions with normalized contribution weights
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
  const total = attributions.reduce((sum, a) => sum + getContribBps(a), 0);

  if (total === 0 || total === 10000) return attributions;

  return attributions.map((attr) => {
    const currentBps = getContribBps(attr);
    const normalizedBps = Math.round((currentBps / total) * 10000);

    return {
      ...attr,
      extensions: {
        ...attr.extensions,
        "ext:contrib@1.0.0": {
          weight: normalizedBps,
          basis: "points" as const,
        },
      },
    };
  });
}

/**
 * Split an amount according to a distribution.
 *
 * @param amount - Total amount to split
 * @param distribution - Distribution to use
 * @returns Map of entityId to amount
 *
 * @example
 * ```typescript
 * const amounts = splitAmount(1000n, distribution);
 * // { "alice": 600n, "bob": 300n, "carol": 100n }
 * ```
 */
export function splitAmount(
  amount: bigint,
  distribution: Distribution
): Map<string, bigint> {
  const result = new Map<string, bigint>();

  for (const entry of distribution.entries) {
    const share = (amount * BigInt(entry.bps)) / 10000n;
    result.set(entry.entityId, share);
  }

  return result;
}

/**
 * Merge multiple distributions into one.
 *
 * Useful for calculating combined distributions across multiple resources.
 *
 * @param distributions - Distributions to merge
 * @returns Combined distribution with merged entries
 */
export function mergeDistributions(
  distributions: Distribution[]
): DistributionEntry[] {
  const merged = new Map<string, DistributionEntry>();

  for (const dist of distributions) {
    for (const entry of dist.entries) {
      const existing = merged.get(entry.entityId);
      if (existing) {
        existing.bps += entry.bps;
        // Keep the payment config from the first occurrence
      } else {
        merged.set(entry.entityId, { ...entry });
      }
    }
  }

  // Convert back to array and normalize
  const entries = Array.from(merged.values());
  const total = entries.reduce((sum, e) => sum + e.bps, 0);

  if (total === 0) return [];

  return entries.map((e) => ({
    ...e,
    bps: Math.round((e.bps / total) * 10000),
  }));
}
