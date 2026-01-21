/**
 * @provenancekit/payments
 *
 * Payment distribution adapters for ProvenanceKit.
 *
 * This package provides adapters for distributing payments based on
 * provenance attribution data. It integrates with `@provenancekit/extensions`
 * to convert contribution weights into actual payments.
 *
 * ## Adapters
 *
 * | Adapter | Model | Best For |
 * |---------|-------|----------|
 * | **DirectTransferAdapter** | One-time | Simple payments, full control |
 * | **SplitsAdapter** | Split contract | Automatic royalty distribution |
 * | **SuperfluidAdapter** | Streaming | Subscriptions, salaries |
 *
 * ## Quick Start
 *
 * ```typescript
 * import { DirectTransferAdapter } from "@provenancekit/payments/adapters/direct";
 * import { calculateDistribution } from "@provenancekit/extensions";
 * import { parseEther, zeroAddress } from "viem";
 *
 * // Calculate distribution from attributions
 * const distribution = calculateDistribution(resourceRef, attributions);
 *
 * // Execute payment
 * const adapter = new DirectTransferAdapter();
 * const result = await adapter.distribute({
 *   distribution,
 *   amount: parseEther("1"),
 *   token: zeroAddress, // Native ETH
 *   chainId: 8453,
 *   walletClient,
 *   publicClient,
 * });
 *
 * console.log(`Paid ${result.payments.length} recipients`);
 * ```
 *
 * ## Choosing an Adapter
 *
 * - **DirectTransferAdapter**: Use for one-time payments where you want
 *   full control over when payments happen. Works on any EVM chain.
 *
 * - **SplitsAdapter**: Use when you want automatic revenue splitting.
 *   Creates a Split contract that automatically distributes any funds
 *   sent to it. Great for ongoing royalties.
 *
 * - **SuperfluidAdapter**: Use for continuous payment streams.
 *   Tokens flow every second from sender to recipients.
 *   Requires SuperTokens (wrapped versions of regular tokens).
 *
 * @packageDocumentation
 */

/*─────────────────────────────────────────────────────────────*\
 | Type Exports                                                 |
\*─────────────────────────────────────────────────────────────*/

export type {
  // Core interfaces
  IPaymentAdapter,
  PaymentModel,

  // Parameters
  DistributeParams,
  AdapterOptions,

  // Results
  PaymentResult,
  PaymentEntry,
  FeeEstimate,

  // Errors
  PaymentErrorCode,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Value Exports                                                |
\*─────────────────────────────────────────────────────────────*/

export {
  // Error class
  PaymentError,

  // Constants
  CHAIN_IDS,
  NATIVE_TOKEN,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Adapter Exports                                              |
\*─────────────────────────────────────────────────────────────*/

// Re-export adapters from submodules for convenience
// Users can also import directly from "@provenancekit/payments/adapters/direct"

export {
  DirectTransferAdapter,
  directTransferAdapter,
  SplitsAdapter,
  splitsAdapter,
  SuperfluidAdapter,
  superfluidAdapter,
  SUPER_TOKENS,
} from "./adapters/index.js";
