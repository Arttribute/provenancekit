# @provenancekit/payments - Design Document

## Overview

The payments package provides adapters for distributing payments based on provenance attribution data. It integrates with `@provenancekit/extensions` (Distribution) to convert contribution weights into actual payments.

## Design Principles

1. **Adapters are optional** - Each adapter has its SDK as a peer dependency
2. **Strongly recommended** - Clear documentation on which adapter to use when
3. **Composable** - Adapters can be swapped without changing application logic
4. **Type-safe** - Full TypeScript support with viem types

## Package Structure

```
packages/provenancekit-payments/
├── src/
│   ├── index.ts              # Public exports
│   ├── types.ts              # Core interfaces
│   ├── utils.ts              # Shared utilities
│   └── adapters/
│       ├── index.ts          # Adapter exports
│       ├── direct.ts         # Direct ETH/ERC-20 transfers
│       ├── splits.ts         # 0xSplits integration
│       ├── superfluid.ts     # Superfluid streaming
│       └── x402.ts           # HTTP micropayments (future)
├── package.json
├── tsconfig.json
└── DESIGN.md
```

## Core Interfaces

### IPaymentAdapter

The minimal interface all adapters implement:

```typescript
/**
 * Payment adapter interface.
 *
 * All adapters must implement this interface to be compatible with
 * ProvenanceKit's payment distribution system.
 */
export interface IPaymentAdapter {
  /** Adapter identifier */
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
   * Some adapters only support specific tokens (e.g., SuperTokens).
   */
  supportsToken?(token: Address, chainId: number): Promise<boolean>;
}

export type PaymentModel =
  | "one-time"      // Direct: single transfer per recipient
  | "streaming"     // Superfluid: continuous flow
  | "split-contract"; // 0xSplits: funds sent to split contract
```

### DistributeParams

```typescript
export interface DistributeParams {
  /**
   * Distribution from @provenancekit/extensions.
   * Contains recipient addresses and their share in basis points.
   */
  distribution: Distribution;

  /**
   * Total amount to distribute.
   * For streaming: this is the total amount over the stream duration.
   */
  amount: bigint;

  /**
   * Token address.
   * Use zeroAddress (0x0...0) for native ETH.
   * For Superfluid: must be a SuperToken address.
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
  /** Superfluid: stream duration in seconds */
  streamDuration?: number;

  /** 0xSplits: whether to create immutable split */
  immutable?: boolean;

  /** Gas limit override */
  gasLimit?: bigint;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}
```

### PaymentResult

```typescript
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

  /** Total amount distributed */
  totalDistributed: bigint;

  /** Dust amount (if any) */
  dust: bigint;

  /** Adapter-specific data */
  data?: Record<string, unknown>;
}

export interface PaymentEntry {
  /** Recipient address */
  recipient: Address;

  /** Amount sent */
  amount: bigint;

  /** Whether this payment succeeded */
  success: boolean;

  /** Transaction hash for this payment */
  txHash?: string;

  /** Error message if failed */
  error?: string;
}
```

## Adapter Implementations

### 1. DirectTransferAdapter (Baseline)

**Purpose**: Simple one-time ETH/ERC-20 transfers.

**Use when**:
- One-time payments (bounties, tips, purchases)
- Full control over when payments happen
- Maximum compatibility (any EVM chain)

**Implementation**:
```typescript
export class DirectTransferAdapter implements IPaymentAdapter {
  readonly name = "direct";
  readonly description = "Direct ETH/ERC-20 transfers";
  readonly supportedChains = [...]; // All EVM chains
  readonly model = "one-time" as const;

  async distribute(params: DistributeParams): Promise<PaymentResult> {
    const { shares, dust } = splitAmount(params.amount, params.distribution);

    const payments: PaymentEntry[] = [];
    const txHashes: string[] = [];

    // For native ETH: use multicall if available, otherwise sequential
    // For ERC-20: batch approve + transferFrom, or sequential transfer

    for (const [recipient, amount] of shares) {
      const result = await this.transferTo(recipient, amount, params);
      payments.push(result);
      if (result.txHash) txHashes.push(result.txHash);
    }

    return {
      success: payments.every(p => p.success),
      adapter: this.name,
      model: this.model,
      txHashes,
      payments,
      totalDistributed: payments.reduce((s, p) => s + p.amount, 0n),
      dust,
    };
  }
}
```

