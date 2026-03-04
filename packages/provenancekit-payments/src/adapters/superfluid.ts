/**
 * Superfluid Streaming Adapter
 *
 * Creates real-time token streams using the Superfluid protocol.
 * Tokens flow continuously from sender to recipients every second.
 *
 * @remarks
 * **IMPORTANT: SuperTokens Required**
 *
 * Superfluid only works with "SuperTokens" - wrapped versions of regular tokens:
 * - USDC → USDCx
 * - DAI → DAIx
 * - ETH → ETHx
 *
 * Users must wrap their tokens before streaming. This adapter can optionally
 * handle the wrapping step, but the token passed must be a SuperToken address
 * for the stream to work.
 *
 * @example
 * ```typescript
 * import { SuperfluidAdapter } from "@provenancekit/payments/adapters/superfluid";
 *
 * const adapter = new SuperfluidAdapter();
 *
 * // Stream 1000 USDCx over 30 days to contributors
 * const result = await adapter.distribute({
 *   distribution,
 *   amount: parseUnits("1000", 18), // Total over stream duration
 *   token: USDCx_ADDRESS, // Must be SuperToken!
 *   chainId: 137,
 *   walletClient,
 *   publicClient,
 *   options: {
 *     streamDuration: 30 * 24 * 60 * 60, // 30 days in seconds
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { Address, PublicClient, WalletClient } from "viem";
import { encodeFunctionData, parseAbi } from "viem";

import type {
  IPaymentAdapter,
  DistributeParams,
  PaymentResult,
  PaymentEntry,
  FeeEstimate,
  PaymentModel,
} from "../types.js";
import { PaymentError, CHAIN_IDS } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Chains where Superfluid is deployed.
 * @see https://docs.superfluid.org/protocol/networks
 */
const SUPPORTED_CHAINS = [
  CHAIN_IDS.ETHEREUM,
  CHAIN_IDS.POLYGON,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.OPTIMISM,
  CHAIN_IDS.BASE,
  CHAIN_IDS.AVALANCHE,
  CHAIN_IDS.BSC,
  CHAIN_IDS.GNOSIS,
  // Testnets
  CHAIN_IDS.SEPOLIA,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.POLYGON_AMOY,
];

/**
 * CFAv1Forwarder contract address (same on all chains).
 * This is the main entry point for creating/managing streams.
 * @see https://docs.superfluid.org/docs/sdk/quickstart
 */
const CFA_FORWARDER_ADDRESS: Address =
  "0xcfA132E353cB4E398080B9700609bb008eceB125";

/**
 * Default stream duration: 30 days in seconds.
 */
const DEFAULT_STREAM_DURATION = 30 * 24 * 60 * 60; // 2,592,000 seconds

/**
 * CFAv1Forwarder ABI (minimal for our needs).
 */
const CFA_FORWARDER_ABI = parseAbi([
  // Create a new flow
  "function createFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)",
  // Update an existing flow
  "function updateFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)",
  // Delete a flow
  "function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)",
  // Get current flow rate
  "function getFlowrate(address token, address sender, address receiver) external view returns (int96)",
]);

/**
 * SuperToken interface for checking if a token is a SuperToken.
 */
const SUPER_TOKEN_ABI = parseAbi([
  "function getHost() external view returns (address)",
  "function getUnderlyingToken() external view returns (address)",
]);

/*─────────────────────────────────────────────────────────────*\
 | SuperfluidAdapter                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Superfluid adapter for real-time token streaming.
 *
 * Creates continuous payment streams that flow tokens every second.
 * Unlike one-time transfers, streams are "set and forget" - tokens
 * flow until the stream is cancelled or runs out of funds.
 *
 * **Use cases:**
 * - Salary streaming (pay employees every second)
 * - Subscription payments
 * - Continuous royalty distribution
 * - Vesting schedules
 *
 * **Flow rate calculation:**
 * If you want to stream 1000 tokens over 30 days:
 * flowRate = 1000 / (30 * 24 * 60 * 60) ≈ 0.000386 tokens/second
 *
 * **SuperTokens:**
 * Superfluid requires wrapped "SuperTokens". Common mappings:
 * - USDC → USDCx
 * - DAI → DAIx
 * - ETH → ETHx (native wrapper)
 */
