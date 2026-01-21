/**
 * Core types for ProvenanceKit payment adapters.
 *
 * @packageDocumentation
 */

import type { Distribution } from "@provenancekit/extensions";
import type { Address, PublicClient, WalletClient } from "viem";

/*─────────────────────────────────────────────────────────────*\
 | Payment Models                                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Payment model supported by adapters.
 *
 * - `one-time`: Single transfer per recipient (Direct)
 * - `streaming`: Continuous token flow (Superfluid)
 * - `split-contract`: Funds sent to auto-splitting contract (0xSplits)
 */
export type PaymentModel = "one-time" | "streaming" | "split-contract";

/*─────────────────────────────────────────────────────────────*\
 | Adapter Interface                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Payment adapter interface.
 *
 * All payment adapters implement this interface, allowing them to be
 * used interchangeably for distributing payments based on provenance
 * attribution data.
 *
 * @example
 * ```typescript
 * const adapter: IPaymentAdapter = new DirectTransferAdapter();
 * const result = await adapter.distribute({
 *   distribution,
 *   amount: parseEther("1"),
 *   token: zeroAddress,
 *   chainId: 8453,
 *   walletClient,
 *   publicClient,
 * });
 * ```
 */
export interface IPaymentAdapter {
  /** Unique adapter identifier */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Supported chain IDs */
  readonly supportedChains: number[];

  /** Payment model: one-time, streaming, or split-contract */
  readonly model: PaymentModel;

  /**
   * Execute a payment distribution.
   *
   * @param params - Distribution parameters
   * @returns Payment result with transaction details
   * @throws {PaymentError} If distribution fails
   */
  distribute(params: DistributeParams): Promise<PaymentResult>;

  /**
   * Estimate fees for a distribution (optional).
   *
   * @param params - Distribution parameters
   * @returns Fee estimate in native token
   */
  estimateFees?(params: DistributeParams): Promise<FeeEstimate>;

  /**
   * Check if adapter supports a specific token (optional).
   *
   * Some adapters only support specific tokens:
   * - Superfluid requires SuperTokens
   * - Some split contracts may have token restrictions
   *
   * @param token - Token address to check
   * @param chainId - Chain ID
   * @returns True if token is supported
   */
  supportsToken?(token: Address, chainId: number): Promise<boolean>;
}

/*─────────────────────────────────────────────────────────────*\
 | Distribution Parameters                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Parameters for executing a payment distribution.
 */
export interface DistributeParams {
  /**
   * Distribution from @provenancekit/extensions.
   *
   * Contains recipient shares in basis points (10000 = 100%).
   * Use `calculateDistribution()` from extensions to generate this.
   */
  distribution: Distribution;

  /**
   * Total amount to distribute (in token's smallest unit).
   *
   * For streaming: total amount over the stream duration.
   * For split-contract: initial amount to send to split.
   */
  amount: bigint;

  /**
   * Token address to distribute.
   *
   * - Use `0x0...0` (zeroAddress) for native ETH
   * - For Superfluid: must be a SuperToken address
   * - For 0xSplits: most ERC-20s are supported
   */
  token: Address;

  /**
   * Chain ID for the transaction.
   */
  chainId: number;

  /**
   * Wallet client for signing transactions.
   */
  walletClient: WalletClient;

  /**
   * Public client for reading chain state.
   */
  publicClient: PublicClient;

  /**
   * Adapter-specific options.
   */
  options?: AdapterOptions;
}

/**
 * Adapter-specific options.
 */
export interface AdapterOptions {
  /**
   * Superfluid: Stream duration in seconds.
   * @default 30 days (2592000 seconds)
   */
  streamDuration?: number;

  /**
   * 0xSplits: Whether to create an immutable split.
   * Immutable splits cannot be modified after creation.
   * @default true
   */
  immutable?: boolean;

  /**
   * 0xSplits: Controller address for mutable splits.
   * Only used if immutable is false.
   */
  controller?: Address;

  /**
   * 0xSplits: Distributor fee in basis points.
   * Fee paid to whoever calls distribute on the split.
   * @default 0
   */
  distributorFee?: number;

  /**
   * Gas limit override.
   */
  gasLimit?: bigint;

  /**
   * Custom metadata to attach to payment.
   */
  metadata?: Record<string, unknown>;
}

/*─────────────────────────────────────────────────────────────*\
 | Payment Results                                              |
\*─────────────────────────────────────────────────────────────*/

/**
 * Result of a payment distribution.
 */
export interface PaymentResult {
  /** Whether all payments succeeded */
  success: boolean;

  /** Adapter that processed the payment */
  adapter: string;

  /** Payment model used */
  model: PaymentModel;

  /** Transaction hash(es) */
  txHashes: string[];

  /** Individual payment results */
  payments: PaymentEntry[];

  /** Total amount distributed (sum of all payments) */
  totalDistributed: bigint;

  /**
   * Dust amount that couldn't be distributed.
   *
   * Due to integer division, small remainders may occur.
   * Callers should handle dust appropriately.
   */
  dust: bigint;

  /**
   * Adapter-specific data.
   *
   * Examples:
   * - 0xSplits: `{ splitAddress: "0x..." }`
   * - Superfluid: `{ streamDuration: 2592000 }`
   */
  data?: Record<string, unknown>;
}

/**
 * Individual payment entry in a distribution result.
 */
export interface PaymentEntry {
  /** Recipient address */
  recipient: Address;

  /** Amount sent (in token's smallest unit) */
  amount: bigint;

  /** Share in basis points (for reference) */
  bps: number;

  /** Whether this payment succeeded */
  success: boolean;

  /** Transaction hash for this payment (if separate tx) */
  txHash?: string;

  /** Error message if payment failed */
  error?: string;
}

/**
 * Fee estimate for a distribution.
 */
export interface FeeEstimate {
  /** Estimated gas cost in native token */
  gasEstimate: bigint;

  /** Number of transactions required */
  txCount: number;

  /** Adapter-specific fees (e.g., protocol fees) */
  protocolFees?: bigint;

  /** Total estimated cost */
  total: bigint;
}

/*─────────────────────────────────────────────────────────────*\
 | Errors                                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Error codes for payment operations.
 */
export type PaymentErrorCode =
  | "UNSUPPORTED_CHAIN"
  | "UNSUPPORTED_TOKEN"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_ALLOWANCE"
  | "TRANSACTION_FAILED"
  | "TRANSACTION_REVERTED"
  | "INVALID_DISTRIBUTION"
  | "EMPTY_DISTRIBUTION"
  | "INVALID_AMOUNT"
  | "ADAPTER_NOT_INITIALIZED"
  | "ADAPTER_ERROR";

/**
 * Error thrown by payment operations.
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: PaymentErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Common chain IDs for reference.
 */
export const CHAIN_IDS = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  AVALANCHE: 43114,
  BSC: 56,
  GNOSIS: 100,
  // Testnets
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  POLYGON_AMOY: 80002,
} as const;

/**
 * Zero address constant (for native ETH).
 */
export const NATIVE_TOKEN: Address =
  "0x0000000000000000000000000000000000000000";
