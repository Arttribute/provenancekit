import { ProvenanceKit } from "@provenancekit/sdk";
import { createViemAdapter } from "@provenancekit/sdk";

/**
 * App-level ProvenanceKit client — reads from environment variables.
 *
 * The PK API key is set once by the app developer in .env.local (obtained from the
 * provenancekit-app dashboard). All users of this chat app share this single
 * app-level PK project.
 *
 * On-chain provenance (Base Sepolia):
 *   Set CHAIN_PRIVATE_KEY + BASE_SEPOLIA_RPC_URL to enable server-side on-chain
 *   recording via the ProvenanceRegistry deployed at 0x7B2Fe7899a4d227AF2E5F0354b749df31179Db4c.
 *   The key is a server-only hex private key used to sign provenance transactions.
 *   Recording is fire-and-forget — if it fails, the off-chain record always stands.
 *
 * The key is NEVER exposed to the browser. Server-side API routes use this
 * singleton directly. Browser components use /api/pk-proxy which forwards
 * requests to the real PK API with the Authorization header added server-side.
 */

// Base Sepolia ProvenanceRegistry contract address
const BASE_SEPOLIA_CONTRACT = "0x7B2Fe7899a4d227AF2E5F0354b749df31179Db4c" as const;

let _pkClient: ProvenanceKit | null = null;

async function buildChainAdapter() {
  const privateKey = process.env.CHAIN_PRIVATE_KEY;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;

  if (!privateKey || !rpcUrl) return undefined;

  try {
    // Lazy-import viem to avoid including it in client bundles
    const [
      { createWalletClient, createPublicClient, http },
      { baseSepolia },
      { privateKeyToAccount },
    ] = await Promise.all([
      import("viem"),
      import("viem/chains"),
      import("viem/accounts"),
    ]);

    const key = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(key);

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    return createViemAdapter({
      walletClient: walletClient as any,
      publicClient: publicClient as any,
      contractAddress: BASE_SEPOLIA_CONTRACT,
      chainId: 84532,
      chainName: "base-sepolia",
    });
  } catch (err) {
    console.warn("[PK] Failed to create chain adapter:", err);
    return undefined;
  }
}

export async function getPKClientAsync(): Promise<ProvenanceKit | null> {
  if (!process.env.PK_API_KEY) return null;
  if (_pkClient) return _pkClient;

  const chain = await buildChainAdapter();

  _pkClient = new ProvenanceKit({
    apiKey: process.env.PK_API_KEY,
    projectId: process.env.PK_PROJECT_ID,
    ...(chain ? { chain } : {}),
  });

  return _pkClient;
}

/**
 * Synchronous getter — returns an already-initialised client or null.
 * Use getPKClientAsync() on first call to ensure the chain adapter is set up.
 */
export function getPKClient(): ProvenanceKit | null {
  if (!process.env.PK_API_KEY) return null;
  if (_pkClient) return _pkClient;

  // Fallback: create client without chain adapter (chain adapter needs async init)
  _pkClient = new ProvenanceKit({
    apiKey: process.env.PK_API_KEY,
    projectId: process.env.PK_PROJECT_ID,
  });

  // Warm up the chain adapter in the background — future calls will use it
  buildChainAdapter().then((adapter) => {
    if (adapter && _pkClient) {
      // Re-create client with the adapter now that we have it
      _pkClient = new ProvenanceKit({
        apiKey: process.env.PK_API_KEY!,
        projectId: process.env.PK_PROJECT_ID,
        chain: adapter,
      });
    }
  }).catch(() => { /* non-fatal */ });

  return _pkClient;
}

export function isPKEnabled(): boolean {
  return !!process.env.PK_API_KEY;
}

export function isOnchainEnabled(): boolean {
  return !!(process.env.CHAIN_PRIVATE_KEY && process.env.BASE_SEPOLIA_RPC_URL);
}