export class SuperfluidAdapter implements IPaymentAdapter {
  readonly name = "superfluid";
  readonly description = "Superfluid real-time token streaming";
  readonly supportedChains = SUPPORTED_CHAINS;
  readonly model: PaymentModel = "streaming";

  /**
   * Execute payment distribution via Superfluid streams.
   *
   * Creates one stream per recipient. Each stream will flow tokens
   * continuously at a rate calculated from:
   *   flowRate = (recipientShare / streamDuration)
   *
   * @remarks
   * - Token MUST be a SuperToken address
   * - Sender must have sufficient SuperToken balance
   * - Streams can be cancelled later via `deleteFlow`
   */
  async distribute(params: DistributeParams): Promise<PaymentResult> {
    const {
      distribution,
      amount,
      token,
      chainId,
      walletClient,
      publicClient,
      options,
    } = params;

    // Validate chain support
    if (!SUPPORTED_CHAINS.includes(chainId as (typeof SUPPORTED_CHAINS)[number])) {
      throw new PaymentError(
        `Superfluid not supported on chain ${chainId}`,
        "UNSUPPORTED_CHAIN",
        { chainId, supportedChains: SUPPORTED_CHAINS }
      );
    }

    // Validate distribution
    if (distribution.entries.length === 0) {
      throw new PaymentError(
        "Distribution has no entries",
        "EMPTY_DISTRIBUTION"
      );
    }

    if (amount <= 0n) {
      throw new PaymentError(
        "Amount must be greater than zero",
        "INVALID_AMOUNT",
        { amount: amount.toString() }
      );
    }

    // Verify token is a SuperToken
    const isSuperToken = await this.isSuperToken(publicClient, token);
    if (!isSuperToken) {
      throw new PaymentError(
        "Token must be a SuperToken (e.g., USDCx, DAIx). " +
          "Wrap your tokens first using Superfluid's wrapper contracts.",
        "UNSUPPORTED_TOKEN",
        { token }
      );
    }

    // Get sender address
    const [senderAddress] = await walletClient.getAddresses();
    if (!senderAddress) {
      throw new PaymentError(
        "No account found in wallet client",
        "ADAPTER_ERROR"
      );
    }

    // Calculate stream duration
    const streamDuration = options?.streamDuration ?? DEFAULT_STREAM_DURATION;

    const payments: PaymentEntry[] = [];
    const txHashes: string[] = [];
    let totalDistributed = 0n;

    // Create a stream for each recipient
    for (const entry of distribution.entries) {
      const recipient = this.resolveRecipient(entry);

      // Calculate this recipient's share
      const recipientAmount = (amount * BigInt(entry.bps)) / 10_000n;

      if (recipientAmount === 0n) {
        payments.push({
          recipient,
          amount: 0n,
          bps: entry.bps,
          success: true,
        });
        continue;
      }

      // Calculate flow rate: amount per second (int96)
      // flowRate = recipientAmount / streamDuration
      const flowRate = recipientAmount / BigInt(streamDuration);

      if (flowRate === 0n) {
        // Amount too small for the duration - skip or error
        payments.push({
          recipient,
          amount: recipientAmount,
          bps: entry.bps,
          success: false,
          error: "Flow rate would be zero - amount too small for duration",
        });
        continue;
      }

      try {
        const txHash = await this.createFlow(
          walletClient,
          token,
          senderAddress,
          recipient,
          flowRate,
          options?.gasLimit
        );

        payments.push({
          recipient,
          amount: recipientAmount,
          bps: entry.bps,
          success: true,
          txHash,
        });
        txHashes.push(txHash);
        totalDistributed += recipientAmount;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        payments.push({
          recipient,
          amount: recipientAmount,
          bps: entry.bps,
          success: false,
          error: errorMessage,
        });
      }
    }

    const allSuccess = payments.every((p) => p.success);

    return {
      success: allSuccess,
      adapter: this.name,
      model: this.model,
      txHashes,
      payments,
      totalDistributed,
      dust: 0n, // Streaming doesn't have dust in the same way
      data: {
        streamDuration,
        flowRates: payments
          .filter((p) => p.success && p.amount > 0n)
          .map((p) => ({
            recipient: p.recipient,
            flowRate: (p.amount / BigInt(streamDuration)).toString(),
            amountPerMonth: (
              (p.amount * BigInt(30 * 24 * 60 * 60)) /
              BigInt(streamDuration)
            ).toString(),
          })),
      },
    };
  }

