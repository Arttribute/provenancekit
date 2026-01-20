/**
 * ProvenanceKit Indexer
 *
 * Blockchain event indexer for ProvenanceKit.
 * Syncs on-chain provenance events to off-chain storage.
 *
 * @packageDocumentation
 *
 * @example Basic Usage
 * ```typescript
 * import { ProvenanceIndexer } from "@provenancekit/indexer";
 * import { createDbStorage } from "@provenancekit/storage";
 *
 * // Create storage adapter
 * const storage = await createDbStorage({
 *   type: "postgres",
 *   query: sql,
 * });
 *
 * // Create indexer
 * const indexer = new ProvenanceIndexer({
 *   chain: {
 *     chainId: 8453,
 *     name: "Base",
 *     rpcUrl: "https://mainnet.base.org",
 *     contractAddress: "0x...",
 *   },
 *   storage,
 *   onEvent: (event) => {
 *     if (event.type === "syncing") {
 *       console.log(`Sync progress: ${event.progress.percentage.toFixed(1)}%`);
 *     }
 *   },
 * });
 *
 * // Start indexing (sync + watch)
 * await indexer.start();
 * ```
 *
 * @example Sync Only (No Watch)
 * ```typescript
 * // Just sync historical events without watching for new ones
 * await indexer.sync();
 * ```
 *
 * @example Custom Chain Configuration
 * ```typescript
 * import { ProvenanceIndexer, CHAIN_PRESETS } from "@provenancekit/indexer";
 *
 * const indexer = new ProvenanceIndexer({
 *   chain: {
 *     ...CHAIN_PRESETS.baseSepolia,
 *     rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
 *     contractAddress: "0x...",
 *     startBlock: 12345678n, // Start from specific block
 *   },
 *   storage,
 * });
 * ```
 */

// Main indexer class
export { ProvenanceIndexer } from "./indexer.js";

// Types
export type {
  // Configuration
  ChainConfig,
  IndexerConfig,
  // Events from blockchain
  ActionRecordedEvent,
  ResourceRegisteredEvent,
  EntityRegisteredEvent,
  AttributionRecordedEvent,
  ActionAttributionRecordedEvent,
  ProvenanceEvent,
  // Indexer state
  IndexerState,
  IndexerEvent,
  IndexerEventCallback,
  SyncProgress,
  // Chain presets
  ChainPreset,
} from "./types.js";

// Chain presets
export { CHAIN_PRESETS } from "./types.js";

// Contract ABI (for advanced usage)
export { PROVENANCE_REGISTRY_ABI, EVENT_SIGNATURES } from "./abi.js";

// Transforms (for custom indexers)
export {
  parseContentRef,
  transformActionRecorded,
  transformResourceRegistered,
  transformEntityRegistered,
  transformAttributionRecorded,
  transformActionAttributionRecorded,
  transformEvents,
  type TransformResult,
} from "./transforms.js";

// Errors
export {
  IndexerError,
  RpcError,
  DecodeError,
  StorageError,
  TransformError,
  BatchError,
  wrapError,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  type IndexerErrorCode,
  type RetryConfig,
} from "./errors.js";
