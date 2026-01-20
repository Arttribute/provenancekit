import { z } from "zod";
import type { Attribution, Action } from "@arttribute/eaa-types";

/**
 * Namespace for payment extension.
 * @example "ext:payment@1.0.0"
 */
export const PAYMENT_NAMESPACE = "ext:payment@1.0.0" as const;

/**
 * Well-known payment method identifiers.
 * These are suggestions - any string value is valid.
 */
export const PAYMENT_METHODS = {
  /** Real-time token streaming */
  STREAMING: "streaming",
  /** Per-request micropayments */
  MICROPAYMENT: "micropayment",
  /** On-chain split contracts */
  SPLIT: "split",
  /** Direct one-time transfer */
  DIRECT: "direct",
  /** Off-chain/manual tracking */
  MANUAL: "manual",
} as const;

/**
 * Payment recipient information.
 */
export const PaymentRecipient = z.object({
  /** Payment address or identifier */
  address: z.string(),

  /** Chain ID for on-chain payments */
  chainId: z.number().optional(),

  /** Human-readable name (ENS, etc.) */
  name: z.string().optional(),

  /** Network/protocol (e.g., "ethereum", "bitcoin", "lightning") */
  network: z.string().optional(),
});
export type PaymentRecipient = z.infer<typeof PaymentRecipient>;

/**
 * Payment extension schema.
 *
 * Configures payment information for revenue distribution.
 * Uses flexible strings for method to support any payment system.
 *
 * @example
 * ```typescript
 * // Standard on-chain payment
 * const attr = withPayment(attribution, {
 *   recipient: { address: "0x...", chainId: 8453 },
 *   method: PAYMENT_METHODS.STREAMING,
 *   currency: "USDC",
 * });
 *
 * // Custom payment method
 * const attr = withPayment(attribution, {
 *   recipient: { address: "lnbc...", network: "lightning" },
 *   method: "lightning",
 *   config: { invoiceExpiry: 3600 },
 * });
 * ```
 */
export const PaymentExtension = z.object({
  /** Payment recipient */
  recipient: PaymentRecipient,

  /** Payment method (any string - use PAYMENT_METHODS for common ones) */
  method: z.string().optional(),

  /** Currency/token identifier */
  currency: z.string().optional(),

  /** Split in basis points (6000 = 60%) */
  splitBps: z.number().min(0).max(10000).optional(),

  /** Minimum amount to trigger payment */
  minAmount: z.string().optional(),

  /** Method-specific configuration */
  config: z.record(z.unknown()).optional(),
});

export type PaymentExtension = z.infer<typeof PaymentExtension>;

/**
 * Add payment extension to an attribution or action.
 */
export function withPayment<T extends Attribution | Action>(
  obj: T,
  payment: z.input<typeof PaymentExtension>
): T {
  const validated = PaymentExtension.parse(payment);
  return {
    ...obj,
    extensions: { ...obj.extensions, [PAYMENT_NAMESPACE]: validated },
  };
}

/**
 * Get payment extension from an attribution or action.
 */
export function getPayment(
  obj: Attribution | Action
): PaymentExtension | undefined {
  const data = obj.extensions?.[PAYMENT_NAMESPACE];
  if (!data) return undefined;
  return PaymentExtension.parse(data);
}

/**
 * Check if an object has payment extension.
 */
export function hasPayment(obj: Attribution | Action): boolean {
  return obj.extensions?.[PAYMENT_NAMESPACE] !== undefined;
}

/**
 * Get payment recipient address from an attribution.
 */
export function getPaymentAddress(attr: Attribution): string | undefined {
  const payment = getPayment(attr);
  return payment?.recipient.address;
}