**Dependencies**: `viem` (peer)

---

### 2. SplitsAdapter (0xSplits)

**Purpose**: Create or use existing Split contracts that automatically distribute incoming funds.

**Use when**:
- Ongoing royalty distribution
- Set up once, funds auto-split forever
- Want immutable, trustless splits

**How it works**:
1. Create a Split contract with recipients and percentages
2. Any funds sent to the Split address are automatically distributed
3. Recipients can withdraw their share anytime

**Implementation**:
```typescript
export class SplitsAdapter implements IPaymentAdapter {
  readonly name = "splits";
  readonly description = "0xSplits automatic revenue splitting";
  readonly supportedChains = [1, 8453, 10, 42161, ...]; // Splits-supported chains
  readonly model = "split-contract" as const;

  private splitsClient: SplitsClient;

  constructor(config: SplitsConfig) {
    this.splitsClient = new SplitsClient(config);
  }

  async distribute(params: DistributeParams): Promise<PaymentResult> {
    // Convert Distribution to Splits format
    const recipients = params.distribution.entries.map(e => ({
      address: e.payment?.recipients?.[0]?.address ?? e.entityId,
      percentAllocation: e.bps * 100, // Splits uses 1e6 scale
    }));

    // Option A: Create new split and send funds
    // Option B: Use existing split address from distribution metadata

    const { splitAddress, txHash } = await this.splitsClient.createSplit({
      recipients,
      distributorFee: 0,
      controller: zeroAddress, // Immutable
    });

    // Send funds to the split
    const sendTxHash = await this.sendToSplit(splitAddress, params);

    return {
      success: true,
      adapter: this.name,
      model: this.model,
      txHashes: [txHash, sendTxHash],
      payments: recipients.map(r => ({
        recipient: r.address,
        amount: (params.amount * BigInt(r.percentAllocation)) / 1_000_000n,
        success: true,
      })),
      totalDistributed: params.amount,
      dust: 0n,
      data: { splitAddress },
    };
  }
}
```

**Dependencies**: `@0xsplits/splits-sdk` (peer)

---

### 3. SuperfluidAdapter (Streaming)

**Purpose**: Continuous payment streams that flow tokens in real-time.

**Use when**:
- Subscriptions / recurring payments
- Salary streaming
- Continuous royalty streams
- Want "set and forget" payments

**How it works**:
1. Wrap tokens as SuperTokens (if needed)
2. Create flow using CFAv1Forwarder
3. Tokens stream continuously until cancelled

**Implementation**:
```typescript
export class SuperfluidAdapter implements IPaymentAdapter {
  readonly name = "superfluid";
  readonly description = "Superfluid real-time token streaming";
  readonly supportedChains = [1, 137, 10, 42161, 8453, ...];
  readonly model = "streaming" as const;

  // CFAv1Forwarder is deployed at same address on all chains
  private readonly cfaForwarder = "0xcfA132E353cB4E398080B9700609bb008eceB125";

  async distribute(params: DistributeParams): Promise<PaymentResult> {
    const streamDuration = params.options?.streamDuration ?? 30 * 24 * 60 * 60; // 30 days default

    const payments: PaymentEntry[] = [];
    const txHashes: string[] = [];

    for (const entry of params.distribution.entries) {
      const recipient = entry.payment?.recipients?.[0]?.address ?? entry.entityId;
      const totalAmount = (params.amount * BigInt(entry.bps)) / 10_000n;

      // Calculate flow rate: amount per second
      const flowRate = totalAmount / BigInt(streamDuration);

      // Create stream via CFAv1Forwarder
      const txHash = await this.createFlow(
        params.token, // Must be SuperToken
        recipient,
        flowRate,
        params.walletClient,
      );

      payments.push({
        recipient,
        amount: totalAmount,
        success: true,
        txHash,
      });
      txHashes.push(txHash);
    }

    return {
      success: true,
      adapter: this.name,
      model: this.model,
      txHashes,
      payments,
      totalDistributed: params.amount,
      dust: 0n,
      data: { streamDuration },
    };
  }

  async supportsToken(token: Address, chainId: number): Promise<boolean> {
    // Check if token is a SuperToken
    // SuperTokens have specific interface
  }
}
```

