# ProvenanceKit Master Implementation Plan

## Executive Summary

This document details the complete implementation plan for ProvenanceKit's Extension Layer and Platform Layer, building on the completed Base Layer. The goal is to create a universal provenance framework for Human-AI created works.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM LAYER                                      │
│  ┌──────────────────────┐              ┌──────────────────────┐                 │
│  │   provenancekit-app  │◄────────────►│   provenancekit-api  │                 │
│  │   (Next.js Frontend) │              │   (API Server)       │                 │
│  └──────────┬───────────┘              └──────────┬───────────┘                 │
│             │                                     │                              │
│             ▼                                     ▼                              │
│  ┌──────────────────────────────────────────────────────────────┐               │
│  │                      EXTENSION LAYER                          │               │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │               │
│  │  │ extensions  │ │  payments   │ │   privacy   │ │   git   │ │               │
│  │  │ - contrib   │ │ - superfluid│ │ - encrypt   │ │ - hooks │ │               │
│  │  │ - license   │ │ - x402      │ │ - lit       │ │ - blame │ │               │
│  │  │ - payment   │ │ - splits    │ │ - tee       │ │ - track │ │               │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │               │
│  │                                                               │               │
│  │  ┌─────────────┐ ┌─────────────┐                             │               │
│  │  │    media    │ │     ai      │                             │               │
│  │  │ - c2pa      │ │ - models    │                             │               │
│  │  │ - exif      │ │ - prompts   │                             │               │
│  │  └─────────────┘ └─────────────┘                             │               │
│  └──────────────────────────────────────────────────────────────┘               │
│                                      │                                           │
└──────────────────────────────────────┼───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼───────────────────────────────────────────┐
│                              BASE LAYER (✅ COMPLETE)                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │  eaa-types  │ │  contracts  │ │   storage   │ │   indexer   │                │
│  │  (Schemas)  │ │  (On-chain) │ │  (DB/Files) │ │  (Sync)     │                │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 1: EXTENSION LAYER

## Package 1: @provenancekit/extensions

**Purpose:** Type-safe extension schemas, helpers, and registry for the EAA extension system.

### 1.1 Directory Structure

```
packages/provenancekit-extensions/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── registry.ts
│   ├── types.ts
│   ├── utils.ts
│   ├── schemas/
│   │   ├── index.ts
│   │   ├── contrib.ts          # ext:contrib@1.0.0
│   │   ├── license.ts          # ext:license@1.0.0
│   │   ├── payment.ts          # ext:payment@1.0.0
│   │   ├── onchain.ts          # ext:onchain@1.0.0
│   │   ├── storage.ts          # ext:storage@1.0.0
│   │   └── ai.ts               # ext:ai@1.0.0
│   └── helpers/
│       ├── index.ts
│       ├── contrib.ts
│       ├── license.ts
│       ├── payment.ts
│       └── distribution.ts
└── tests/
    ├── schemas.test.ts
    ├── helpers.test.ts
    ├── distribution.test.ts
    └── registry.test.ts
```

### 1.2 Extension Schemas

#### ext:contrib@1.0.0 (Contribution Weights)

```typescript
/**
 * Contribution extension for tracking how much each entity contributed.
 *
 * Used in: Attribution
 *
 * @example
 * {
 *   "ext:contrib@1.0.0": {
 *     weight: 6000,        // 60% in basis points
 *     basis: "points",
 *     source: "agreed",
 *     verifiedBy: "did:key:auditor",
 *     category: "design"
 *   }
 * }
 */
export const ContribExtension = z.object({
  weight: z.number().min(0).max(10000),
  basis: z.enum(["points", "percentage", "absolute"]).default("points"),
  source: z.enum([
    "self-declared",    // Contributor claimed it
    "agreed",           // All parties agreed
    "calculated",       // Algorithm (git blame, etc.)
    "verified",         // Third-party verified
    "default"           // System default
  ]).optional(),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  note: z.string().optional(),
  category: z.string().optional(),  // "code", "design", "concept", etc.
});
```

#### ext:license@1.0.0 (Licensing Terms)

```typescript
/**
 * License extension for content usage terms.
 *
 * Used in: Resource, Attribution
 *
 * @example
 * {
 *   "ext:license@1.0.0": {
 *     type: "CC-BY-4.0",
 *     commercial: true,
 *     derivatives: true,
 *     attribution: "required",
 *     termsUrl: "https://creativecommons.org/licenses/by/4.0/"
 *   }
 * }
 */
export const LicenseExtension = z.object({
  type: z.string(),  // SPDX identifier or custom
  commercial: z.boolean().optional(),
  derivatives: z.boolean().optional(),
  shareAlike: z.boolean().optional(),
  attribution: z.enum(["required", "requested", "none"]).optional(),
  attributionText: z.string().optional(),
  termsUrl: z.string().url().optional(),
  jurisdiction: z.string().optional(),
  expires: z.string().datetime().optional(),
  exclusiveRights: z.array(z.string()).optional(),  // ["print", "digital", etc.]
});
```

#### ext:payment@1.0.0 (Payment Configuration)

```typescript
/**
 * Payment extension for revenue distribution.
 *
 * Used in: Attribution, Action
 *
 * @example
 * {
 *   "ext:payment@1.0.0": {
 *     recipient: {
 *       address: "0x742d35Cc6634C0532925a3b844Bc9e7595f1Ed9a",
 *       chainId: 8453,
 *       ensName: "alice.eth"
 *     },
 *     method: "superfluid",
 *     currency: "USDCx",
 *     splitBps: 6000
 *   }
 * }
 */
export const PaymentExtension = z.object({
  recipient: z.object({
    address: z.string(),
    chainId: z.number().optional(),
    ensName: z.string().optional(),
  }),
  method: z.enum([
    "superfluid",   // Real-time streaming
    "x402",         // HTTP micropayments
    "splits",       // 0xSplits
    "direct",       // Direct transfer
    "manual"        // Off-chain tracking
  ]).optional(),
  currency: z.string().optional(),  // "USDC", "ETH", "USDCx"
  splitBps: z.number().min(0).max(10000).optional(),
  minAmount: z.string().optional(),
  minFlowRate: z.string().optional(),  // For Superfluid
  pricePerAccess: z.string().optional(),  // For x402
});
```

#### ext:onchain@1.0.0 (Blockchain Proof)

```typescript
/**
 * On-chain proof extension added by indexer.
 *
 * Used in: Action, Resource, Attribution
 */
export const OnchainExtension = z.object({
  chainId: z.number(),
  chainName: z.string().optional(),
  blockNumber: z.number(),
  blockTimestamp: z.string().datetime().optional(),
  transactionHash: z.string(),
  logIndex: z.number().optional(),
  contractAddress: z.string().optional(),
  confirmed: z.boolean().optional(),
  confirmations: z.number().optional(),
});
```

#### ext:storage@1.0.0 (Storage Metadata)

```typescript
/**
 * Storage extension for content replication tracking.
 *
 * Used in: Resource
 */
export const StorageExtension = z.object({
  pinned: z.boolean().optional(),
  replicas: z.array(z.object({
    provider: z.enum(["ipfs-pinata", "ipfs-infura", "arweave", "filecoin", "s3"]),
    status: z.enum(["pending", "active", "failed", "expired"]),
    region: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
  })).optional(),
  totalSize: z.number().optional(),
  encrypted: z.boolean().optional(),
  contentType: z.string().optional(),
});
```

#### ext:ai@1.0.0 (AI Metadata)

```typescript
/**
 * AI extension for model/generation tracking.
 *
 * Used in: Entity (for AI agents), Action (for generations)
 */
// For Entities (describing the AI)
export const AIEntityExtension = z.object({
  provider: z.string(),      // "anthropic", "openai", etc.
  model: z.string(),         // "claude-3-opus", "gpt-4"
  version: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
});

// For Actions (describing the generation)
export const AIActionExtension = z.object({
  prompt: z.string().optional(),        // May be omitted for privacy
  promptHash: z.string().optional(),    // Hash for privacy-preserving
  systemPrompt: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  tokensUsed: z.number().optional(),
  generationTime: z.number().optional(),
  seed: z.number().optional(),
});
```

### 1.3 Helper Functions

