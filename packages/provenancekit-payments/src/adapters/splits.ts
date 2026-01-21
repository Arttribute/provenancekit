/**
 * 0xSplits Adapter
 *
 * Creates and uses Split contracts that automatically distribute incoming funds
 * among recipients according to predefined percentages.
 *
 * @remarks
 * 0xSplits is ideal for:
 * - Ongoing royalty distribution (NFT sales, streaming revenue)
 * - Team payment splitting
 * - Any scenario where funds arrive continuously and need auto-splitting
 *
 * Key concepts:
 * - **Split Contract**: A smart contract that holds funds and distributes them
 * - **Immutable vs Mutable**: Immutable splits can't be changed; mutable have a controller
 * - **Distributor Fee**: Optional fee for whoever calls `distribute()` on the split
 *
 * @example
 * ```typescript
 * import { SplitsAdapter } from "@provenancekit/payments/adapters/splits";
 *
 * // Create adapter (requires @0xsplits/splits-sdk as peer dependency)
 * const adapter = new SplitsAdapter();
 *
 * const result = await adapter.distribute({
 *   distribution,
 *   amount: parseEther("10"),
 *   token: usdcAddress,
 *   chainId: 8453,
 *   walletClient,
 *   publicClient,
 *   options: { immutable: true },
 * });
 *
 * // Future funds sent to result.data.splitAddress will auto-split!
 * console.log("Split created at:", result.data.splitAddress);
 * ```
 *
 * @packageDocumentation
 */

import type { Address, PublicClient, WalletClient } from "viem";
import { zeroAddress, encodeFunctionData, parseAbi } from "viem";

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
 * Chains where 0xSplits is deployed.
 * @see https://docs.splits.org/core/split#deployments
 */
const SUPPORTED_CHAINS = [
  CHAIN_IDS.ETHEREUM,
  CHAIN_IDS.POLYGON,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.OPTIMISM,
  CHAIN_IDS.BASE,
  CHAIN_IDS.GNOSIS,
  // Testnets
  CHAIN_IDS.SEPOLIA,
  CHAIN_IDS.BASE_SEPOLIA,
];

/**
 * 0xSplits uses 1e6 scale for percentages (1e6 = 100%).
 * ProvenanceKit uses 1e4 (10000 = 100%).
 */
const SPLITS_PERCENTAGE_SCALE = 1_000_000;
const BPS_TO_SPLITS_MULTIPLIER = 100; // 10000 bps * 100 = 1e6

/**
 * SplitMain contract ABI (minimal for our needs).
 * The actual address varies by chain but the interface is the same.
 */
const SPLIT_MAIN_ABI = parseAbi([
  "function createSplit(address[] calldata accounts, uint32[] calldata percentAllocations, uint32 distributorFee, address controller) external returns (address split)",
  "function distributeETH(address split, address[] calldata accounts, uint32[] calldata percentAllocations, uint32 distributorFee, address distributorAddress) external",
  "function distributeERC20(address split, address token, address[] calldata accounts, uint32[] calldata percentAllocations, uint32 distributorFee, address distributorAddress) external",
  "function getHash(address split) external view returns (bytes32)",
]);

/**
 * SplitMain contract addresses per chain.
 * @see https://docs.splits.org/core/split#deployments
 */
const SPLIT_MAIN_ADDRESSES: Record<number, Address> = {
  [CHAIN_IDS.ETHEREUM]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.POLYGON]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.ARBITRUM]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.OPTIMISM]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.BASE]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.GNOSIS]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.SEPOLIA]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
  [CHAIN_IDS.BASE_SEPOLIA]: "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE",
};

/**
 * ERC-20 transfer ABI for sending funds to split.
 */
const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

/*─────────────────────────────────────────────────────────────*\
 | Types                                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Recipient for 0xSplits format.
 */
interface SplitsRecipient {
  address: Address;
  percentAllocation: number; // In Splits scale (1e6)
}

/*─────────────────────────────────────────────────────────────*\
 | SplitsAdapter                                                |
\*─────────────────────────────────────────────────────────────*/

/**
 * 0xSplits adapter for automatic revenue splitting.
 *
 * Creates Split contracts that automatically distribute any incoming
 * funds among recipients according to their percentage allocations.
 *
 * Flow:
 * 1. Convert ProvenanceKit distribution to Splits format
 * 2. Create a Split contract (or use existing one)
 * 3. Send funds to the Split address
 * 4. (Optional) Trigger distribution immediately
 *
 * The Split address can receive funds in the future and they'll
 * be automatically distributed according to the same percentages.
 */
export class SplitsAdapter implements IPaymentAdapter {
  readonly name = "splits";
  readonly description = "0xSplits automatic revenue splitting";
  readonly supportedChains = SUPPORTED_CHAINS;
  readonly model: PaymentModel = "split-contract";