**Dependencies**: `viem` (peer), optionally `@superfluid-finance/sdk-core` for helpers

---

### 4. X402Adapter (HTTP Micropayments) - Future

**Purpose**: HTTP 402 Payment Required micropayments.

**Use when**:
- API monetization
- Pay-per-request services
- Lightweight payments without gas

**Status**: Deferred - requires more research on x402 protocol spec.

---

## Usage Examples

### Basic Direct Transfer

```typescript
import { DirectTransferAdapter } from "@provenancekit/payments/adapters/direct";
import { calculateDistribution } from "@provenancekit/extensions";

const adapter = new DirectTransferAdapter();

const distribution = calculateDistribution(resourceRef, attributions);

const result = await adapter.distribute({
  distribution,
  amount: parseEther("1"),
  token: zeroAddress, // ETH
  chainId: 8453,
  walletClient,
  publicClient,
});

console.log(`Distributed to ${result.payments.length} recipients`);
```

### Automatic Split Contract

```typescript
import { SplitsAdapter } from "@provenancekit/payments/adapters/splits";

const adapter = new SplitsAdapter({ chainId: 8453 });

const result = await adapter.distribute({
  distribution,
  amount: parseEther("10"),
  token: usdcAddress,
  chainId: 8453,
  walletClient,
  publicClient,
  options: { immutable: true },
});

console.log(`Split contract created at ${result.data.splitAddress}`);
// Future payments to this address auto-split!
```

### Streaming Payments

```typescript
import { SuperfluidAdapter } from "@provenancekit/payments/adapters/superfluid";

const adapter = new SuperfluidAdapter();

const result = await adapter.distribute({
  distribution,
  amount: parseEther("100"), // Total over stream duration
  token: superUsdcAddress,   // Must be SuperToken
  chainId: 137,
  walletClient,
  publicClient,
  options: {
    streamDuration: 30 * 24 * 60 * 60, // 30 days
  },
});

// Streams are now active!
```

## Error Handling

```typescript
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

export type PaymentErrorCode =
  | "UNSUPPORTED_CHAIN"
  | "UNSUPPORTED_TOKEN"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_ALLOWANCE"
  | "TRANSACTION_FAILED"
  | "INVALID_DISTRIBUTION"
  | "ADAPTER_ERROR";
```

## Dependencies

```json
{
  "dependencies": {
    "@provenancekit/extensions": "workspace:*"
  },
  "peerDependencies": {
    "viem": "^2.0.0"
  },
  "peerDependenciesMeta": {
    "viem": {
      "optional": false
    }
  },
  "optionalDependencies": {},
  "devDependencies": {
    "@0xsplits/splits-sdk": "^4.0.0",
    "@superfluid-finance/sdk-core": "^0.7.0",
    "viem": "^2.0.0"
  }
}
```

Note: Splits SDK and Superfluid SDK are dev dependencies for testing but peer dependencies for consumers who want to use those adapters.

## Implementation Priority

1. **Phase 1**: Core types + DirectTransferAdapter
2. **Phase 2**: SplitsAdapter
3. **Phase 3**: SuperfluidAdapter
4. **Phase 4**: X402Adapter (research needed)

## Testing Strategy

- Unit tests for each adapter with mocked clients
- Integration tests on forked mainnet (using foundry/anvil)
- E2E tests on testnets (Sepolia, Base Sepolia)