  /**
   * Estimate fees for creating streams.
   */
  async estimateFees(params: DistributeParams): Promise<FeeEstimate> {
    const { distribution, publicClient } = params;

    // Each stream creation costs approximately 200k-300k gas
    const gasPerStream = 250_000n;
    const txCount = distribution.entries.length;
    const totalGas = gasPerStream * BigInt(txCount);

    const gasPrice = await publicClient.getGasPrice();
    const gasEstimate = totalGas * gasPrice;

    return {
      gasEstimate,
      txCount,
      total: gasEstimate,
    };
  }

  /**
   * Check if a token is a SuperToken.
   */
  async supportsToken(
    token: Address,
    chainId: number,
    publicClient?: PublicClient
  ): Promise<boolean> {
    if (!SUPPORTED_CHAINS.includes(chainId as (typeof SUPPORTED_CHAINS)[number])) {
      return false;
    }

    if (!publicClient) {
      // Without a client, we can't verify - assume yes if on supported chain
      return true;
    }

    return this.isSuperToken(publicClient, token);
  }

  /*──────────────────────────────────────────────────────────*\
   | Stream Management (Utility Methods)                      |
  \*──────────────────────────────────────────────────────────*/

  /**
   * Get the current flow rate between sender and receiver.
   */
  async getFlowRate(
    publicClient: PublicClient,
    token: Address,
    sender: Address,
    receiver: Address
  ): Promise<bigint> {
    const flowRate = await publicClient.readContract({
      address: CFA_FORWARDER_ADDRESS,
      abi: CFA_FORWARDER_ABI,
      functionName: "getFlowrate",
      args: [token, sender, receiver],
    });

    return BigInt(flowRate);
  }

  /**
   * Cancel a stream.
   */
  async cancelStream(
    walletClient: WalletClient,
    token: Address,
    sender: Address,
    receiver: Address,
    gasLimit?: bigint
  ): Promise<string> {
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new PaymentError(
        "No account found in wallet client",
        "ADAPTER_ERROR"
      );
    }

    const data = encodeFunctionData({
      abi: CFA_FORWARDER_ABI,
      functionName: "deleteFlow",
      args: [token, sender, receiver, "0x"],
    });

    const hash = await walletClient.sendTransaction({
      account,
      chain: null,
      to: CFA_FORWARDER_ADDRESS,
      data,
      gas: gasLimit,
    });

