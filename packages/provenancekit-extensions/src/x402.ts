import { z } from "zod";
import type { Resource, Action, Attribution } from "@provenancekit/eaa-types";

/**
 * Namespace for the x402 payment extension.
 *
 * @remarks
 * x402 is an HTTP-native payment protocol that uses the HTTP 402 status code.
 * When a client requests a resource and lacks payment, the server responds 402
 * with payment requirements. The client pays, then includes a payment proof in
 * the next request.
 *
 * This extension records x402-related provenance data in three modes:
 *
 * 1. **Requirements** (on Resource) — what payment is needed to access this resource
 * 2. **Proof** (on Action) — that an action was triggered by a verified x402 payment
 * 3. **Revenue split** (on Attribution) — how x402 revenue flows to contributors
 *
 * It intentionally records DATA only. Payment logic lives in adapter packages
 * (e.g., `@provenancekit/payments`). This fits the pure meta-pattern: the
 * extension provides the provenance trail; opinionated behaviour is elsewhere.
 *
 * @see {@link https://x402.org} x402 protocol specification
 * @example
 * ```typescript
 * // Mark a resource as requiring payment
 * const resource = withX402Requirements(myResource, {
 *   amount: "0.001",
 *   currency: "USDC",
 *   network: "base",
 *   chainId: 8453,
 *   recipient: "0xsplit-contract-address",
 * });
 *
 * // Record that an action was triggered by a verified x402 payment
 * const action = withX402Proof(myAction, {
 *   paymentTxHash: "0xabc123...",
 *   amount: "0.001",
 *   currency: "USDC",
 *   paidAt: new Date().toISOString(),
 * });
 *
 * // Record revenue split for an attribution
 * const attribution = withX402Split(myAttribution, {
 *   splitBps: 7000,          // 70% of x402 revenue
 *   splitContract: "0x...",  // 0xSplits contract
 *   chainId: 8453,
 * });
 * ```
 */
export const X402_NAMESPACE = "ext:x402@1.0.0" as const;

/*─────────────────────────────────────────────────────────────*\
 | Sub-schemas                                                   |
\*─────────────────────────────────────────────────────────────*/

/**
 * Payment requirements embedded in a Resource.
 * Communicates what x402 payment is needed to access the resource.
 */
export const X402Requirements = z.object({
  /**
   * Payment amount as a human-readable decimal string.
   * Examples: "0.001", "1.50", "10"
   * Does NOT represent wei — use a standard unit (USDC = 6 decimals, ETH = 18).
   */
  amount: z.string(),

  /**
   * Currency or token identifier.
   * Examples: "USDC", "ETH", "WETH", "DAI"
   */
  currency: z.string(),

  /**
   * Human-readable network name.
   * Examples: "base", "base-sepolia", "arbitrum", "optimism"
   */
  network: z.string(),

  /**
   * EVM chain ID for on-chain payment validation.
   * Examples: 8453 (Base), 84532 (Base Sepolia), 42161 (Arbitrum)
   */
  chainId: z.number().int().positive(),

  /**
   * Payment recipient address.
   * Can be a direct wallet or a revenue-split contract (e.g., 0xSplits).
   * EIP-55 checksum is recommended but not enforced at this layer.
   */
  recipient: z.string(),

  /**
   * Optional: contract address for revenue distribution.
   * If provided, payments to `recipient` are auto-split by this contract.
   */
  splitContract: z.string().optional(),

  /**
   * Optional: expiry timestamp for these payment terms.
   * After this time the requirements may change (price update, etc.).
   * ISO 8601 datetime string.
   */
  expiresAt: z.string().datetime().optional(),
});
export type X402Requirements = z.infer<typeof X402Requirements>;

/**
 * Payment proof recorded after a successful x402 payment verification.
 * Attaches to Actions that were triggered by (or resulted in) x402 payments.
 */
export const X402Proof = z.object({
  /**
   * Transaction hash of the payment on-chain.
   * This is the primary cryptographic proof of payment.
   */
  paymentTxHash: z.string(),

  /**
   * Amount paid (decimal string, same unit as requirements).
   */
  amount: z.string().optional(),

  /**
   * Currency paid.
   */
  currency: z.string().optional(),

  /**
   * Chain ID where the payment was made.
   */
  chainId: z.number().int().positive().optional(),

  /**
   * When payment was verified (ISO 8601).
   */
  paidAt: z.string().datetime(),

  /**
   * Whether the payment has been independently verified on-chain.
   * false = recorded but not yet verified; true = verified
   */
  verified: z.boolean().default(false),

  /**
   * The payer's address.
   */
  payer: z.string().optional(),
});
export type X402Proof = z.infer<typeof X402Proof>;

/**
 * Revenue split configuration for x402 payments.
 * Attaches to Attributions to record how x402 revenue flows to contributors.
 *
 * @remarks
 * The split is expressed in basis points (bps):
 * - 10000 bps = 100%
 * - 7000 bps = 70%
 * - 250 bps = 2.5%
 *
 * All splits for a resource should sum to 10000.
 * Use `ext:contrib@1.0.0` for contribution weights — x402 split is purely
 * the revenue distribution configuration.
 */
