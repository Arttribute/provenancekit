/**
 * Direct Transfer Adapter
 *
 * Executes simple ETH and ERC-20 transfers for payment distribution.
 * This is the baseline adapter - works on any EVM chain, no special setup needed.
 *
 * @example
 * ```typescript
 * import { DirectTransferAdapter } from "@provenancekit/payments/adapters/direct";
 *
 * const adapter = new DirectTransferAdapter();
 *
 * const result = await adapter.distribute({
 *   distribution,
 *   amount: parseEther("1"),
 *   token: zeroAddress, // Native ETH
 *   chainId: 8453,
 *   walletClient,
 *   publicClient,
 * });
 * ```
 *
 * @packageDocumentation
 */

import {
  type Address,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
} from "viem";
import { splitAmount } from "@provenancekit/extensions";

import type {
  IPaymentAdapter,
  DistributeParams,
  PaymentResult,
  PaymentEntry,
  FeeEstimate,
  PaymentModel,
} from "../types.js";
import { PaymentError, NATIVE_TOKEN, CHAIN_IDS } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * ERC-20 transfer ABI fragment
 */
const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

/**
 * All EVM chains are supported for direct transfers
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
  CHAIN_IDS.SEPOLIA,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.POLYGON_AMOY,
];

/*─────────────────────────────────────────────────────────────*\
 | DirectTransferAdapter                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Direct transfer adapter for one-time ETH/ERC-20 payments.
 *
 * Features:
 * - Native ETH transfers
 * - ERC-20 token transfers
 * - Sequential execution (one tx per recipient)
 * - Detailed error reporting per payment
 *
 * Limitations:
 * - Gas inefficient for many recipients (consider 0xSplits for that)
 * - No automatic retry on failure
 */
export class DirectTransferAdapter implements IPaymentAdapter {
  readonly name = "direct";
  readonly description = "Direct ETH/ERC-20 transfers to recipients";
  readonly supportedChains = SUPPORTED_CHAINS;
  readonly model: PaymentModel = "one-time";

  /**
   * Execute payment distribution via direct transfers.
   *
   * Transfers are executed sequentially. If one fails, subsequent
   * transfers still attempt to execute. Check `result.payments`
   * for individual success/failure status.
   */
  async distribute(params: DistributeParams): Promise<PaymentResult> {
    const { distribution, amount, token, walletClient, publicClient } = params;

    // Validate distribution
    if (distribution.entries.length === 0) {
      throw new PaymentError(
        "Distribution has no entries",
        "EMPTY_DISTRIBUTION",
        { distribution }
      );
    }

    if (amount <= 0n) {
      throw new PaymentError(
        "Amount must be greater than zero",
        "INVALID_AMOUNT",
        { amount: amount.toString() }
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

    // Calculate shares using the distribution calculator
    const { shares, dust } = splitAmount(amount, distribution);

    // Check balance
    await this.checkBalance(
      publicClient,
      senderAddress,
      token,
      amount
    );

    // Execute transfers
    const payments: PaymentEntry[] = [];
    const txHashes: string[] = [];
    let totalDistributed = 0n;

    const isNative = token === NATIVE_TOKEN || token === zeroAddress;

    for (const entry of distribution.entries) {
      const recipient = this.resolveRecipient(entry);
      const paymentAmount = shares.get(entry.entityId);

      if (!paymentAmount || paymentAmount === 0n) {
        payments.push({
          recipient,
          amount: 0n,
          bps: entry.bps,
          success: true, // Zero amount is "successful"
        });
        continue;
      }

      try {
        const txHash = isNative
          ? await this.transferNative(
              walletClient,
              recipient,
              paymentAmount,
              params.options?.gasLimit
            )
          : await this.transferERC20(
              walletClient,
              token,
              recipient,
              paymentAmount,
              params.options?.gasLimit
            );

        payments.push({
          recipient,
          amount: paymentAmount,
          bps: entry.bps,
          success: true,
          txHash,
        });
        txHashes.push(txHash);
        totalDistributed += paymentAmount;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        payments.push({
          recipient,
          amount: paymentAmount,
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
      dust,
    };
  }

  /**
   * Estimate fees for a distribution.
   */
  async estimateFees(params: DistributeParams): Promise<FeeEstimate> {
    const { distribution, token, publicClient } = params;
    const isNative = token === NATIVE_TOKEN || token === zeroAddress;

    // Estimate gas per transfer
    const gasPerTransfer = isNative ? 21_000n : 65_000n; // Rough estimates
    const txCount = distribution.entries.length;
    const totalGas = gasPerTransfer * BigInt(txCount);

    // Get current gas price
    const gasPrice = await publicClient.getGasPrice();
    const gasEstimate = totalGas * gasPrice;

    return {
      gasEstimate,
      txCount,
      total: gasEstimate,
    };
  }

  /**
   * All tokens are supported for direct transfers.
   */
  async supportsToken(): Promise<boolean> {
    return true;
  }

  /*──────────────────────────────────────────────────────────*\
   | Private Methods                                          |
  \*──────────────────────────────────────────────────────────*/

  /**
   * Resolve recipient address from distribution entry.
   */
  private resolveRecipient(entry: {
    entityId: string;
    payment?: { recipient?: { address: string } };
  }): Address {
    // Try to get address from payment extension first
    const paymentAddress = entry.payment?.recipient?.address;
    if (paymentAddress && paymentAddress.startsWith("0x")) {
      return paymentAddress as Address;
    }

    // Fall back to entityId if it looks like an address
    if (entry.entityId.startsWith("0x") && entry.entityId.length === 42) {
      return entry.entityId as Address;
    }

    throw new PaymentError(
      `Cannot resolve recipient address for entity: ${entry.entityId}`,
      "ADAPTER_ERROR",
      { entityId: entry.entityId }
    );
  }

  /**
   * Check if sender has sufficient balance.
   */
  private async checkBalance(
    publicClient: PublicClient,
    sender: Address,
    token: Address,
    amount: bigint
  ): Promise<void> {
    const isNative = token === NATIVE_TOKEN || token === zeroAddress;

    if (isNative) {
      const balance = await publicClient.getBalance({ address: sender });
      if (balance < amount) {
        throw new PaymentError(
          `Insufficient ETH balance: have ${balance}, need ${amount}`,
          "INSUFFICIENT_BALANCE",
          { balance: balance.toString(), required: amount.toString() }
        );
      }
    } else {
      const balance = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [sender],
      });

      if (balance < amount) {
        throw new PaymentError(
          `Insufficient token balance: have ${balance}, need ${amount}`,
          "INSUFFICIENT_BALANCE",
          {
            token,
            balance: balance.toString(),
            required: amount.toString(),
          }
        );
      }
    }
  }

  /**
   * Transfer native ETH.
   */
  private async transferNative(
    walletClient: WalletClient,
    to: Address,
    amount: bigint,
    gasLimit?: bigint
  ): Promise<string> {
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new PaymentError(
        "No account found in wallet client",
        "ADAPTER_ERROR"
      );
    }

    const hash = await walletClient.sendTransaction({
      account,
      chain: null,
      to,
      value: amount,
      gas: gasLimit,
    });

    return hash;
  }

  /**
   * Transfer ERC-20 tokens.
   */
  private async transferERC20(
    walletClient: WalletClient,
    token: Address,
    to: Address,
    amount: bigint,
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
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amount],
    });

    const hash = await walletClient.sendTransaction({
      account,
      chain: null,
      to: token,
      data,
      gas: gasLimit,
    });

    return hash;
  }
}

/**
 * Default instance for convenience.
 */
export const directTransferAdapter = new DirectTransferAdapter();
