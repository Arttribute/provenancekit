/**
 * Known EVM network registry.
 *
 * Used by the dashboard to resolve chain names, explorer URLs, and testnet status
 * from chain IDs stored in projects and in ext:onchain@1.0.0 provenance data.
 */

export interface KnownNetwork {
  chainId: number;
  name: string;
  shortName: string;
  isTestnet: boolean;
  explorerUrl: string;
  rpcDefault?: string;
}

export const KNOWN_NETWORKS: KnownNetwork[] = [
  // ── Base ──────────────────────────────────────────────────────────────────
  {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    isTestnet: false,
    explorerUrl: "https://basescan.org",
    rpcDefault: "https://mainnet.base.org",
  },
  {
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    isTestnet: true,
    explorerUrl: "https://sepolia.basescan.org",
    rpcDefault: "https://sepolia.base.org",
  },
  // ── Ethereum ──────────────────────────────────────────────────────────────
  {
    chainId: 1,
    name: "Ethereum",
    shortName: "ETH",
    isTestnet: false,
    explorerUrl: "https://etherscan.io",
    rpcDefault: "https://eth.llamarpc.com",
  },
  {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    isTestnet: true,
    explorerUrl: "https://sepolia.etherscan.io",
    rpcDefault: "https://rpc.sepolia.org",
  },
  // ── Polygon ───────────────────────────────────────────────────────────────
  {
    chainId: 137,
    name: "Polygon",
    shortName: "Polygon",
    isTestnet: false,
    explorerUrl: "https://polygonscan.com",
    rpcDefault: "https://polygon-rpc.com",
  },
  {
    chainId: 80002,
    name: "Polygon Amoy",
    shortName: "Amoy",
    isTestnet: true,
    explorerUrl: "https://amoy.polygonscan.com",
  },
  // ── Arbitrum ──────────────────────────────────────────────────────────────
  {
    chainId: 42161,
    name: "Arbitrum One",
    shortName: "Arbitrum",
    isTestnet: false,
    explorerUrl: "https://arbiscan.io",
  },
  {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    shortName: "Arb Sepolia",
    isTestnet: true,
    explorerUrl: "https://sepolia.arbiscan.io",
  },
  // ── Optimism ──────────────────────────────────────────────────────────────
  {
    chainId: 10,
    name: "Optimism",
    shortName: "OP",
    isTestnet: false,
    explorerUrl: "https://optimistic.etherscan.io",
  },
  {
    chainId: 11155420,
    name: "Optimism Sepolia",
    shortName: "OP Sepolia",
    isTestnet: true,
    explorerUrl: "https://sepolia-optimism.etherscan.io",
  },
  // ── Gnosis ────────────────────────────────────────────────────────────────
  {
    chainId: 100,
    name: "Gnosis",
    shortName: "Gnosis",
    isTestnet: false,
    explorerUrl: "https://gnosisscan.io",
  },
  // ── BNB ───────────────────────────────────────────────────────────────────
  {
    chainId: 56,
    name: "BNB Smart Chain",
    shortName: "BSC",
    isTestnet: false,
    explorerUrl: "https://bscscan.com",
  },
  // ── Avalanche ─────────────────────────────────────────────────────────────
  {
    chainId: 43114,
    name: "Avalanche",
    shortName: "AVAX",
    isTestnet: false,
    explorerUrl: "https://snowtrace.io",
  },
];

const NETWORKS_BY_ID = new Map(KNOWN_NETWORKS.map((n) => [n.chainId, n]));

/** Resolve a known network by chain ID, or return null for custom/unknown chains. */
export function getNetwork(chainId: number): KnownNetwork | null {
  return NETWORKS_BY_ID.get(chainId) ?? null;
}

/** Get a human-readable name for a chain ID, falling back to "Chain {id}". */
export function getChainName(chainId: number, fallback?: string): string {
  return NETWORKS_BY_ID.get(chainId)?.name ?? fallback ?? `Chain ${chainId}`;
}

/** Get the block explorer base URL for a chain ID. */
export function getExplorerUrl(chainId: number): string | null {
  return NETWORKS_BY_ID.get(chainId)?.explorerUrl ?? null;
}

/** Build a link to a specific tx hash on the block explorer. */
export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const base = getExplorerUrl(chainId);
  return base ? `${base}/tx/${txHash}` : null;
}

/** Build a link to a specific address on the block explorer. */
export function explorerAddressUrl(chainId: number, address: string): string | null {
  const base = getExplorerUrl(chainId);
  return base ? `${base}/address/${address}` : null;
}

/** Returns true if the chain ID is a testnet. */
export function isTestnet(chainId: number): boolean {
  return NETWORKS_BY_ID.get(chainId)?.isTestnet ?? false;
}

/** Returns the short display name for the network badge. */
export function getNetworkBadgeLabel(chainId: number, chainName?: string | null): string {
  const known = NETWORKS_BY_ID.get(chainId);
  if (known) return known.name;
  return chainName ?? `Chain ${chainId}`;
}