    return hash;
  }

  /**
   * Update flow rate for an existing stream.
   */
  async updateStreamRate(
    walletClient: WalletClient,
    token: Address,
    sender: Address,
    receiver: Address,
    newFlowRate: bigint,
    gasLimit?: bigint
  ): Promise<string> {
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new PaymentError(
        "No account found in wallet client",
        "ADAPTER_ERROR"
      );
    }

    const data = encodeFunctionData({
      abi: CFA_FORWARDER_ABI,
      functionName: "updateFlow",
      args: [token, sender, receiver, newFlowRate, "0x"],
    });

    const hash = await walletClient.sendTransaction({
      account,
      chain: null,
      to: CFA_FORWARDER_ADDRESS,
      data,
      gas: gasLimit,
    });

    return hash;
  }

  /*──────────────────────────────────────────────────────────*\
   | Private Methods                                          |
  \*──────────────────────────────────────────────────────────*/

  /**
   * Create a new flow via CFAv1Forwarder.
   */
  private async createFlow(
    walletClient: WalletClient,
    token: Address,
    sender: Address,
    receiver: Address,
    flowRate: bigint,
    gasLimit?: bigint
  ): Promise<string> {
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new PaymentError(
        "No account found in wallet client",
        "ADAPTER_ERROR"
      );
    }

    const data = encodeFunctionData({
      abi: CFA_FORWARDER_ABI,
      functionName: "createFlow",
      args: [token, sender, receiver, flowRate, "0x"],
    });

    const hash = await walletClient.sendTransaction({
      account,
      chain: null,
      to: CFA_FORWARDER_ADDRESS,
      data,
      gas: gasLimit,
    });

    return hash;
  }

  /**
   * Check if a token is a SuperToken by calling getHost().
   */
  private async isSuperToken(
    publicClient: PublicClient,
    token: Address
  ): Promise<boolean> {
    try {
      // SuperTokens have a getHost() method that returns the Superfluid host
      await publicClient.readContract({
        address: token,
        abi: SUPER_TOKEN_ABI,
        functionName: "getHost",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve recipient address from distribution entry.
   */
  private resolveRecipient(entry: {
    entityId: string;
    payment?: { recipient?: { address: string } };
  }): Address {
    const paymentAddress = entry.payment?.recipient?.address;
    if (paymentAddress && paymentAddress.startsWith("0x")) {
      return paymentAddress as Address;
    }

    if (entry.entityId.startsWith("0x") && entry.entityId.length === 42) {
      return entry.entityId as Address;
    }

    throw new PaymentError(
      `Cannot resolve recipient address for entity: ${entry.entityId}`,
      "ADAPTER_ERROR",
      { entityId: entry.entityId }
    );
  }
}

/**
 * Default instance for convenience.
 */
export const superfluidAdapter = new SuperfluidAdapter();

/*─────────────────────────────────────────────────────────────*\
 | Helper: Common SuperToken Addresses                          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Common SuperToken addresses per chain.
 * Use these for quick reference - always verify on-chain.
 *
 * @see https://docs.superfluid.org/protocol/tokens
 */
export const SUPER_TOKENS: Record<number, Record<string, Address>> = {
  [CHAIN_IDS.POLYGON]: {
    USDCx: "0xCAa7349CEA390F89641fe306D93591f87595dc1F",
    DAIx: "0x1305F6B6Df9Dc47159D12Eb7aC2804d4A33173c2",
    MATICx: "0x3aD736904E9e65189c3000c7DD2c8AC8bB7cD4e3",
  },
  [CHAIN_IDS.BASE]: {
    USDCx: "0xD04383398dD2426297da660F9CCA3d439AF9ce1b",
    ETHx: "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93",
  },
  [CHAIN_IDS.ETHEREUM]: {
    USDCx: "0x1BA8603DA702602A8657980e825A6DAa03Dee93a",
    DAIx: "0x7E2c8AD5C7b2DC4E97D2d5C27C5712F5D2C0Dd2D",
  },
  [CHAIN_IDS.ARBITRUM]: {
    USDCx: "0x22F22C1B2e1F4b1aF1E0Df12d8758e2F23e69b0a",
  },
  [CHAIN_IDS.OPTIMISM]: {
    USDCx: "0x8430F084B939208E2eDEd1584889C9A66B90562f",
    DAIx: "0x7d342726B69C28D942ad8BfE6Ac81b972349d524",
  },
};
