import { z } from "zod";

/**
 * Namespace for on-chain proof extension.
 * @example "ext:onchain@1.0.0"
 */
export const ONCHAIN_NAMESPACE = "ext:onchain@1.0.0" as const;

/**
 * On-chain proof extension schema.
 *
 * Stores blockchain anchoring data for provenance records.
 * Typically added by the indexer when events are processed.
 *
 * @example
 * ```typescript
 * const action = withOnchain(act, {
 *   chainId: 8453,
 *   chainName: "Base",
 *   blockNumber: 12345678,
 *   transactionHash: "0xabc...",
 * });
 * ```
 */
export const OnchainExtension = z.object({
  /** Chain ID (e.g., 8453 for Base, 1 for Ethereum) */
  chainId: z.number(),

  /** Human-readable chain name */
  chainName: z.string().optional(),

  /** Block number where the event was recorded */
  blockNumber: z.number(),

  /** Block timestamp (ISO 8601) */
  blockTimestamp: z.string().datetime().optional(),

  /** Transaction hash */
  transactionHash: z.string(),

  /** Log index within the transaction */
  logIndex: z.number().optional(),

  /** Contract address that emitted the event */
  contractAddress: z.string().optional(),

  /** Whether the transaction is confirmed */
  confirmed: z.boolean().optional(),

  /** Number of confirmations */
  confirmations: z.number().optional(),
});

export type OnchainExtension = z.infer<typeof OnchainExtension>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add on-chain proof extension to any extensible object.
 *
 * @param obj - The object to extend (Action, Resource, Attribution)
 * @param onchain - On-chain proof data
 * @returns Object with on-chain extension
 *
 * @example
 * ```typescript
 * const action = withOnchain(act, {
 *   chainId: 8453,
 *   blockNumber: 12345678,
 *   transactionHash: "0xabc...",
 * });
 * ```
 */
export function withOnchain<T extends Extensible>(
  obj: T,
  onchain: z.input<typeof OnchainExtension>
): T {
  const validated = OnchainExtension.parse(onchain);
  return {
    ...obj,
    extensions: { ...obj.extensions, [ONCHAIN_NAMESPACE]: validated },
  };
}

/**
 * Get on-chain proof extension from any extensible object.
 *
 * @param obj - The object to read from
 * @returns On-chain data or undefined if not present
 */
export function getOnchain(obj: Extensible): OnchainExtension | undefined {
  const data = obj.extensions?.[ONCHAIN_NAMESPACE];
  if (!data) return undefined;
  return OnchainExtension.parse(data);
}

/**
 * Check if an object has on-chain proof extension.
 *
 * @param obj - The object to check
 * @returns True if on-chain extension exists
 */
export function hasOnchain(obj: Extensible): boolean {
  return obj.extensions?.[ONCHAIN_NAMESPACE] !== undefined;
}

/**
 * Check if an object is anchored on a specific chain.
 *
 * @param obj - The object to check
 * @param chainId - The chain ID to check for
 * @returns True if anchored on the specified chain
 */
export function isOnChain(obj: Extensible, chainId: number): boolean {
  const onchain = getOnchain(obj);
  return onchain?.chainId === chainId;
}

/**
 * Get the transaction hash for an on-chain anchored object.
 *
 * @param obj - The object to read from
 * @returns Transaction hash or undefined
 */
export function getTxHash(obj: Extensible): string | undefined {
  const onchain = getOnchain(obj);
  return onchain?.transactionHash;
}