```typescript
// Generic helpers
export function withExtension<T>(obj: T, ns: string, data: unknown): T;
export function getExtension<E>(obj: unknown, ns: string): E | undefined;
export function hasExtension(obj: unknown, ns: string): boolean;

// Typed helpers for each extension
export function withContrib(attr: Attribution, data: ContribExtension): Attribution;
export function getContrib(attr: Attribution): ContribExtension | undefined;
export function getContribBps(attr: Attribution): number;

export function withLicense(obj: Resource | Attribution, data: LicenseExtension): typeof obj;
export function getLicense(obj: Resource | Attribution): LicenseExtension | undefined;

export function withPayment(obj: Attribution | Action, data: PaymentExtension): typeof obj;
export function getPayment(obj: Attribution | Action): PaymentExtension | undefined;

// Distribution calculation
export function calculateDistribution(
  resourceRef: ContentReference,
  attributions: Attribution[]
): Distribution;

export function normalizeContributions(attributions: Attribution[]): Attribution[];
```

### 1.4 Extension Registry

```typescript
class ExtensionRegistry {
  register(definition: ExtensionDefinition): void;
  get(namespace: string): ExtensionDefinition | undefined;
  list(): ExtensionDefinition[];
  listFor(type: "entity" | "resource" | "action" | "attribution"): ExtensionDefinition[];
  validate(namespace: string, data: unknown): ValidationError[];
  validateAll(obj: { extensions?: Record<string, unknown> }): ValidationError[];
}
```

---

## Package 2: @provenancekit/payments

**Purpose:** Payment distribution based on provenance data. Supports multiple payment methods.

### 2.1 Directory Structure

```
packages/provenancekit-payments/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── calculator.ts           # Distribution calculation
│   ├── adapters/
│   │   ├── index.ts
│   │   ├── superfluid.ts       # Superfluid streaming
│   │   ├── x402.ts             # HTTP micropayments
│   │   ├── splits.ts           # 0xSplits integration
│   │   └── manual.ts           # Off-chain tracking
│   ├── middleware/
│   │   └── x402.ts             # Express/Connect middleware
│   └── utils/
│       ├── currency.ts
│       └── flowrate.ts
└── tests/
```

### 2.2 Core Types

```typescript
/**
 * Payment method adapter interface.
 */
export interface IPaymentAdapter {
  name: string;
  supportedChains: number[];

  /**
   * Initialize the adapter with configuration.
   */
  initialize(config: unknown): Promise<void>;

  /**
   * Create a payment/stream based on distribution.
   */
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;

  /**
   * Check payment status.
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;

  /**
   * Cancel/stop a payment (if applicable).
   */
  cancelPayment(paymentId: string): Promise<void>;
}

export interface CreatePaymentParams {
  /** Resource being paid for */
  resourceRef: ContentReference;

  /** Distribution of payments */
  distribution: Distribution;

  /** Total amount or flow rate */
  amount: bigint;

  /** Currency/token */
  currency: string;

  /** Payer address */
  payer: string;

  /** Optional: expiration time */
  expiresAt?: Date;

  /** Optional: metadata */
  metadata?: Record<string, unknown>;
}

export interface Distribution {
  entries: Array<{
    entityId: string;
    address: string;
    bps: number;  // Basis points (6000 = 60%)
  }>;
}
```

### 2.3 Superfluid Adapter