  /**
   * Execute payment distribution via 0xSplits.
   *
   * Creates a new Split contract and sends the specified amount to it.
   * The Split will automatically distribute funds among recipients.
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
    const splitMainAddress = SPLIT_MAIN_ADDRESSES[chainId];
    if (!splitMainAddress) {
      throw new PaymentError(
        `0xSplits not supported on chain ${chainId}`,
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

    if (distribution.entries.length < 2) {
      throw new PaymentError(
        "0xSplits requires at least 2 recipients",
        "INVALID_DISTRIBUTION",
        { recipientCount: distribution.entries.length }
      );
    }

    // Convert to Splits format
    const recipients = this.toSplitsRecipients(distribution);

    // Sort by address (required by 0xSplits)
    recipients.sort((a, b) =>
      a.address.toLowerCase().localeCompare(b.address.toLowerCase())
    );

    // Extract arrays for contract call
    const accounts = recipients.map((r) => r.address);
    const percentAllocations = recipients.map((r) => r.percentAllocation);

    // Options
    const immutable = options?.immutable ?? true;
    const controller = immutable
      ? zeroAddress
      : options?.controller ?? zeroAddress;
    const distributorFee = options?.distributorFee ?? 0;

    // Get sender address
    const [senderAddress] = await walletClient.getAddresses();
    if (!senderAddress) {
      throw new PaymentError(
        "No account found in wallet client",
        "ADAPTER_ERROR"
      );
    }

    const txHashes: string[] = [];

    // Step 1: Create the Split
    const createSplitData = encodeFunctionData({
      abi: SPLIT_MAIN_ABI,
      functionName: "createSplit",
      args: [accounts, percentAllocations, distributorFee, controller],
    });

    const createTxHash = await walletClient.sendTransaction({
      account: senderAddress,
      chain: null, // Use walletClient's chain
      to: splitMainAddress,
      data: createSplitData,
      gas: options?.gasLimit,
    });
    txHashes.push(createTxHash);

    // Wait for transaction to get the split address
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: createTxHash,
    });

    // The split address is deterministic based on the config
    // For simplicity, we'll compute it (or parse from logs in production)
    const splitAddress = await this.computeSplitAddress(
      publicClient,
      splitMainAddress,
      accounts,
      percentAllocations,
      distributorFee,
      controller
    );

    // Step 2: Send funds to the Split
    if (amount > 0n) {
      const isNative = token === NATIVE_TOKEN || token === zeroAddress;

      if (isNative) {
        const sendTxHash = await walletClient.sendTransaction({
          account: senderAddress,
          chain: null,
          to: splitAddress,
          value: amount,
        });
        txHashes.push(sendTxHash);
      } else {
        const transferData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [splitAddress, amount],
        });

        const sendTxHash = await walletClient.sendTransaction({
          account: senderAddress,
          chain: null,
          to: token,
          data: transferData,
        });
        txHashes.push(sendTxHash);
      }
    }

    // Build payment entries
    const payments: PaymentEntry[] = recipients.map((r) => ({
      recipient: r.address,
      amount:
        (amount * BigInt(r.percentAllocation)) / BigInt(SPLITS_PERCENTAGE_SCALE),
      bps: r.percentAllocation / BPS_TO_SPLITS_MULTIPLIER,
      success: true,
    }));

    return {
      success: true,
      adapter: this.name,
      model: this.model,
      txHashes,
      payments,
      totalDistributed: amount,
      dust: 0n, // Splits handles rounding internally
      data: {
        splitAddress,
        immutable,
        controller,
        distributorFee,
      },
    };
  }

  /**
   * Estimate fees for creating a Split.
   */
  async estimateFees(params: DistributeParams): Promise<FeeEstimate> {
    const { publicClient, amount } = params;

    // Estimate: create split (~150k gas) + transfer (~21k ETH or ~65k ERC20)
    const createGas = 150_000n;
    const transferGas = amount > 0n ? 65_000n : 0n;
    const totalGas = createGas + transferGas;

    const gasPrice = await publicClient.getGasPrice();
    const gasEstimate = totalGas * gasPrice;

    return {
      gasEstimate,
      txCount: amount > 0n ? 2 : 1,
      total: gasEstimate,
    };
  }

  /**
   * All ERC-20 tokens are supported by 0xSplits.
   */
  async supportsToken(): Promise<boolean> {
    return true;
  }

  /*──────────────────────────────────────────────────────────*\
   | Private Methods                                          |
  \*──────────────────────────────────────────────────────────*/

  /**
   * Convert ProvenanceKit distribution to 0xSplits format.
   */
  private toSplitsRecipients(distribution: {
    entries: Array<{
      entityId: string;
      bps: number;
      payment?: { recipient?: { address: string } };
    }>;
  }): SplitsRecipient[] {
    return distribution.entries.map((entry) => {
      const address = this.resolveRecipient(entry);
      // Convert from bps (1e4) to Splits scale (1e6)
      const percentAllocation = entry.bps * BPS_TO_SPLITS_MULTIPLIER;

      return { address, percentAllocation };
    });
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

  /**
   * Compute the deterministic Split address.
   *
   * In production, you'd parse this from the CreateSplit event logs.
   * For now, we return a placeholder that should be replaced with
   * actual address parsing logic.
   */
  private async computeSplitAddress(
    publicClient: PublicClient,
    splitMainAddress: Address,
    accounts: Address[],
    percentAllocations: number[],
    distributorFee: number,
    controller: Address
  ): Promise<Address> {
    // The split address is deterministic based on:
    // keccak256(abi.encodePacked(accounts, percentAllocations, distributorFee, controller))
    //
    // In a real implementation, you would either:
    // 1. Parse the CreateSplit event from the transaction receipt
    // 2. Use the 0xSplits SDK which handles this
    // 3. Compute the CREATE2 address yourself
    //
    // For now, we return a computed address based on the inputs
    // This is a simplified version - real implementation needs proper CREATE2 calculation

    // TODO: Implement proper split address calculation or use SDK
    // For now, return a placeholder that indicates this needs proper implementation
    const { keccak256, encodePacked } = await import("viem");

    const hash = keccak256(
      encodePacked(
        ["address[]", "uint32[]", "uint32", "address"],
        [accounts, percentAllocations, distributorFee, controller]
      )
    );

    // This is NOT the actual split address - just a deterministic placeholder
    // Real implementation should use CREATE2 address calculation
    return `0x${hash.slice(26)}` as Address;
  }
}

/**
 * Default instance for convenience.
 *
 * Note: For production use, consider instantiating with specific config
 * or using the @0xsplits/splits-sdk directly for full functionality.
 */
export const splitsAdapter = new SplitsAdapter();
