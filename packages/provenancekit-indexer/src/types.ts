/**
 * ProvenanceKit Indexer Types
 *
 * Configuration and event types for the blockchain indexer.
 */

import type { IProvenanceStorage, ISyncableStorage } from "@provenancekit/storage";

/*─────────────────────────────────────────────────────────────*\
 | Configuration Types                                          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Chain configuration for indexing
 */
export interface ChainConfig {
  /** Chain ID (e.g., 1 for Ethereum mainnet, 8453 for Base) */
  chainId: number;

  /** Human-readable chain name */
  name: string;

  /** RPC endpoint URL */
  rpcUrl: string;

  /** ProvenanceRegistry contract address on this chain */
  contractAddress: `0x${string}`;

  /** Block explorer URL (optional, for debugging) */
  explorerUrl?: string;

  /** Starting block for indexing (default: contract deployment block) */
  startBlock?: bigint;
}

/**
 * Indexer configuration
 */
export interface IndexerConfig {
  /** Chain to index */
  chain: ChainConfig;

  /** Storage backend (must support ISyncableStorage for tracking) */
  storage: IProvenanceStorage & Partial<ISyncableStorage>;

  /**
   * Polling interval in milliseconds for watching new blocks.
   * Default: 12000 (12 seconds, ~1 Ethereum block)
   */
  pollingInterval?: number;

  /**
   * Number of blocks to process per batch during historical sync.
   * Higher = faster but more memory. Default: 1000
   */
  batchSize?: number;

  /**
   * Number of confirmations to wait before considering a block final.
   * Default: 1 (for L2s), use higher for mainnet
   */
  confirmations?: number;

  /**
   * Maximum retries for failed RPC requests.
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Callback for indexer events (progress, errors, etc.)
   */
  onEvent?: IndexerEventCallback;
}

/*─────────────────────────────────────────────────────────────*\
 | Event Types (from smart contract)                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * ActionRecorded event from ProvenanceRegistry
 */
export interface ActionRecordedEvent {
  actionId: `0x${string}`;
  actionType: string;
  performer: `0x${string}`;
  inputs: string[];
  outputs: string[];
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/**
 * ResourceRegistered event from ProvenanceRegistry
 */
export interface ResourceRegisteredEvent {
  contentRef: string;
  resourceType: string;
  creator: `0x${string}`;
  rootAction: `0x${string}`;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/**
 * EntityRegistered event from ProvenanceRegistry
 */
export interface EntityRegisteredEvent {
  entityAddress: `0x${string}`;
  entityId: string;
  entityRole: string;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/**
 * AttributionRecorded event from ProvenanceRegistry
 */
export interface AttributionRecordedEvent {
  contentRef: string;
  entityAddress: `0x${string}`;
  role: string;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/**
 * ActionAttributionRecorded event from ProvenanceRegistry
 */
export interface ActionAttributionRecordedEvent {
  actionId: `0x${string}`;
  entityAddress: `0x${string}`;
  role: string;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/**
 * Union of all provenance events
 */
export type ProvenanceEvent =
  | { type: "ActionRecorded"; data: ActionRecordedEvent }
  | { type: "ResourceRegistered"; data: ResourceRegisteredEvent }
  | { type: "EntityRegistered"; data: EntityRegisteredEvent }
  | { type: "AttributionRecorded"; data: AttributionRecordedEvent }
  | { type: "ActionAttributionRecorded"; data: ActionAttributionRecordedEvent };

/*─────────────────────────────────────────────────────────────*\
 | Indexer State & Events                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Current state of the indexer
 */
export type IndexerState =
  | "idle"
  | "syncing"
  | "watching"
  | "paused"
  | "error";

/**
 * Sync progress information
 */
export interface SyncProgress {
  /** Current block being processed */
  currentBlock: bigint;
  /** Target block to sync to */
  targetBlock: bigint;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Events processed so far */
  eventsProcessed: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * Indexer event types for callbacks
 */
export type IndexerEvent =
  | { type: "started"; chainId: number }
  | { type: "syncing"; progress: SyncProgress }
  | { type: "synced"; blockNumber: bigint }
  | { type: "watching"; blockNumber: bigint }
  | { type: "newBlock"; blockNumber: bigint; eventsCount: number }
  | { type: "eventProcessed"; event: ProvenanceEvent }
  | { type: "error"; error: Error; recoverable: boolean }
  | { type: "stopped" };

/**
 * Callback for indexer events
 */
export type IndexerEventCallback = (event: IndexerEvent) => void;

/*─────────────────────────────────────────────────────────────*\
 | Preset Chain Configurations                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Preset chain configurations for common networks.
 * Users can override these or provide completely custom configs.
 */
export const CHAIN_PRESETS = {
  // Mainnets
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    explorerUrl: "https://etherscan.io",
  },
  base: {
    chainId: 8453,
    name: "Base",
    explorerUrl: "https://basescan.org",
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    explorerUrl: "https://arbiscan.io",
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    explorerUrl: "https://optimistic.etherscan.io",
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    explorerUrl: "https://polygonscan.com",
  },

  // Testnets
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    explorerUrl: "https://sepolia.basescan.org",
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    explorerUrl: "https://sepolia.arbiscan.io",
  },
} as const;

export type ChainPreset = keyof typeof CHAIN_PRESETS;