[Superfluid](https://superfluid.finance/) enables real-time token streaming - tokens flow continuously between addresses.

```typescript
// src/adapters/superfluid.ts
import { Framework } from "@superfluid-finance/sdk-core";

export interface SuperfluidConfig {
  rpcUrl: string;
  chainId: number;
  resolverAddress?: string;
}

export class SuperfluidAdapter implements IPaymentAdapter {
  name = "superfluid";
  supportedChains = [1, 137, 42161, 10, 8453, 100, 43114];  // Mainnet, Polygon, Arb, OP, Base, etc.

  private sf: Framework;
  private signer: Signer;

  async initialize(config: SuperfluidConfig): Promise<void> {
    this.sf = await Framework.create({
      chainId: config.chainId,
      provider: new JsonRpcProvider(config.rpcUrl),
    });
  }

  /**
   * Create streaming payments to all recipients.
   *
   * @example
   * // Stream $100/month to contributors based on distribution
   * await superfluid.createPayment({
   *   distribution: {
   *     entries: [
   *       { entityId: "alice", address: "0x...", bps: 6000 },
   *       { entityId: "bob", address: "0x...", bps: 4000 },
   *     ]
   *   },
   *   amount: parseUnits("100", 18),  // $100 total
   *   currency: "USDCx",
   *   payer: "0x...",
   * });
   *
   * // Creates:
   * // - Stream to Alice: $60/month
   * // - Stream to Bob: $40/month
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const superToken = await this.sf.loadSuperToken(params.currency);

    // Calculate flow rate per recipient
    const monthlyFlowRate = params.amount;
    const operations = params.distribution.entries.map(entry => {
      const recipientFlowRate = (monthlyFlowRate * BigInt(entry.bps)) / 10000n;

      return superToken.createFlow({
        sender: params.payer,
        receiver: entry.address,
        flowRate: this.toPerSecondFlowRate(recipientFlowRate),
      });
    });

    // Batch all stream creations
    const tx = await this.sf.batchCall(operations).exec(this.signer);
    await tx.wait();

    return {
      paymentId: tx.hash,
      method: "superfluid",
      status: "active",
      streams: params.distribution.entries.map(e => ({
        recipient: e.address,
        flowRate: ((monthlyFlowRate * BigInt(e.bps)) / 10000n).toString(),
      })),
    };
  }

  /**
   * Convert monthly amount to per-second flow rate.
   */
  private toPerSecondFlowRate(monthlyAmount: bigint): string {
    // Superfluid uses per-second rates
    // 1 month ≈ 2592000 seconds
    return (monthlyAmount / 2592000n).toString();
  }

  /**
   * Update flow rates when distribution changes.
   */
  async updateDistribution(
    paymentId: string,
    newDistribution: Distribution,
    totalFlowRate: bigint
  ): Promise<void> {
    // Get current streams
    // Delete streams to removed recipients
    // Update streams to existing recipients
    // Create streams to new recipients
  }

  /**
   * Stop all streams for a payment.
   */
  async cancelPayment(paymentId: string): Promise<void> {
    // Delete all streams associated with this payment
  }
}
```

**Superfluid Key Concepts:**

| Concept | Description |
|---------|-------------|
| Super Tokens | ERC-20 tokens wrapped for streaming (e.g., USDC → USDCx) |
| Flow Rate | Tokens per second continuously transferred |
| CFA | Constant Flow Agreement - the streaming primitive |
| IDA | Instant Distribution Agreement - one-to-many instant distributions |

**Supported Tokens (Super Tokens):**
- USDCx (Wrapped USDC)
- DAIx (Wrapped DAI)
- ETHx (Wrapped ETH)
- WETHx (Wrapped WETH)
- Custom wrapped tokens

### 2.4 x402 Adapter & Middleware

[x402](https://www.x402.org/) enables HTTP-native micropayments using the 402 Payment Required status code.

```typescript
// src/adapters/x402.ts
import { x402 } from "@coinbase/x402";

export interface X402Config {
  facilitatorUrl?: string;  // Payment facilitator
  currency: string;
  chainId: number;
}

export class X402Adapter implements IPaymentAdapter {
  name = "x402";
  supportedChains = [8453, 84532];  // Base, Base Sepolia (primary x402 chains)

  /**
   * x402 works differently - it's per-request micropayments.
   * This creates the payment "requirement" that gets enforced by middleware.
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    // x402 doesn't create payments upfront
    // It defines the price that will be charged per access
    return {
      paymentId: `x402:${params.resourceRef.ref}`,
      method: "x402",
      status: "configured",
      pricePerAccess: params.amount.toString(),
      distribution: params.distribution,
    };
  }
}

// src/middleware/x402.ts
import { paymentMiddleware } from "@coinbase/x402";

/**
 * Express middleware for x402 content gating.
 *
 * @example
 * import express from "express";
 * import { x402Middleware } from "@provenancekit/payments";
 *
 * const app = express();
 *
 * // Protect resource access with micropayments
 * app.get("/resource/:cid", x402Middleware({
 *   // Get price and distribution from provenance data
 *   getPricing: async (req) => {
 *     const resource = await storage.getResource(req.params.cid);
 *     return {
 *       price: "0.01",  // $0.01 per access
 *       currency: "USDC",
 *       distribution: await getDistributionForResource(resource),
 *     };
 *   },
 *   // Receive payment and distribute
 *   onPayment: async (payment, distribution) => {
 *     // Payment received! Distribute to contributors
 *     await distributePayment(payment, distribution);
 *   },
 * }), (req, res) => {
 *   // User paid - serve the content
 *   res.sendFile(getResourcePath(req.params.cid));
 * });
 */
export function x402Middleware(config: X402MiddlewareConfig): RequestHandler {
  return async (req, res, next) => {
    const pricing = await config.getPricing(req);

    // Check for x402 payment header
    const paymentHeader = req.headers["x-payment"];
    if (!paymentHeader) {
      // Return 402 with payment requirements
      return res.status(402).json({
        "x-payment-required": {
          price: pricing.price,
          currency: pricing.currency,
          recipient: pricing.distribution.entries[0].address,  // Primary recipient
          acceptedMethods: ["x402"],
          network: "base",
        },
      });
    }

    // Verify payment
    const payment = await verifyX402Payment(paymentHeader);
    if (!payment.valid) {
      return res.status(402).json({ error: "Invalid payment" });
    }

    // Distribute to contributors
    await config.onPayment(payment, pricing.distribution);

    // Continue to serve content
    next();
  };
}
```

**x402 Key Concepts:**

| Concept | Description |
|---------|-------------|
| 402 Status | HTTP status code for "Payment Required" |
| Payment Header | `x-payment` header containing payment proof |
| Facilitator | Service that processes payments |
| Stablecoins | USDC on Base is primary currency |

### 2.5 0xSplits Adapter

[0xSplits](https://splits.org/) creates immutable on-chain split contracts for one-time distributions.

```typescript
// src/adapters/splits.ts
import { SplitsClient } from "@0xsplits/splits-sdk";

export class SplitsAdapter implements IPaymentAdapter {
  name = "splits";
  supportedChains = [1, 137, 42161, 10, 8453];  // Most EVM chains

  private client: SplitsClient;

  /**
   * Create a split contract for the distribution.
   *
   * @example
   * const result = await splits.createPayment({
   *   distribution: {
   *     entries: [
   *       { address: "0xalice...", bps: 6000 },
   *       { address: "0xbob...", bps: 4000 },
   *     ]
   *   },
   *   payer: "0x...",
   * });
   *
   * // Split contract created at result.splitAddress
   * // Send funds there, then call distribute()
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    // Create the split contract
    const { splitAddress } = await this.client.createSplit({
      recipients: params.distribution.entries.map(e => ({
        address: e.address,
        percentAllocation: e.bps / 100,  // 0xSplits uses percentages
      })),
      distributorFeePercent: 0,  // No distributor fee
      controller: ethers.constants.AddressZero,  // Immutable
    });

    return {
      paymentId: splitAddress,
      method: "splits",
      status: "created",
      splitAddress,
    };
  }

  /**
   * Distribute accumulated funds in a split.
   */
  async distribute(splitAddress: string, token: string): Promise<void> {
    await this.client.distributeToken({
      splitAddress,
      token,
      distributorAddress: this.signer.address,
    });
  }
}
```

### 2.6 Distribution Calculator

```typescript
// src/calculator.ts

/**
 * Calculate payment distribution from provenance data.
 *
 * This traverses the provenance graph to determine how payments
 * should be split among all contributors.
 */
export class DistributionCalculator {
  constructor(
    private storage: IProvenanceStorage,
    private options?: CalculatorOptions
  ) {}

  /**
   * Calculate distribution for a single resource.
   *
   * @example
   * const distribution = await calculator.forResource("bafy...");
   * // {
   * //   resourceRef: { ref: "bafy...", scheme: "cid" },
   * //   entries: [
   * //     { entityId: "alice", address: "0x...", bps: 6000 },
   * //     { entityId: "bob", address: "0x...", bps: 4000 },
   * //   ],
   * //   totalBps: 10000
   * // }
   */
  async forResource(resourceRef: ContentReference): Promise<Distribution> {
    // 1. Get direct attributions
    const attributions = await this.storage.getAttributions({
      resourceRef: resourceRef.ref,
    });

    // 2. Extract contribution weights
    const entries = attributions.map(attr => ({
      entityId: attr.entityId,
      address: this.getPaymentAddress(attr),
      bps: getContribBps(attr),
    }));

    // 3. Normalize to 10000 bps
    return this.normalizeDistribution(resourceRef, entries);
  }

  /**
   * Calculate distribution through the full provenance graph.
   *
   * This follows the derivation chain: if Resource B was derived from
   * Resource A, contributors to A get a portion of B's revenue.
   *
   * @param maxDepth - How many levels of derivation to traverse
   * @param decayFactor - How much to reduce parent contributions (0.5 = 50%)
   */
  async forGraph(
    resourceRef: ContentReference,
    options?: {
      maxDepth?: number;
      decayFactor?: number;
    }
  ): Promise<Distribution> {
    const maxDepth = options?.maxDepth ?? 3;
    const decay = options?.decayFactor ?? 0.5;

    const allContributions = new Map<string, number>();

    // Recursive function to traverse graph
    const traverse = async (ref: ContentReference, depth: number, weight: number) => {
      if (depth > maxDepth || weight < 0.01) return;

      // Get attributions for this resource
      const attributions = await this.storage.getAttributions({ resourceRef: ref.ref });
      for (const attr of attributions) {
        const contrib = getContribBps(attr) * weight;
        const current = allContributions.get(attr.entityId) ?? 0;
        allContributions.set(attr.entityId, current + contrib);
      }

      // Get the action that created this resource
      const resource = await this.storage.getResource(ref.ref);
      if (!resource) return;

      const action = await this.storage.getAction(resource.rootAction);
      if (!action || action.inputs.length === 0) return;

      // Traverse to input resources (parents)
      for (const input of action.inputs) {
        await traverse(input, depth + 1, weight * decay);
      }
    };

    await traverse(resourceRef, 0, 1);

    // Convert to distribution entries
    const entries = Array.from(allContributions.entries()).map(([entityId, bps]) => ({
      entityId,
      address: "", // Will be filled in
      bps: Math.round(bps),
    }));

    return this.normalizeDistribution(resourceRef, entries);
  }

  private getPaymentAddress(attr: Attribution): string {
    const payment = getPayment(attr);
    return payment?.recipient.address ?? "";
  }

  private normalizeDistribution(
    resourceRef: ContentReference,
    entries: Array<{ entityId: string; address: string; bps: number }>
  ): Distribution {
    const total = entries.reduce((sum, e) => sum + e.bps, 0);
    if (total === 0) {
      return { resourceRef, entries: [], totalBps: 0 };
    }

    const normalized = entries.map(e => ({
      ...e,
      bps: Math.round((e.bps / total) * 10000),
    }));

    return { resourceRef, entries: normalized, totalBps: 10000 };
  }
}
```

---

## Package 3: @provenancekit/privacy

**Purpose:** Privacy-preserving provenance with encryption, access control, and TEE support.

### 3.1 Directory Structure

```
packages/provenancekit-privacy/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── encryption/
│   │   ├── index.ts
│   │   ├── symmetric.ts        # AES encryption
│   │   ├── asymmetric.ts       # RSA/ECIES encryption
│   │   └── hybrid.ts           # Hybrid encryption
│   ├── access-control/
│   │   ├── index.ts
│   │   ├── lit.ts              # Lit Protocol integration
│   │   └── conditions.ts       # Access condition builders
│   ├── selective-disclosure/
│   │   ├── index.ts
│   │   ├── schema.ts           # Disclosure schemas
│   │   └── redact.ts           # Redaction utilities
│   ├── zk/
│   │   ├── index.ts
│   │   ├── commitments.ts      # Commitment scheme helpers
│   │   └── proofs.ts           # ZK proof utilities
│   └── tee/
│       ├── index.ts
│       ├── marlin.ts           # Marlin Oyster integration
│       └── nitro.ts            # AWS Nitro integration
└── tests/
```

### 3.2 Encryption Modes

```typescript
// src/encryption/index.ts

/**
 * Encryption modes for provenance data.
 */
export enum EncryptionMode {
  /**
   * Public provenance, encrypted content.
   * Provenance graph is visible, but actual content is encrypted.
   */
  CONTENT_ONLY = "content-only",

  /**
   * Private provenance (commitment only).
   * Only a hash commitment is public. Full bundle is encrypted.
   */
  FULL_PRIVATE = "full-private",

  /**
   * Selective disclosure.
   * Some fields public, some encrypted.
   */
  SELECTIVE = "selective",
}

/**
 * Encryption provider interface.
 */
export interface IEncryptionProvider {
  /**
   * Encrypt data with a key.
   */
  encrypt(data: Uint8Array, key: Uint8Array): Promise<EncryptedData>;

  /**
   * Decrypt data with a key.
   */
  decrypt(encrypted: EncryptedData, key: Uint8Array): Promise<Uint8Array>;

  /**
   * Generate a random encryption key.
   */
  generateKey(): Promise<Uint8Array>;
}

/**
 * Encrypted data structure.
 */
export interface EncryptedData {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  algorithm: string;
  authTag?: Uint8Array;
}
```

### 3.3 Lit Protocol Access Control

[Lit Protocol](https://litprotocol.com/) provides decentralized access control and encryption.

```typescript
// src/access-control/lit.ts
import * as LitJsSdk from "@lit-protocol/lit-node-client";

/**
 * Lit Protocol integration for token-gated provenance.
 *
 * @example
 * // Token-gate provenance to NFT holders
 * const lit = new LitAccessControl();
 * await lit.initialize();
 *
 * // Encrypt bundle with access conditions
 * const encrypted = await lit.encryptBundle(bundle, {
 *   conditions: [
 *     {
 *       contractAddress: "0x...",  // NFT contract
 *       standardContractType: "ERC721",
 *       chain: "base",
 *       method: "balanceOf",
 *       parameters: [":userAddress"],
 *       returnValueTest: { comparator: ">", value: "0" },
 *     },
 *   ],
 * });
 *
 * // Decrypt (only works if user holds NFT)
 * const decrypted = await lit.decryptBundle(encrypted, { wallet });
 */
export class LitAccessControl {
  private client: LitJsSdk.LitNodeClient;

  async initialize(): Promise<void> {
    this.client = new LitJsSdk.LitNodeClient({
      litNetwork: "cayenne",  // or "habanero" for mainnet
    });
    await this.client.connect();
  }

  /**
   * Encrypt a provenance bundle with access conditions.
   */
  async encryptBundle(
    bundle: ProvenanceBundle,
    options: {
      conditions: AccessControlCondition[];
      chain?: string;
    }
  ): Promise<EncryptedBundle> {
    const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
      JSON.stringify(bundle),
      this.client
    );

    return {
      encryptedData: ciphertext,
      dataHash: dataToEncryptHash,
      accessControlConditions: options.conditions,
      chain: options.chain ?? "base",
    };
  }

  /**
   * Decrypt a bundle (requires meeting access conditions).
   */
  async decryptBundle(
    encrypted: EncryptedBundle,
    options: { wallet: Signer }
  ): Promise<ProvenanceBundle> {
    // Get auth signature
    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: encrypted.chain,
      wallet: options.wallet,
    });

    // Decrypt
    const decrypted = await LitJsSdk.decryptString(
      encrypted.encryptedData,
      encrypted.dataHash,
      authSig,
      encrypted.accessControlConditions,
      this.client
    );

    return JSON.parse(decrypted);
  }
}

/**
 * Access condition builder for common patterns.
 */
export const AccessConditions = {
  /**
   * Must hold specific NFT.
   */
  holdsNFT(contractAddress: string, chain: string): AccessControlCondition {
    return {
      contractAddress,
      standardContractType: "ERC721",
      chain,
      method: "balanceOf",
      parameters: [":userAddress"],
      returnValueTest: { comparator: ">", value: "0" },
    };
  },

  /**
   * Must hold specific token amount.
   */
  holdsTokenAmount(
    contractAddress: string,
    minAmount: string,
    chain: string
  ): AccessControlCondition {
    return {
      contractAddress,
      standardContractType: "ERC20",
      chain,
      method: "balanceOf",
      parameters: [":userAddress"],
      returnValueTest: { comparator: ">=", value: minAmount },
    };
  },

  /**
   * Must be specific address.
   */
  isAddress(address: string): AccessControlCondition {
    return {
      contractAddress: "",
      standardContractType: "",
      chain: "base",
      method: "",
      parameters: [":userAddress"],
      returnValueTest: { comparator: "=", value: address },
    };
  },

  /**
   * Combine conditions with AND/OR.
   */
  combine(
    conditions: AccessControlCondition[],
    operator: "and" | "or"
  ): AccessControlCondition[] {
    return conditions.flatMap((c, i) =>
      i === 0 ? [c] : [{ operator }, c]
    );
  },
};
```

### 3.4 Selective Disclosure

```typescript
// src/selective-disclosure/schema.ts

/**
 * Schema defining which fields are public/private.
 */
export interface DisclosureSchema {
  /** Fields that are always public */
  publicFields: string[];

  /** Fields that are always private */
  privateFields: string[];

  /** Field-level encryption keys (optional) */
  fieldKeys?: Record<string, Uint8Array>;
}

/**
 * Default disclosure schemas for common use cases.
 */
export const DisclosureSchemas = {
  /**
   * Only type and timestamp public.
   */
  minimal: {
    publicFields: ["type", "timestamp", "createdAt"],
    privateFields: ["performedBy", "createdBy", "entityId", "inputs", "outputs"],
  } as DisclosureSchema,

  /**
   * Everything except entity identities.
   */
  anonymized: {
    publicFields: ["type", "timestamp", "createdAt", "inputs", "outputs", "role"],
    privateFields: ["performedBy", "createdBy", "entityId", "name"],
  } as DisclosureSchema,

  /**
   * Public attributions, private actions.
   */
  attributionPublic: {
    publicFields: ["resourceRef", "entityId", "role"],
    privateFields: ["performedBy", "inputs", "outputs"],
  } as DisclosureSchema,
};

// src/selective-disclosure/redact.ts

/**
 * Redact an object according to disclosure schema.
 *
 * @example
 * const redacted = redact(action, DisclosureSchemas.anonymized);
 * // {
 * //   id: "action123",
 * //   type: "create",
 * //   performedBy: "[REDACTED]",  // Private field
 * //   timestamp: "2024-01-15T...",
 * //   inputs: [...],
 * //   outputs: [...],
 * // }
 */
export function redact<T extends object>(
  obj: T,
  schema: DisclosureSchema
): T {
  const result = { ...obj };

  for (const field of schema.privateFields) {
    if (field in result) {
      (result as any)[field] = "[REDACTED]";
    }
  }

  return result;
}

/**
 * Encrypt private fields in an object.
 */
export async function encryptPrivateFields<T extends object>(
  obj: T,
  schema: DisclosureSchema,
  encryptor: IEncryptionProvider,
  key: Uint8Array
): Promise<T & { _encrypted: Record<string, EncryptedData> }> {
  const result = { ...obj, _encrypted: {} as Record<string, EncryptedData> };

  for (const field of schema.privateFields) {
    if (field in result && (result as any)[field] !== undefined) {
      const value = JSON.stringify((result as any)[field]);
      const encrypted = await encryptor.encrypt(
        new TextEncoder().encode(value),
        key
      );
      (result._encrypted as any)[field] = encrypted;
      (result as any)[field] = "[ENCRYPTED]";
    }
  }

  return result;
}
```

### 3.5 ZK Commitment Helpers

The ProvenanceVerifiable contract already supports commitments. These helpers make it easy to use.

```typescript
// src/zk/commitments.ts

/**
 * Create a commitment (hash) for private data.
 *
 * @example
 * // Create commitment for private attribution data
 * const { commitment, salt } = createCommitment({
 *   entityId: "did:key:alice",
 *   role: "creator",
 *   weight: 6000,
 * });
 *
 * // Record on-chain with commitment only
 * await contract.recordActionWithCommitment(
 *   "create",
 *   inputs,
 *   outputs,
 *   commitment
 * );
 *
 * // Later, reveal the full data
 * await contract.revealCommitment(actionId, revealData, salt);
 */
export function createCommitment(data: unknown): {
  commitment: Uint8Array;
  salt: Uint8Array;
  revealData: Uint8Array;
} {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(32));

  // Serialize data
  const dataBytes = new TextEncoder().encode(JSON.stringify(data));

  // Create reveal data (salt + data)
  const revealData = new Uint8Array(salt.length + dataBytes.length);
  revealData.set(salt);
  revealData.set(dataBytes, salt.length);

  // Commitment = keccak256(salt + data)
  const commitment = keccak256(revealData);

  return { commitment, salt, revealData };
}

/**
 * Verify a commitment against revealed data.
 */
export function verifyCommitment(
  commitment: Uint8Array,
  revealData: Uint8Array
): boolean {
  const computedCommitment = keccak256(revealData);
  return commitment.every((b, i) => b === computedCommitment[i]);
}

/**
 * Extract original data from reveal data.
 */
export function extractFromReveal(revealData: Uint8Array): {
  salt: Uint8Array;
  data: unknown;
} {
  const salt = revealData.slice(0, 32);
  const dataBytes = revealData.slice(32);
  const data = JSON.parse(new TextDecoder().decode(dataBytes));
  return { salt, data };
}
```

### 3.6 TEE Integration

#### Marlin Oyster (Decentralized TEE Network)

```typescript
// src/tee/marlin.ts

/**
 * Marlin Oyster integration for decentralized TEE execution.
 *
 * @example
 * const marlin = new MarlinTEE();
 *
 * // Execute provenance computation in TEE
 * const result = await marlin.execute({
 *   code: "calculateDistribution",
 *   inputs: { resourceCid: "bafy..." },
 *   attestation: true,
 * });
 *
 * // Verify the computation was done correctly
 * const valid = await marlin.verifyAttestation(result.attestation);
 */
export class MarlinTEE {
  private config: MarlinConfig;

  constructor(config: MarlinConfig) {
    this.config = config;
  }

  /**
   * Execute code in a TEE enclave.
   */
  async execute<T>(params: {
    code: string;
    inputs: Record<string, unknown>;
    attestation?: boolean;
  }): Promise<TEEResult<T>> {
    // Deploy or use existing enclave
    const enclaveId = await this.getOrCreateEnclave(params.code);

    // Send inputs to enclave
    const response = await fetch(`${this.config.oysterUrl}/execute`, {
      method: "POST",
      body: JSON.stringify({
        enclaveId,
        inputs: params.inputs,
        attestation: params.attestation,
      }),
    });

    const result = await response.json();

    return {
      output: result.output as T,
      attestation: result.attestation,
      enclaveId,
    };
  }

  /**
   * Verify TEE attestation.
   */
  async verifyAttestation(attestation: TEEAttestation): Promise<boolean> {
    // Verify the attestation signature
    // Check the enclave measurement matches expected code
    // Verify the timestamp is recent
    return this.verifyMarlinAttestation(attestation);
  }
}
```

---

## Package 4: @provenancekit/git

**Purpose:** Git integration for tracking code contributions including AI assistance.

### 4.1 Directory Structure

```
packages/provenancekit-git/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── post-commit.ts
│   │   ├── prepare-commit-msg.ts
│   │   └── installer.ts
│   ├── attribution/
│   │   ├── index.ts
│   │   ├── blame.ts           # Git blame analysis
│   │   ├── ai-detection.ts    # Detect AI-generated code
│   │   └── contributors.ts    # Contributor extraction
│   ├── tracking/
│   │   ├── index.ts
│   │   ├── session.ts         # Track coding sessions
│   │   └── prompts.ts         # Track AI prompts (opt-in)
│   └── integration/
│       ├── index.ts
│       ├── github.ts          # GitHub integration
│       └── vscode.ts          # VSCode extension hooks
└── cli/
    └── pk-git.ts              # CLI entry point
```

### 4.2 Core Features

```typescript
// src/hooks/post-commit.ts

/**
 * Post-commit hook that records provenance for each commit.
 *
 * Records:
 * - Who committed (human entity)
 * - What files changed (resources)
 * - AI assistance used (AI entities)
 * - Contribution weights (from git blame)
 */
export async function postCommitHook(options: {
  storage: IProvenanceStorage;
  config: GitProvenanceConfig;
}): Promise<void> {
  const { storage, config } = options;

  // Get commit info
  const commit = await getLastCommit();
  const files = await getChangedFiles(commit.hash);
  const author = await getCommitAuthor(commit.hash);

  // Detect AI assistance
  const aiAssistance = config.trackAI
    ? await detectAIAssistance(commit, files)
    : [];

  // Create entities
  const humanEntity: Entity = {
    id: `git:${author.email}`,
    name: author.name,
    role: "human",
  };

  await storage.upsertEntity(humanEntity);

  for (const ai of aiAssistance) {
    await storage.upsertEntity({
      id: `ai:${ai.tool}`,
      name: ai.tool,
      role: "ai",
      extensions: {
        "ext:ai@1.0.0": {
          provider: ai.provider,
          model: ai.model,
        },
      },
    });
  }

  // Create action
  const action: Action = {
    id: `git:${commit.hash}`,
    type: "transform",
    performedBy: humanEntity.id,
    timestamp: commit.timestamp,
    inputs: files.filter(f => f.status === "modified").map(f => ({
      ref: f.previousHash,
      scheme: "hash",
    })),
    outputs: files.map(f => ({
      ref: f.currentHash,
      scheme: "hash",
    })),
    proof: commit.hash,
    extensions: {
      "ext:git@1.0.0": {
        repository: await getRepoUrl(),
        branch: await getCurrentBranch(),
        message: commit.message,
        filesChanged: files.length,
      },
    },
  };

  await storage.upsertAction(action);

  // Create attributions with contribution weights
  const blame = await analyzeBlame(files);

  // Human attribution
  await storage.upsertAttribution({
    actionId: action.id,
    entityId: humanEntity.id,
    role: "creator",
    extensions: {
      "ext:contrib@1.0.0": {
        weight: blame.humanContribution,
        basis: "points",
        source: "calculated",
      },
    },
  });

  // AI attributions
  for (const ai of aiAssistance) {
    await storage.upsertAttribution({
      actionId: action.id,
      entityId: `ai:${ai.tool}`,
      role: "contributor",
      extensions: {
        "ext:contrib@1.0.0": {
          weight: ai.estimatedContribution,
          basis: "points",
          source: "calculated",
        },
      },
    });
  }
}

// src/attribution/ai-detection.ts

/**
 * Detect AI assistance in code changes.
 *
 * Detection methods:
 * 1. Co-author trailer in commit message
 * 2. IDE telemetry (if available)
 * 3. Pattern analysis (code style, comments)
 * 4. Session tracking (opt-in)
 */
export async function detectAIAssistance(
  commit: CommitInfo,
  files: FileChange[]
): Promise<AIAssistance[]> {
  const assistance: AIAssistance[] = [];

  // Check for Co-Authored-By trailers
  const coAuthors = parseCoAuthors(commit.message);
  for (const author of coAuthors) {
    if (isAICoAuthor(author)) {
      assistance.push({
        tool: author.name,
        provider: inferProvider(author.name),
        model: inferModel(author.name),
        estimatedContribution: 2000,  // 20% default
        confidence: "high",
        source: "commit-trailer",
      });
    }
  }

  // Check IDE session data (if tracking enabled)
  const sessionData = await getSessionData(commit.timestamp);
  if (sessionData) {
    for (const tool of sessionData.aiToolsUsed) {
      if (!assistance.find(a => a.tool === tool.name)) {
        assistance.push({
          tool: tool.name,
          provider: tool.provider,
          model: tool.model,
          estimatedContribution: tool.linesGenerated / sessionData.totalLines * 10000,
          confidence: "high",
          source: "session-tracking",
        });
      }
    }
  }

  return assistance;
}

/**
 * Known AI co-author patterns.
 */
const AI_COAUTHOR_PATTERNS = [
  /github.copilot/i,
  /copilot/i,
  /cursor/i,
  /claude/i,
  /anthropic/i,
  /openai/i,
  /gpt/i,
  /codewhisperer/i,
  /tabnine/i,
];
```

### 4.3 CLI Usage

```bash
# Install hooks in current repository
npx pk-git install

# Options
npx pk-git install --track-ai        # Enable AI detection
npx pk-git install --track-prompts   # Track AI prompts (opt-in)
npx pk-git install --storage postgres # Configure storage

# View provenance for a file
npx pk-git provenance src/index.ts

# View contributors
npx pk-git contributors --since="2024-01-01"

# Export provenance bundle
npx pk-git export --output=provenance.json
```

---

## Package 5: @provenancekit/media

**Purpose:** Media provenance with C2PA compatibility and metadata extraction.

### 5.1 Directory Structure

```
packages/provenancekit-media/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── c2pa/
│   │   ├── index.ts
│   │   ├── extract.ts          # Extract C2PA from files
│   │   ├── embed.ts            # Embed provenance in files
│   │   └── convert.ts          # C2PA ↔ EAA conversion
│   ├── metadata/
│   │   ├── index.ts
│   │   ├── exif.ts             # EXIF extraction
│   │   ├── xmp.ts              # XMP extraction
│   │   └── iptc.ts             # IPTC extraction
│   └── formats/
│       ├── index.ts
│       ├── image.ts            # Image handling
│       ├── video.ts            # Video handling
│       └── audio.ts            # Audio handling
└── tests/
```

### 5.2 C2PA Integration

[C2PA](https://c2pa.org/) (Coalition for Content Provenance and Authenticity) is an industry standard for media provenance.

```typescript
// src/c2pa/convert.ts

/**
 * Convert C2PA manifest to EAA ProvenanceBundle.
 *
 * @example
 * const c2pa = await extractC2PA(imageBuffer);
 * const bundle = c2paToBundle(c2pa);
 */
export function c2paToBundle(manifest: C2PAManifest): ProvenanceBundle {
  const bundle: ProvenanceBundle = {
    context: CONTEXT_URI,
    entities: [],
    resources: [],
    actions: [],
    attributions: [],
  };

  // Convert C2PA claim to EAA Action
  for (const claim of manifest.claims) {
    // Extract signer as entity
    const signerEntity: Entity = {
      id: `c2pa:${claim.signature.issuer}`,
      name: claim.signature.issuer,
      role: claim.claimGenerator.includes("AI") ? "ai" : "human",
    };
    bundle.entities.push(signerEntity);

    // Create action from claim
    const action: Action = {
      id: `c2pa:${claim.claimId}`,
      type: mapC2PAActionToEAA(claim.actions[0]?.action),
      performedBy: signerEntity.id,
      timestamp: claim.signature.time,
      inputs: claim.ingredients.map(i => ({
        ref: i.hash,
        scheme: "hash",
        integrity: i.hash,
      })),
      outputs: [{
        ref: manifest.assetHash,
        scheme: "hash",
      }],
      extensions: {
        "ext:c2pa@1.0.0": {
          claimId: claim.claimId,
          claimGenerator: claim.claimGenerator,
          signature: claim.signature,
        },
      },
    };
    bundle.actions.push(action);

    // Create attribution
    bundle.attributions.push({
      actionId: action.id,
      entityId: signerEntity.id,
      role: "creator",
    });
  }

  return bundle;
}

/**
 * Convert EAA ProvenanceBundle to C2PA manifest for embedding.
 */
export function bundleToC2PA(
  bundle: ProvenanceBundle,
  options: {
    privateKey: CryptoKey;
    certificate: string;
  }
): C2PAManifest {
  // Convert EAA actions to C2PA claims
  // Sign with provided credentials
  // Return embeddable manifest
}

// src/c2pa/embed.ts

/**
 * Embed provenance in a media file.
 *
 * @example
 * import { embedProvenance } from "@provenancekit/media";
 *
 * const signedImage = await embedProvenance(imageBuffer, bundle, {
 *   format: "c2pa",
 *   privateKey: myKey,
 *   certificate: myCert,
 * });
 *
 * // signedImage now contains embedded provenance
 * fs.writeFileSync("signed-image.jpg", signedImage);
 */
export async function embedProvenance(
  content: Buffer,
  bundle: ProvenanceBundle,
  options: EmbedOptions
): Promise<Buffer> {
  const manifest = bundleToC2PA(bundle, {
    privateKey: options.privateKey,
    certificate: options.certificate,
  });

  // Use c2pa-node or similar library to embed
  const signed = await c2paEmbed(content, manifest);

  return signed;
}
```

---

## Package 6: @provenancekit/sdk (Enhanced)

**Purpose:** Unified SDK with blockchain recording, all extensions, and high-level APIs.

### 6.1 Enhanced SDK Interface

```typescript
// packages/provenancekit-sdk/src/index.ts

export interface ProvenanceKitConfig {
  // Required
  storage: IProvenanceStorage;

  // Optional - blockchain
  chain?: {
    rpcUrl: string;
    contractAddress: `0x${string}`;
    chainId: number;
    signer?: Signer;
  };

  // Optional - file storage
  files?: IFileStorage;

  // Optional - payments
  payments?: {
    method: "superfluid" | "x402" | "splits";
    config: unknown;
  };

  // Optional - privacy
  privacy?: {
    encryption?: IEncryptionProvider;
    accessControl?: LitAccessControl;
    disclosureSchema?: DisclosureSchema;
  };
}

export class ProvenanceKit {
  private storage: IProvenanceStorage;
  private chain?: ChainProvider;
  private files?: IFileStorage;
  private payments?: IPaymentAdapter;
  private privacy?: PrivacyProvider;

  constructor(config: ProvenanceKitConfig) {
    this.storage = config.storage;
    if (config.chain) {
      this.chain = new ChainProvider(config.chain);
    }
    // ... initialize other providers
  }

  /**
   * Record a creation action.
   *
   * @example
   * const result = await pk.create({
   *   performer: "did:key:alice",
   *   content: imageBuffer,
   *   contentType: "image/png",
   *   license: { type: "CC-BY-4.0" },
   * });
   *
   * console.log(result.resource.address); // { ref: "bafy...", scheme: "cid" }
   * console.log(result.action.id);        // "0x..."
   * console.log(result.onchain?.txHash);  // "0x..." (if chain configured)
   */
  async create(params: CreateParams): Promise<CreateResult> {
    // 1. Upload content to file storage
    const fileResult = await this.files?.upload(params.content);
    const contentRef = fileResult
      ? { ref: fileResult.ref.ref, scheme: "cid" as const }
      : params.contentRef!;

    // 2. Create resource
    const resource: Resource = {
      address: contentRef,
      type: params.contentType,
      createdAt: new Date().toISOString(),
      createdBy: params.performer,
      rootAction: "",  // Will be filled in
      extensions: {},
    };

    // Add license extension if provided
    if (params.license) {
      resource.extensions = {
        ...resource.extensions,
        "ext:license@1.0.0": params.license,
      };
    }

    // 3. Create action
    const action: Action = {
      id: generateActionId(),
      type: "create",
      performedBy: params.performer,
      timestamp: new Date().toISOString(),
      inputs: [],
      outputs: [contentRef],
    };

    resource.rootAction = action.id;

    // 4. Create attribution
    const attribution: Attribution = {
      resourceRef: contentRef,
      entityId: params.performer,
      role: "creator",
      extensions: params.contribution
        ? { "ext:contrib@1.0.0": params.contribution }
        : {},
    };

    // 5. Record on-chain if configured
    let onchainResult;
    if (this.chain) {
      onchainResult = await this.chain.recordAction(action);
      action.proof = onchainResult.txHash;
      action.extensions = {
        ...action.extensions,
        "ext:onchain@1.0.0": {
          chainId: this.chain.chainId,
          transactionHash: onchainResult.txHash,
          blockNumber: onchainResult.blockNumber,
        },
      };
    }

    // 6. Store in database
    await this.storage.upsertResource(resource);
    await this.storage.upsertAction(action);
    await this.storage.upsertAttribution(attribution);

    return {
      resource,
      action,
      attribution,
      onchain: onchainResult,
    };
  }

  /**
   * Record a transformation action (derive from existing content).
   */
  async transform(params: TransformParams): Promise<TransformResult> {
    // Similar to create but with inputs
  }

  /**
   * Get full provenance lineage for a resource.
   */
  async getLineage(ref: string | ContentReference): Promise<LineageResult> {
    const contentRef = typeof ref === "string"
      ? { ref, scheme: "cid" as const }
      : ref;

    const resource = await this.storage.getResource(contentRef.ref);
    if (!resource) throw new Error("Resource not found");

    // Get all actions in the derivation chain
    const actions = await this.traverseLineage(resource);

    // Get all attributions
    const attributions = await this.storage.getAttributions({
      resourceRef: contentRef.ref,
    });

    return {
      resource,
      actions,
      attributions,
      graph: this.buildGraph(resource, actions, attributions),
    };
  }

  /**
   * Verify provenance on-chain.
   */
  async verify(actionId: string): Promise<VerifyResult> {
    if (!this.chain) {
      throw new Error("Chain not configured");
    }

    return this.chain.verifyAction(actionId);
  }

  /**
   * Calculate payment distribution.
   */
  async getDistribution(ref: string | ContentReference): Promise<Distribution> {
    const calculator = new DistributionCalculator(this.storage);
    const contentRef = typeof ref === "string"
      ? { ref, scheme: "cid" as const }
      : ref;
    return calculator.forResource(contentRef);
  }

  /**
   * Create payment stream/split for a resource.
   */
  async createPayment(params: PaymentParams): Promise<PaymentResult> {
    if (!this.payments) {
      throw new Error("Payments not configured");
    }

    const distribution = await this.getDistribution(params.resourceRef);
    return this.payments.createPayment({
      resourceRef: params.resourceRef,
      distribution,
      amount: params.amount,
      currency: params.currency,
      payer: params.payer,
    });
  }
}
```

---

# PART 2: PLATFORM LAYER

## Package 7: @provenancekit/api

**Purpose:** Backend API service for the provenance platform.

### 7.1 Directory Structure

```
packages/provenancekit-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── server.ts               # Express/Fastify server
│   ├── routes/
│   │   ├── index.ts
│   │   ├── resources.ts        # /api/resources
│   │   ├── actions.ts          # /api/actions
│   │   ├── entities.ts         # /api/entities
│   │   ├── attributions.ts     # /api/attributions
│   │   ├── bundles.ts          # /api/bundles
│   │   └── payments.ts         # /api/payments
│   ├── middleware/
│   │   ├── auth.ts             # Authentication
│   │   ├── rateLimit.ts        # Rate limiting
│   │   └── x402.ts             # Payment middleware
│   ├── services/
│   │   ├── provenance.ts       # Provenance service
│   │   ├── indexer.ts          # Indexer service
│   │   └── payments.ts         # Payment service
│   └── graphql/                # Optional GraphQL
│       ├── schema.ts
│       └── resolvers.ts
└── tests/
```

### 7.2 API Endpoints

```typescript
// REST API Specification

/**
 * Resources
 */
POST   /api/resources           // Create resource
GET    /api/resources/:ref      // Get resource by CID
GET    /api/resources           // List resources (paginated)
GET    /api/resources/:ref/lineage    // Get full lineage
GET    /api/resources/:ref/attributions  // Get attributions

/**
 * Actions
 */
POST   /api/actions             // Record action
GET    /api/actions/:id         // Get action by ID
GET    /api/actions             // List actions (paginated)
POST   /api/actions/:id/verify  // Verify on-chain

/**
 * Entities
 */
POST   /api/entities            // Create/update entity
GET    /api/entities/:id        // Get entity by ID
GET    /api/entities            // List entities

/**
 * Attributions
 */
POST   /api/attributions        // Create attribution
GET    /api/attributions        // List attributions (filtered)

/**
 * Bundles
 */
POST   /api/bundles             // Create complete bundle
GET    /api/bundles/:id         // Get bundle
GET    /api/bundles/:id/export  // Export as JSON-LD

/**
 * Payments
 */
GET    /api/resources/:ref/distribution  // Get payment distribution
POST   /api/payments/stream     // Create Superfluid stream
POST   /api/payments/split      // Create 0xSplits
GET    /api/payments/:id        // Get payment status
```

### 7.3 Authentication

```typescript
// src/middleware/auth.ts

/**
 * Authentication methods supported:
 * 1. API Key - for server-to-server
 * 2. JWT - for user sessions
 * 3. Wallet signature - for Web3 apps
 */

export interface AuthConfig {
  apiKeys: {
    enabled: boolean;
    prefix: string;  // "pk_live_" or "pk_test_"
  };
  jwt: {
    enabled: boolean;
    secret: string;
    expiresIn: string;
  };
  wallet: {
    enabled: boolean;
    message: string;  // SIWE message template
  };
}

export function authMiddleware(config: AuthConfig): RequestHandler {
  return async (req, res, next) => {
    // Check API key header
    const apiKey = req.headers["x-api-key"];
    if (apiKey && config.apiKeys.enabled) {
      const valid = await validateApiKey(apiKey as string);
      if (valid) {
        req.auth = { type: "api-key", ...valid };
        return next();
      }
    }

    // Check JWT
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ") && config.jwt.enabled) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, config.jwt.secret);
        req.auth = { type: "jwt", ...payload };
        return next();
      } catch (e) {
        // Invalid JWT
      }
    }

    // Check wallet signature
    const walletSig = req.headers["x-wallet-signature"];
    if (walletSig && config.wallet.enabled) {
      const valid = await validateWalletSignature(walletSig as string, req);
      if (valid) {
        req.auth = { type: "wallet", ...valid };
        return next();
      }
    }

    res.status(401).json({ error: "Unauthorized" });
  };
}
```

---

## Package 8: @provenancekit/app

**Purpose:** Frontend application for end users.

### 8.1 Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** TanStack Query + Zustand
- **Web3:** wagmi + viem
- **Visualization:** D3.js / React Flow

### 8.2 Directory Structure

```
packages/provenancekit-app/
├── package.json
├── next.config.js
├── tailwind.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Landing/dashboard
│   │   ├── resources/
│   │   │   ├── page.tsx          # Resource list
│   │   │   └── [cid]/
│   │   │       ├── page.tsx      # Resource detail
│   │   │       └── lineage/
│   │   │           └── page.tsx  # Lineage visualization
│   │   ├── create/
│   │   │   └── page.tsx          # Create resource
│   │   ├── payments/
│   │   │   ├── page.tsx          # Payment dashboard
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Payment detail
│   │   ├── settings/
│   │   │   └── page.tsx          # User settings
│   │   └── api/                  # API routes (if needed)
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── provenance/
│   │   │   ├── ResourceCard.tsx
│   │   │   ├── LineageGraph.tsx
│   │   │   ├── AttributionList.tsx
│   │   │   └── ActionTimeline.tsx
│   │   ├── payments/
│   │   │   ├── DistributionChart.tsx
│   │   │   ├── StreamStatus.tsx
│   │   │   └── PaymentHistory.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── hooks/
│   │   ├── useProvenance.ts
│   │   ├── usePayments.ts
│   │   └── useWallet.ts
│   ├── lib/
│   │   ├── api.ts                # API client
│   │   ├── provenance.ts         # ProvenanceKit SDK instance
│   │   └── wagmi.ts              # Wallet config
│   └── styles/
│       └── globals.css
└── public/
```

### 8.3 Key Features

#### Provenance Graph Visualization

```typescript
// src/components/provenance/LineageGraph.tsx
import ReactFlow, { Background, Controls } from "reactflow";

export function LineageGraph({ lineage }: { lineage: LineageResult }) {
  const nodes = useMemo(() => {
    return [
      // Resource node (center)
      {
        id: lineage.resource.address.ref,
        type: "resource",
        position: { x: 400, y: 200 },
        data: lineage.resource,
      },
      // Action nodes
      ...lineage.actions.map((action, i) => ({
        id: action.id,
        type: "action",
        position: { x: 200, y: 100 + i * 100 },
        data: action,
      })),
      // Entity nodes
      ...lineage.attributions.map((attr, i) => ({
        id: attr.entityId,
        type: "entity",
        position: { x: 600, y: 100 + i * 100 },
        data: attr,
      })),
    ];
  }, [lineage]);

  const edges = useMemo(() => {
    // Connect actions to resources
    // Connect entities to actions via attributions
  }, [lineage]);

  return (
    <div className="h-[600px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

#### Payment Dashboard

```typescript
// src/app/payments/page.tsx

export default function PaymentsPage() {
  const { data: streams } = useQuery({
    queryKey: ["streams"],
    queryFn: () => api.getMyStreams(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Revenue Dashboard</h1>

      {/* Total earnings */}
      <Card>
        <CardHeader>
          <CardTitle>Total Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            ${totalEarnings.toFixed(2)}
          </div>
          <p className="text-muted-foreground">
            Across {streams?.length ?? 0} active streams
          </p>
        </CardContent>
      </Card>

      {/* Active streams */}
      <Card>
        <CardHeader>
          <CardTitle>Active Streams</CardTitle>
        </CardHeader>
        <CardContent>
          {streams?.map(stream => (
            <StreamStatus key={stream.id} stream={stream} />
          ))}
        </CardContent>
      </Card>

      {/* Distribution breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Contribution Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DistributionChart data={distributionData} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

# PART 3: IMPLEMENTATION TIMELINE

## Phase 1: Extension Foundations (2 weeks)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Set up `@provenancekit/extensions` package | Package structure, build config |
| 1 | Implement core schemas (contrib, license, payment) | Zod schemas with tests |
| 1 | Implement helper functions | with/get/has helpers |
| 2 | Implement Extension Registry | Registry class, auto-registration |
| 2 | Implement distribution calculator | Basic distribution from attributions |
| 2 | Write tests and documentation | 90%+ coverage, JSDoc, README |

**Exit Criteria:**
- All 6 extension schemas defined and tested
- Helper functions for all extensions
- Distribution calculator working
- Package published to npm

## Phase 2: Payment Infrastructure (2 weeks)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 3 | Set up `@provenancekit/payments` package | Package structure |
| 3 | Implement Superfluid adapter | Stream creation, management |
| 3 | Implement x402 adapter + middleware | Per-access payments |
| 4 | Implement 0xSplits adapter | Split creation, distribution |
| 4 | Integrate distribution calculator | End-to-end payment flow |
| 4 | Write tests | Integration tests with testnets |

**Exit Criteria:**
- All three payment methods working on testnet
- x402 middleware tested with sample app
- Distribution → payment flow complete

## Phase 3: Privacy & Security (2 weeks)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 5 | Set up `@provenancekit/privacy` package | Package structure |
| 5 | Implement encryption utilities | AES, hybrid encryption |
| 5 | Implement selective disclosure | Schema, redaction |
| 6 | Integrate Lit Protocol | Access control, token-gating |
| 6 | Implement ZK commitment helpers | Create/verify commitments |
| 6 | TEE integration (basic) | Marlin Oyster prototype |

**Exit Criteria:**
- Encryption/decryption working
- Lit Protocol token-gating working
- Commitment scheme tested with contracts

## Phase 4: Domain Packages (2 weeks)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 7 | Set up `@provenancekit/git` | Package structure |
| 7 | Implement git hooks | post-commit, install CLI |
| 7 | Implement AI detection | Co-author parsing, heuristics |
| 8 | Set up `@provenancekit/media` | Package structure |
| 8 | Implement C2PA extraction | Read manifests from images |
| 8 | Implement C2PA embedding | Write provenance to images |

**Exit Criteria:**
- Git hooks installable and working
- AI assistance detected from commits
- C2PA round-trip (extract → convert → embed)

## Phase 5: SDK Enhancement (1 week)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 9 | Enhance SDK with chain recording | Write to chain |
| 9 | Integrate all extensions | Unified API |
| 9 | Add payment methods to SDK | create/transform with payments |

**Exit Criteria:**
- SDK can record to chain
- SDK uses all extensions seamlessly
- Full end-to-end flow working

## Phase 6: Platform MVP (3 weeks)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 10 | Set up API server | Express/Fastify setup |
| 10 | Implement core routes | CRUD for all entities |
| 10 | Implement auth | API keys, JWT |
| 11 | Set up Next.js app | Project structure |
| 11 | Implement dashboard | Resource list, detail pages |
| 11 | Implement lineage visualization | React Flow graph |
| 12 | Implement payment dashboard | Streams, distributions |
| 12 | Polish and testing | UI refinement, E2E tests |

**Exit Criteria:**
- API serving all endpoints
- Frontend shows resources, lineage
- Payment dashboard functional

## Phase 7: Production Readiness (2 weeks)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 13 | Deploy contracts to mainnet | Verified deployments |
| 13 | Set up infrastructure | Database, indexer, API hosting |
| 13 | Security audit | Review critical paths |
| 14 | Documentation site | Docs, guides, examples |
| 14 | Example applications | 2-3 example apps |
| 14 | Launch preparation | Monitoring, alerting |

**Exit Criteria:**
- Mainnet deployments live
- Documentation complete
- Examples published
- Production monitoring in place

---

# PART 4: DEPENDENCIES & TECHNOLOGIES

## NPM Dependencies

```json
{
  "@provenancekit/extensions": {
    "zod": "^3.22.0",
    "@arttribute/eaa-types": "workspace:*"
  },
  "@provenancekit/payments": {
    "@superfluid-finance/sdk-core": "^0.6.0",
    "@0xsplits/splits-sdk": "^2.0.0",
    "@coinbase/x402": "^0.1.0",
    "ethers": "^6.0.0",
    "@provenancekit/extensions": "workspace:*"
  },
  "@provenancekit/privacy": {
    "@lit-protocol/lit-node-client": "^3.0.0",
    "@noble/ciphers": "^0.4.0",
    "@provenancekit/extensions": "workspace:*"
  },
  "@provenancekit/git": {
    "simple-git": "^3.20.0",
    "@provenancekit/sdk": "workspace:*"
  },
  "@provenancekit/media": {
    "c2pa-node": "^0.4.0",
    "exif-parser": "^0.1.0",
    "@provenancekit/sdk": "workspace:*"
  },
  "@provenancekit/api": {
    "fastify": "^4.24.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/rate-limit": "^8.0.0",
    "jose": "^5.1.0",
    "@provenancekit/sdk": "workspace:*",
    "@provenancekit/payments": "workspace:*"
  },
  "@provenancekit/app": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "tailwindcss": "^3.3.0",
    "@tanstack/react-query": "^5.0.0",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "reactflow": "^11.10.0",
    "@provenancekit/sdk": "workspace:*"
  }
}
```

## External Services

| Service | Purpose | Required |
|---------|---------|----------|
| RPC Provider (Alchemy/Infura) | Blockchain access | Yes (for chain features) |
| Pinata / web3.storage | IPFS pinning | Yes (for file storage) |
| PostgreSQL | Database | Yes |
| Superfluid Dashboard | Stream management | No (optional) |
| Lit Protocol Network | Access control | No (optional) |
| Marlin Network | TEE execution | No (optional) |

---

# PART 5: SUCCESS METRICS

## Technical Metrics

- **Test Coverage:** >85% for all packages
- **Build Time:** <30s for full monorepo
- **Bundle Size:** <100KB for browser SDK
- **API Latency:** <100ms p95 for reads, <500ms for writes

## Adoption Metrics

- **NPM Downloads:** Track weekly downloads
- **GitHub Stars:** Community interest
- **Active Projects:** Projects using ProvenanceKit
- **API Requests:** Monthly API call volume

## Business Metrics

- **Total Value Locked:** If applicable
- **Revenue Distributed:** Through payment rails
- **Provenance Records:** Total records created

---

# APPENDIX: Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Superfluid API changes | Abstract behind adapter interface |
| x402 not widely adopted | Support multiple payment methods |
| Lit Protocol downtime | Fallback to basic encryption |
| C2PA spec changes | Separate conversion layer |
| Gas costs on mainnet | Default to L2 (Base) |
| Storage costs | Support multiple providers |

---

*This plan is a living document and will be updated as implementation progresses.*
