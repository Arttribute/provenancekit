/**
 * On-chain recording adapter for ProvenanceKit SDK.
 *
 * Three adapters are provided, covering every common wallet/signing setup:
 *
 * 1. `createViemAdapter`     — viem WalletClient (recommended for server-side or apps
 *                              already using viem)
 * 2. `createEIP1193Adapter`  — any EIP-1193 provider: MetaMask, Privy embedded wallet,
 *                              Coinbase Wallet, WalletConnect, Rainbow, Wagmi, etc.
 * 3. Custom `IChainAdapter`  — implement the interface directly for ethers.js,
 *                              account abstraction (ERC-4337), or any other setup
 *
 * **Smooth UX without per-tx signing prompts:**
 * For apps that want the user's address on-chain but without a popup on every
 * provenance recording, use one of these patterns:
 *
 * A. **Smart wallet session keys** (recommended — works with Privy, Coinbase Smart Wallet,
 *    ZeroDev, Biconomy, Safe):
 *    ```ts
 *    // User creates a smart wallet once and grants a session key to the app
 *    // The session key can call recordAction without prompting the user
 *    // msg.sender is the user's smart wallet address — attribution is exact
 *    const adapter = createEIP1193Adapter({
 *      provider: sessionKeyProvider,   // session key provider, no prompts
 *      account: userSmartWalletAddress,
 *      contractAddress: REGISTRY_ADDRESS,
 *    });
 *    ```
 *
 * B. **Server-side signing with user wallet in off-chain record:**
 *    Use `createViemAdapter` on the server with the API's signing key.
 *    The user's wallet address goes into `entity.wallet` for attribution.
 *    The on-chain `performer` is the API's address, but provenance is still
 *    unambiguously linked to the user via the off-chain EAA record.
 *    (Simpler to implement; trade-off: not the user's address on-chain.)
 *
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
// Minimal ABI encoder for EIP-1193 adapter (no external dependencies)
// ---------------------------------------------------------------------------

/**
 * Encode a 256-bit unsigned integer as a 64-character hex string (big-endian).
 * Used for ABI encoding offsets, lengths, and counts.
 */
function enc32(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, "0");
}

/** Convert a Uint8Array to a lowercase hex string. */
function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * ABI-encode a UTF-8 string as a dynamic bytes value:
 * 32 bytes length + ceil(len/32)*32 bytes of UTF-8 data (right-padded with 0s).
 */
function encodeString(s: string): string {
  const utf8 = new TextEncoder().encode(s);
  const paddedLen = Math.ceil(utf8.length / 32) * 32;
  const padded = new Uint8Array(paddedLen);
  padded.set(utf8);
  return enc32(utf8.length) + bytesToHex(padded);
}

/**
 * ABI-encode a string[] as a dynamic array:
 * 32 bytes count, then count offsets (relative to start of this encoding,
 * i.e. right after the count), then the encoded strings.
 */
function encodeStringArray(arr: string[]): string {
  const count = enc32(arr.length);
  const encodedItems = arr.map(encodeString);
  // Offsets are relative to start of inner head (right after count)
  const innerHeadBytes = arr.length * 32;
  let offset = innerHeadBytes;
  const heads = encodedItems.map((enc) => {
    const h = enc32(offset);
    offset += enc.length / 2; // enc is hex chars
    return h;
  });
  return count + heads.join("") + encodedItems.join("");
}

/**
 * Encode a call to `recordAction(string,string[],string[])`.
 *
 * Selector: keccak256("recordAction(string,string[],string[])")[0:4]
 * Verified with: `cast sig "recordAction(string,string[],string[])"`  → 0xd57e4f08
 */
function encodeRecordActionCall(
  actionType: string,
  inputs: string[],
  outputs: string[]
): `0x${string}` {
  const SELECTOR = "d57e4f08";
  const encType = encodeString(actionType);
  const encInputs = encodeStringArray(inputs);
  const encOutputs = encodeStringArray(outputs);

  // Three dynamic params → three pointers in the head (96 bytes = 0x60 total)
  const HEAD_BYTES = 3 * 32;
  const ptr1 = HEAD_BYTES;
  const ptr2 = HEAD_BYTES + encType.length / 2;
  const ptr3 = ptr2 + encInputs.length / 2;

  return `0x${SELECTOR}${enc32(ptr1)}${enc32(ptr2)}${enc32(ptr3)}${encType}${encInputs}${encOutputs}`;
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

// ---------------------------------------------------------------------------
// createEIP1193Adapter — factory for any EIP-1193 provider
// ---------------------------------------------------------------------------

/**
 * Any EIP-1193 compatible provider: MetaMask, Privy embedded wallet,
 * Coinbase Wallet, WalletConnect, Rainbow Kit, Wagmi's connector, etc.
 */
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface EIP1193AdapterOptions {
  /** Any EIP-1193 provider. */
  provider: EIP1193Provider;
  /**
   * The account address to send from.
   * For session-key setups, pass the smart wallet address so it is
   * the on-chain `performer` — even if the session key signs the tx.
   */
  account: `0x${string}`;
  contractAddress: `0x${string}`;
  chainId?: number;
  chainName?: string;
}

/**
 * Create a chain adapter backed by any EIP-1193 provider.
 *
 * Works with MetaMask, Privy, Coinbase Wallet, WalletConnect, Rainbow Kit,
 * Wagmi connectors, and any other EIP-1193 compatible wallet.
 *
 * Uses `eth_call` to simulate the transaction and retrieve the `actionId`
 * return value, then `eth_sendTransaction` to broadcast.
 *
 * No viem or ethers.js dependency required — ABI encoding is self-contained.
 *
 * @example MetaMask / window.ethereum
 * ```ts
 * const adapter = createEIP1193Adapter({
 *   provider: window.ethereum,
 *   account: "0xYourAddress",
 *   contractAddress: REGISTRY_ADDRESS,
 * });
 * ```
 *
 * @example Privy embedded wallet
 * ```ts
 * const { wallets } = useWallets();
 * const embeddedWallet = wallets.find(w => w.walletClientType === "privy");
 * const provider = await embeddedWallet.getEthereumProvider();
 * const adapter = createEIP1193Adapter({
 *   provider,
 *   account: embeddedWallet.address as `0x${string}`,
 *   contractAddress: REGISTRY_ADDRESS,
 * });
 * ```
 */
export function createEIP1193Adapter(opts: EIP1193AdapterOptions): IChainAdapter {
  const { provider, account, contractAddress, chainId, chainName } = opts;

  return {
    contractAddress,
    chainId,
    chainName,

    async recordAction(params: RecordActionParams): Promise<RecordActionResult> {
      const data = encodeRecordActionCall(
        params.actionType,
        params.inputs,
        params.outputs
      );

      // Simulate via eth_call to retrieve the actionId return value (bytes32)
      const callResult = (await provider.request({
        method: "eth_call",
        params: [{ from: account, to: contractAddress, data }, "latest"],
      })) as `0x${string}`;

      // The return value is a 32-byte word (bytes32 actionId); take first 32 bytes
      const actionId = `0x${callResult.slice(2, 66)}` as `0x${string}`;

      // Broadcast the transaction
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: contractAddress, data }],
      })) as `0x${string}`;

      return { txHash, actionId };
    },
  };
}
