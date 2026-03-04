/**
 * Payment Adapters
 *
 * Re-exports all payment adapters for convenient access.
 *
 * @example
 * ```typescript
 * import {
 *   DirectTransferAdapter,
 *   SplitsAdapter,
 *   SuperfluidAdapter,
 * } from "@provenancekit/payments/adapters";
 * ```
 *
 * @packageDocumentation
 */

// Direct transfers (baseline)
export {
  DirectTransferAdapter,
  directTransferAdapter,
} from "./direct.js";

// 0xSplits (automatic revenue splitting)
export {
  SplitsAdapter,
  splitsAdapter,
} from "./splits.js";

// Superfluid (real-time streaming)
export {
  SuperfluidAdapter,
  superfluidAdapter,
  SUPER_TOKENS,
} from "./superfluid.js";