export const X402Split = z.object({
  /**
   * Revenue share in basis points (0–10000).
   * 10000 = 100%, 5000 = 50%, 250 = 2.5%
   */
  splitBps: z.number().int().min(0).max(10000),

  /**
   * The 0xSplits or other revenue-split contract address.
   * If set, on-chain payments to the contract auto-distribute.
   */
  splitContract: z.string().optional(),

  /**
   * Chain ID for the split contract.
   */
  chainId: z.number().int().positive().optional(),

  /**
   * Direct payment address for this contributor (alternative to splitContract).
   * Used when paying contributors directly without a split contract.
   */
  paymentAddress: z.string().optional(),

  /**
   * Preferred currency for payouts.
   */
  currency: z.string().optional(),
});
export type X402Split = z.infer<typeof X402Split>;

/**
 * Full x402 extension schema.
 *
 * At least one of `requirements`, `proof`, or `split` must be present.
 * The fields that are present indicate the mode:
 * - `requirements` → payment requirements for a Resource
 * - `proof` → payment proof for an Action
 * - `split` → revenue split config for an Attribution
 */
export const X402Extension = z
  .object({
    /** Payment requirements (set on Resource) */
    requirements: X402Requirements.optional(),

    /** Payment proof (set on Action after payment verified) */
    proof: X402Proof.optional(),

    /** Revenue split configuration (set on Attribution) */
    split: X402Split.optional(),
  })
  .refine(
    (data) => data.requirements !== undefined || data.proof !== undefined || data.split !== undefined,
    { message: "At least one of requirements, proof, or split must be provided" }
  );

export type X402Extension = z.infer<typeof X402Extension>;

/*─────────────────────────────────────────────────────────────*\
 | Helper Functions                                              |
\*─────────────────────────────────────────────────────────────*/

/**
 * Attach x402 payment requirements to a Resource.
 *
 * @example
 * ```typescript
 * const resource = withX402Requirements(myResource, {
 *   amount: "0.001",
 *   currency: "USDC",
 *   network: "base",
 *   chainId: 8453,
 *   recipient: "0xsplit-contract",
 * });
 * ```
 */
export function withX402Requirements<T extends Resource>(
  resource: T,
  requirements: z.input<typeof X402Requirements>
): T {
  const validated = X402Requirements.parse(requirements);
  return {
    ...resource,
    extensions: {
      ...resource.extensions,
      [X402_NAMESPACE]: { requirements: validated },
    },
  };
}

/**
 * Attach an x402 payment proof to an Action.
 *
 * @example
 * ```typescript
 * const action = withX402Proof(myAction, {
 *   paymentTxHash: "0xabc123...",
 *   amount: "0.001",
 *   currency: "USDC",
 *   paidAt: new Date().toISOString(),
 * });
 * ```
 */
export function withX402Proof<T extends Action>(
  action: T,
  proof: z.input<typeof X402Proof>
): T {
  const validated = X402Proof.parse(proof);
  return {
    ...action,
    extensions: {
      ...action.extensions,
      [X402_NAMESPACE]: { proof: validated },
    },
  };
}

/**
 * Attach x402 revenue split configuration to an Attribution.
 *
 * @example
 * ```typescript
 * const attribution = withX402Split(myAttribution, {
 *   splitBps: 7000,          // 70% of x402 revenue
 *   splitContract: "0x...",
 *   chainId: 8453,
 * });
 * ```
 */
export function withX402Split<T extends Attribution>(
  attribution: T,
  split: z.input<typeof X402Split>
): T {
  const validated = X402Split.parse(split);
  return {
    ...attribution,
    extensions: {
      ...attribution.extensions,
      [X402_NAMESPACE]: { split: validated },
    },
  };
}

/**
 * Get the full x402 extension from any EAA object.
 */
export function getX402(
  obj: Resource | Action | Attribution
): X402Extension | undefined {
  const data = obj.extensions?.[X402_NAMESPACE];
  if (!data) return undefined;
  return X402Extension.parse(data);
}

/**
 * Get x402 payment requirements from a Resource.
 */
export function getX402Requirements(resource: Resource): X402Requirements | undefined {
  return getX402(resource)?.requirements;
}

/**
 * Get x402 payment proof from an Action.
 */
export function getX402Proof(action: Action): X402Proof | undefined {
  return getX402(action)?.proof;
}

/**
 * Get x402 revenue split from an Attribution.
 */
export function getX402Split(attribution: Attribution): X402Split | undefined {
  return getX402(attribution)?.split;
}

/**
 * Check if an object has an x402 extension.
 */
export function hasX402(obj: Resource | Action | Attribution): boolean {
  return obj.extensions?.[X402_NAMESPACE] !== undefined;
}

/**
 * Check if a Resource has x402 payment requirements.
 */
export function requiresX402Payment(resource: Resource): boolean {
  return getX402Requirements(resource) !== undefined;
}

/**
 * Check if an Action was triggered by a verified x402 payment.
 */
export function isX402Verified(action: Action): boolean {
  const proof = getX402Proof(action);
  return proof?.verified === true;
}

/**
 * Calculate total basis points across all attributions for a resource.
 *
 * Useful for validating that splits sum to 100% before deploying a contract.
 *
 * @returns Total bps (should equal 10000 for a complete distribution)
 *
 * @example
 * ```typescript
 * const total = totalX402SplitBps(attributions);
 * if (total !== 10000) {
 *   throw new Error(`Splits must sum to 100% (10000 bps), got ${total}`);
 * }
 * ```
 */
export function totalX402SplitBps(attributions: Attribution[]): number {
  return attributions.reduce((sum, attr) => {
    const split = getX402Split(attr);
    return sum + (split?.splitBps ?? 0);
  }, 0);
}
