import { z } from "zod";
import type { Attribution } from "@provenancekit/eaa-types";

/**
 * Namespace for contribution extension.
 * @example "ext:contrib@1.0.0"
 */
export const CONTRIB_NAMESPACE = "ext:contrib@1.0.0" as const;

/**
 * How to interpret the weight value.
 *
 * - `points`: Basis points (0-10000, where 10000 = 100%)
 * - `percentage`: Direct percentage (0-100)
 * - `absolute`: Absolute value (context-dependent)
 */
export const ContribBasis = z.enum(["points", "percentage", "absolute"]);
export type ContribBasis = z.infer<typeof ContribBasis>;

/**
 * How the contribution weight was determined.
 */
export const ContribSource = z.enum([
  "self-declared", // Contributor claimed it
  "agreed", // All parties agreed
  "calculated", // Algorithm (git blame, etc.)
  "verified", // Third-party verified
  "default", // System default
]);
export type ContribSource = z.infer<typeof ContribSource>;

/**
 * Contribution extension schema.
 *
 * Tracks how much each entity contributed to a resource.
 *
 * @example
 * ```typescript
 * const attribution = withContrib(attr, {
 *   weight: 6000,        // 60% in basis points
 *   basis: "points",
 *   source: "agreed",
 *   category: "design",
 * });
 * ```
 */
export const ContribExtension = z.object({
  /** Weight value (interpretation depends on basis) */
  weight: z.number().min(0),

  /** How to interpret weight. Default: "points" (basis points, 6000 = 60%) */
  basis: ContribBasis.default("points"),

  /** How this weight was determined */
  source: ContribSource.optional(),

  /** Who verified this contribution (Entity.id) */
  verifiedBy: z.string().optional(),

  /** When the contribution was verified (ISO 8601) */
  verifiedAt: z.string().datetime().optional(),

  /** Category of contribution (e.g., "code", "design", "concept") */
  category: z.string().optional(),

  /** Human-readable note about the contribution */
  note: z.string().optional(),
});

export type ContribExtension = z.infer<typeof ContribExtension>;

/**
 * Add contribution extension to an attribution.
 *
 * @param attr - The attribution to extend
 * @param contrib - Contribution data
 * @returns Attribution with contribution extension
 *
 * @example
 * ```typescript
 * const attributed = withContrib(attribution, {
 *   weight: 6000,
 *   source: "agreed",
 * });
 * ```
 */
export function withContrib(
  attr: Attribution,
  contrib: z.input<typeof ContribExtension>
): Attribution {
  const validated = ContribExtension.parse(contrib);
  return {
    ...attr,
    extensions: { ...attr.extensions, [CONTRIB_NAMESPACE]: validated },
  };
}

/**
 * Get contribution extension from an attribution.
 *
 * @param attr - The attribution to read from
 * @returns Contribution data or undefined if not present
 */
export function getContrib(attr: Attribution): ContribExtension | undefined {
  const data = attr.extensions?.[CONTRIB_NAMESPACE];
  if (!data) return undefined;
  return ContribExtension.parse(data);
}

/**
 * Check if an attribution has contribution extension.
 *
 * @param attr - The attribution to check
 * @returns True if contribution extension exists
 */
export function hasContrib(attr: Attribution): boolean {
  return attr.extensions?.[CONTRIB_NAMESPACE] !== undefined;
}

/**
 * Get contribution weight normalized to basis points (0-10000).
 *
 * Converts from any basis to points:
 * - points: returned as-is
 * - percentage: multiplied by 100
 * - absolute: returned as-is (assumes already in points)
 *
 * @param attr - The attribution to read from
 * @returns Weight in basis points, or 0 if no contribution
 *
 * @example
 * ```typescript
 * const bps = getContribBps(attribution);
 * // 6000 means 60%
 * ```
 */
export function getContribBps(attr: Attribution): number {
  const contrib = getContrib(attr);
  if (!contrib) return 0;

  switch (contrib.basis) {
    case "points":
      return contrib.weight;
    case "percentage":
      return contrib.weight * 100;
    case "absolute":
      return contrib.weight;
  }
}
