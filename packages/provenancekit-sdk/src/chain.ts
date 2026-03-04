/**
 * On-chain recording adapter for ProvenanceKit SDK.
 *
 * Provides a framework-agnostic interface (`IChainAdapter`) for recording
 * provenance actions on the ProvenanceRegistry smart contract, plus a
 * factory (`createViemAdapter`) for viem users.
 *
 * The SDK accepts any object that satisfies `IChainAdapter` — you can
 * implement your own adapter for ethers.js, wagmi, or any other EVM client.
 *
 * @example Using with viem
 * ```typescript
 * import { createWalletClient, createPublicClient, http } from "viem";
 * import { base } from "viem/chains";
 * import { ProvenanceKit, createViemAdapter } from "@provenancekit/sdk";
 *
 * const walletClient = createWalletClient({ account, chain: base, transport: http() });
 * const publicClient = createPublicClient({ chain: base, transport: http() });
 *
 * const pk = new ProvenanceKit({
 *   apiKey: "pk_live_...",
 *   chain: createViemAdapter({
 *     walletClient,
 *     publicClient,
 *     contractAddress: "0xYourRegistryAddress",
 *   }),
 * });
 *
 * // file() will now also record the action on-chain
 * const result = await pk.file(buffer, { entity: { role: "creator" } });
 * // result.onchain contains { txHash, actionId, chainId }
 * ```
 */

// ---------------------------------------------------------------------------
// Minimal type interfaces (no hard viem dependency at module level)
// ---------------------------------------------------------------------------

/** Minimal subset of viem WalletClient used by createViemAdapter. */
export interface ViemWalletClient {
  account?: { address: `0x${string}` };
  writeContract(args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    account?: { address: `0x${string}` };
  }): Promise<`0x${string}`>;
}

/** Minimal subset of viem PublicClient used by createViemAdapter. */
export interface ViemPublicClient {
  simulateContract(args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    account?: { address: `0x${string}` };
  }): Promise<{ result: unknown; request: unknown }>;
}

// ---------------------------------------------------------------------------
// IChainAdapter — the interface the SDK calls
// ---------------------------------------------------------------------------

/** Parameters for recording an action on-chain. */
export interface RecordActionParams {
  /** EAA action type (e.g. "create", "transform"). */
  actionType: string;
  /** Content references (CIDs) of input resources. */
  inputs: string[];
  /** Content references (CIDs) of output resources. */
  outputs: string[];
}

/** Result returned after an on-chain action recording. */
export interface RecordActionResult {
  /** Transaction hash of the recording transaction. */
  txHash: string;
  /** On-chain action ID as a hex string (bytes32). */
  actionId: string;
}

/**
 * Adapter interface for on-chain provenance recording.
 *
 * Implement this to record actions on any EVM-compatible blockchain.
 * The SDK is chain-client agnostic — use `createViemAdapter` for viem,
 * or implement your own for ethers.js, wagmi hooks, etc.
 */
export interface IChainAdapter {
  /** Record a provenance action on-chain. */
  recordAction(params: RecordActionParams): Promise<RecordActionResult>;
  /** Chain ID for the `ext:onchain@1.0.0` extension. Optional. */
  chainId?: number;
  /** Human-readable chain name (e.g. "base", "arbitrum"). Optional. */
  chainName?: string;
  /** Address of the deployed ProvenanceRegistry contract. */
  contractAddress: string;
}

// ---------------------------------------------------------------------------
// Minimal ProvenanceRegistry ABI (only what the SDK needs)
// ---------------------------------------------------------------------------

const PROVENANCE_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordAction",
    inputs: [
      { name: "actionType", type: "string" },
      { name: "inputs", type: "string[]" },
      { name: "outputs", type: "string[]" },
    ],
    outputs: [{ name: "actionId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

// ---------------------------------------------------------------------------
// createViemAdapter — factory for viem users
// ---------------------------------------------------------------------------

export interface ViemAdapterOptions {
  walletClient: ViemWalletClient;
  publicClient: ViemPublicClient;
  contractAddress: `0x${string}`;
  chainId?: number;
  chainName?: string;
}

/**
 * Create a chain adapter backed by viem.
 *
 * Uses `simulateContract` + `writeContract` to record actions on the
 * ProvenanceRegistry. The `simulateContract` call retrieves the on-chain
 * `actionId` before broadcasting the transaction.
 */
export function createViemAdapter(opts: ViemAdapterOptions): IChainAdapter {
  const { walletClient, publicClient, contractAddress, chainId, chainName } = opts;

  return {
    contractAddress,
    chainId,
    chainName,

    async recordAction(params: RecordActionParams): Promise<RecordActionResult> {
      const account = walletClient.account;

      // Simulate to get expected return value (actionId) before sending tx
      const { result, request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: PROVENANCE_REGISTRY_ABI,
        functionName: "recordAction",
        args: [params.actionType, params.inputs, params.outputs],
        account,
      });

      // Broadcast the transaction
      const txHash = await walletClient.writeContract(
        request as Parameters<typeof walletClient.writeContract>[0]
      );

      return {
        txHash,
        actionId: result as string,
      };
    },
  };
}
