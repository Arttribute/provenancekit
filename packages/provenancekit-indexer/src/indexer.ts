/**
 * ProvenanceKit Indexer
 *
 * Bridges on-chain provenance events to off-chain storage.
 * Supports historical sync and real-time watching.
 */

import {
  createPublicClient,
  http,
  type Log,
  parseAbiItem,
} from "viem";
import type { IProvenanceStorage, ISyncableStorage } from "@provenancekit/storage";
import { supportsSync } from "@provenancekit/storage";

import { PROVENANCE_REGISTRY_ABI } from "./abi.js";
import {
  transformActionRecorded,
  transformResourceRegistered,
  transformEntityRegistered,
  transformAttributionRecorded,
  transformActionAttributionRecorded,
} from "./transforms.js";
import type {
  IndexerConfig,
  IndexerState,
  IndexerEvent,
  IndexerEventCallback,
  SyncProgress,
  ActionRecordedEvent,
  ResourceRegisteredEvent,
  EntityRegisteredEvent,
  AttributionRecordedEvent,
  ActionAttributionRecordedEvent,
  ProvenanceEvent,
} from "./types.js";
import {
  RpcError,
  DecodeError,
  StorageError,
  withRetry,
} from "./errors.js";

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

const DEFAULT_POLLING_INTERVAL = 12_000; // 12 seconds
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_CONFIRMATIONS = 1;
const DEFAULT_MAX_RETRIES = 3;

/*─────────────────────────────────────────────────────────────*\
 | ProvenanceIndexer Class                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * ProvenanceIndexer
 *
 * Indexes provenance events from blockchain to storage.
 *
 * @example
 * ```typescript
 * const indexer = new ProvenanceIndexer({
 *   chain: {
 *     chainId: 8453,
 *     name: "Base",
 *     rpcUrl: "https://mainnet.base.org",
 *     contractAddress: "0x...",
 *   },
 *   storage: myStorageAdapter,
 *   onEvent: (event) => console.log(event),
 * });
 *
 * // Sync historical events then watch for new ones
 * await indexer.start();
 *
 * // Or just sync without watching
 * await indexer.sync();
 *
 * // Stop watching
 * await indexer.stop();
 * ```
 */
export class ProvenanceIndexer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any; // viem PublicClient - using any to avoid complex type inference
  private storage: IProvenanceStorage & Partial<ISyncableStorage>;
  private config: Required<
    Omit<IndexerConfig, "onEvent"> & { onEvent?: IndexerEventCallback }
  >;
  private state: IndexerState = "idle";
  private watchUnsubscribe?: () => void;
  private abortController?: AbortController;

  constructor(config: IndexerConfig) {
    // Validate config
    if (!config.chain.rpcUrl) {
      throw new Error("RPC URL is required");
    }
    if (!config.chain.contractAddress) {
      throw new Error("Contract address is required");
    }

    // Set defaults
    this.config = {
      chain: config.chain,
      storage: config.storage,
      pollingInterval: config.pollingInterval ?? DEFAULT_POLLING_INTERVAL,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      confirmations: config.confirmations ?? DEFAULT_CONFIRMATIONS,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      onEvent: config.onEvent,
    };

    this.storage = config.storage;

    // Create viem client
    this.client = createPublicClient({
      transport: http(config.chain.rpcUrl),
    });
  }

  /*──────────────────────────────────────────────────────────*\
   | Public API                                                |
  \*──────────────────────────────────────────────────────────*/

  /**
   * Get current indexer state
   */
  getState(): IndexerState {
    return this.state;
  }

  /**
   * Get chain ID being indexed
   */
  getChainId(): number {
    return this.config.chain.chainId;
  }

  /**
   * Start the indexer: sync historical events then watch for new ones
   */
  async start(): Promise<void> {
    if (this.state !== "idle" && this.state !== "paused") {
      throw new Error(`Cannot start indexer in state: ${this.state}`);
    }

    this.abortController = new AbortController();
    this.emit({ type: "started", chainId: this.config.chain.chainId });

    try {
      // First sync historical events
      await this.sync();

      // Then start watching for new events
      await this.watch();
    } catch (error) {
      this.state = "error";
      this.emit({
        type: "error",
        error: error as Error,
        recoverable: false,
      });
      throw error;
    }
  }

  /**
   * Sync historical events without watching
   */
  async sync(): Promise<void> {
    if (this.state === "syncing") {
      throw new Error("Already syncing");
    }

    this.state = "syncing";

    const chainId = this.config.chain.chainId;
    const currentBlock = await this.client.getBlockNumber();
    const safeBlock = currentBlock - BigInt(this.config.confirmations);

    // Get starting block
    let fromBlock: bigint;
    if (supportsSync(this.storage)) {
      const lastSynced = await this.storage.getLastSyncedBlock(chainId);
      fromBlock = lastSynced > 0 ? BigInt(lastSynced) + 1n : (this.config.chain.startBlock ?? 0n);
    } else {
      fromBlock = this.config.chain.startBlock ?? 0n;
    }

    // Skip if already synced
    if (fromBlock > safeBlock) {
      this.emit({ type: "synced", blockNumber: safeBlock });
      return;
    }

    let eventsProcessed = 0;
    const totalBlocks = Number(safeBlock - fromBlock);
    const startTime = Date.now();

    // Process in batches
    let currentFromBlock = fromBlock;
    while (currentFromBlock <= safeBlock) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        break;
      }

      const toBlock = currentFromBlock + BigInt(this.config.batchSize) - 1n;
      const batchToBlock = toBlock > safeBlock ? safeBlock : toBlock;

      // Fetch and process events
      const events = await this.fetchEvents(currentFromBlock, batchToBlock);
      await this.processEvents(events);
      eventsProcessed += events.length;

      // Update sync state
      if (supportsSync(this.storage)) {
        await this.storage.setLastSyncedBlock(chainId, Number(batchToBlock));
      }

      // Emit progress
      const blocksProcessed = Number(batchToBlock - fromBlock);
      const percentage = Math.min(100, (blocksProcessed / totalBlocks) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = blocksProcessed / elapsed;
      const remaining = rate > 0 ? (totalBlocks - blocksProcessed) / rate : undefined;

      this.emit({
        type: "syncing",
        progress: {
          currentBlock: batchToBlock,
          targetBlock: safeBlock,
          percentage,
          eventsProcessed,
          estimatedTimeRemaining: remaining,
        },
      });

      currentFromBlock = batchToBlock + 1n;
    }

    this.emit({ type: "synced", blockNumber: safeBlock });
  }

  /**
   * Watch for new events (call after sync)
   */
  async watch(): Promise<void> {
    if (this.state === "watching") {
      return;
    }

    this.state = "watching";
    const chainId = this.config.chain.chainId;

    // Get current block
    let lastProcessedBlock = await this.client.getBlockNumber();
    this.emit({ type: "watching", blockNumber: lastProcessedBlock });

    // Poll for new blocks
    const poll = async () => {
      try {
        const currentBlock = await this.client.getBlockNumber();
        const safeBlock = currentBlock - BigInt(this.config.confirmations);

        if (safeBlock > lastProcessedBlock) {
          const events = await this.fetchEvents(
            lastProcessedBlock + 1n,
            safeBlock
          );

          if (events.length > 0) {
            await this.processEvents(events);
          }

          // Update sync state
          if (supportsSync(this.storage)) {
            await this.storage.setLastSyncedBlock(chainId, Number(safeBlock));
          }

          this.emit({
            type: "newBlock",
            blockNumber: safeBlock,
            eventsCount: events.length,
          });

          lastProcessedBlock = safeBlock;
        }
      } catch (error) {
        this.emit({
          type: "error",
          error: error as Error,
          recoverable: true,
        });
      }
    };

    // Start polling
    const intervalId = setInterval(poll, this.config.pollingInterval);

    // Store unsubscribe function
    this.watchUnsubscribe = () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Stop the indexer
   */
  async stop(): Promise<void> {
    this.abortController?.abort();

    if (this.watchUnsubscribe) {
      this.watchUnsubscribe();
      this.watchUnsubscribe = undefined;
    }

    this.state = "idle";
    this.emit({ type: "stopped" });
  }

  /**
   * Pause watching (keeps sync state)
   */
  pause(): void {
    if (this.watchUnsubscribe) {
      this.watchUnsubscribe();
      this.watchUnsubscribe = undefined;
    }
    this.state = "paused";
  }

  /**
   * Resume watching after pause
   */
  async resume(): Promise<void> {
    if (this.state !== "paused") {
      throw new Error("Can only resume from paused state");
    }
    await this.watch();
  }

  /*──────────────────────────────────────────────────────────*\
   | Private Methods                                           |
  \*──────────────────────────────────────────────────────────*/

  /**
   * Emit an event to the callback
   */
  private emit(event: IndexerEvent): void {
    this.config.onEvent?.(event);
  }

  /**
   * Fetch events from a block range
   */
  private async fetchEvents(
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<ProvenanceEvent[]> {
    const events: ProvenanceEvent[] = [];

    // Fetch all event types in parallel
    const [
      actionLogs,
      resourceLogs,
      entityLogs,
      attrLogs,
      actionAttrLogs,
    ] = await Promise.all([
      this.fetchLogs("ActionRecorded", fromBlock, toBlock),
      this.fetchLogs("ResourceRegistered", fromBlock, toBlock),
      this.fetchLogs("EntityRegistered", fromBlock, toBlock),
      this.fetchLogs("AttributionRecorded", fromBlock, toBlock),
      this.fetchLogs("ActionAttributionRecorded", fromBlock, toBlock),
    ]);

    // Parse ActionRecorded
    for (const log of actionLogs) {
      const decoded = this.decodeActionRecorded(log);
      if (decoded) {
        events.push({ type: "ActionRecorded", data: decoded });
      }
    }

    // Parse ResourceRegistered
    for (const log of resourceLogs) {
      const decoded = this.decodeResourceRegistered(log);
      if (decoded) {
        events.push({ type: "ResourceRegistered", data: decoded });
      }
    }

    // Parse EntityRegistered
    for (const log of entityLogs) {
      const decoded = this.decodeEntityRegistered(log);
      if (decoded) {
        events.push({ type: "EntityRegistered", data: decoded });
      }
    }

    // Parse AttributionRecorded
    for (const log of attrLogs) {
      const decoded = this.decodeAttributionRecorded(log);
      if (decoded) {
        events.push({ type: "AttributionRecorded", data: decoded });
      }
    }

    // Parse ActionAttributionRecorded
    for (const log of actionAttrLogs) {
      const decoded = this.decodeActionAttributionRecorded(log);
      if (decoded) {
        events.push({ type: "ActionAttributionRecorded", data: decoded });
      }
    }

    // Sort by block number and log index for consistent ordering
    events.sort((a, b) => {
      const blockDiff = Number(a.data.blockNumber - b.data.blockNumber);
      if (blockDiff !== 0) return blockDiff;
      return a.data.logIndex - b.data.logIndex;
    });

    return events;
  }

  /**
   * Fetch logs for a specific event type with retry logic
   */
  private async fetchLogs(
    eventName: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<Log[]> {
    const abiItem = PROVENANCE_REGISTRY_ABI.find(
      (item) => item.type === "event" && item.name === eventName
    );

    if (!abiItem) {
      return [];
    }

    try {
      return await withRetry(
        async () => {
          const logs = await this.client.getLogs({
            address: this.config.chain.contractAddress,
            event: parseAbiItem(
              `event ${eventName}(${abiItem.inputs
                .map((i) => `${i.type}${i.indexed ? " indexed" : ""} ${i.name}`)
                .join(", ")})`
            ) as any,
            fromBlock,
            toBlock,
          });
          return logs;
        },
        { maxAttempts: this.config.maxRetries }
      );
    } catch (error) {
      // Wrap and emit the error, but don't throw - allow indexer to continue
      const rpcError = new RpcError(
        `Failed to fetch ${eventName} logs (blocks ${fromBlock}-${toBlock})`,
        "getLogs",
        error instanceof Error ? error : undefined,
        { eventName, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }
      );

      this.emit({
        type: "error",
        error: rpcError,
        recoverable: rpcError.recoverable,
      });

      return [];
    }
  }

  /**
   * Decode ActionRecorded log
   */
  private decodeActionRecorded(log: Log): ActionRecordedEvent | null {
    try {
      const args = (log as any).args;
      return {
        actionId: args.actionId,
        actionType: args.actionType,
        performer: args.performer,
        inputs: args.inputs,
        outputs: args.outputs,
        timestamp: args.timestamp,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex!,
      };
    } catch (error) {
      this.emitDecodeError("ActionRecorded", log, error);
      return null;
    }
  }

  /**
   * Decode ResourceRegistered log
   */
  private decodeResourceRegistered(log: Log): ResourceRegisteredEvent | null {
    try {
      const args = (log as any).args;
      return {
        contentRef: args.contentRef,
        resourceType: args.resourceType,
        creator: args.creator,
        rootAction: args.rootAction,
        timestamp: args.timestamp,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex!,
      };
    } catch (error) {
      this.emitDecodeError("ResourceRegistered", log, error);
      return null;
    }
  }

  /**
   * Decode EntityRegistered log
   */
  private decodeEntityRegistered(log: Log): EntityRegisteredEvent | null {
    try {
      const args = (log as any).args;
      return {
        entityAddress: args.entityAddress,
        entityId: args.entityId,
        entityRole: args.entityRole,
        timestamp: args.timestamp,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex!,
      };
    } catch (error) {
      this.emitDecodeError("EntityRegistered", log, error);
      return null;
    }
  }

  /**
   * Decode AttributionRecorded log
   */
  private decodeAttributionRecorded(log: Log): AttributionRecordedEvent | null {
    try {
      const args = (log as any).args;
      return {
        contentRef: args.contentRef,
        entityAddress: args.entityAddress,
        role: args.role,
        timestamp: args.timestamp,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex!,
      };
    } catch (error) {
      this.emitDecodeError("AttributionRecorded", log, error);
      return null;
    }
  }

  /**
   * Decode ActionAttributionRecorded log
   */
  private decodeActionAttributionRecorded(
    log: Log
  ): ActionAttributionRecordedEvent | null {
    try {
      const args = (log as any).args;
      return {
        actionId: args.actionId,
        entityAddress: args.entityAddress,
        role: args.role,
        timestamp: args.timestamp,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex!,
      };
    } catch (error) {
      this.emitDecodeError("ActionAttributionRecorded", log, error);
      return null;
    }
  }

  /**
   * Emit a decode error event
   */
  private emitDecodeError(eventType: string, log: Log, error: unknown): void {
    const decodeError = new DecodeError(
      `Failed to decode ${eventType} event`,
      eventType,
      log,
      error instanceof Error ? error : undefined
    );

    this.emit({
      type: "error",
      error: decodeError,
      recoverable: false, // Decode errors are not recoverable via retry
    });
  }

  /**
   * Process events and store them
   */
  private async processEvents(events: ProvenanceEvent[]): Promise<void> {
    const chainId = this.config.chain.chainId;
    let successCount = 0;
    let failureCount = 0;

    for (const event of events) {
      try {
        switch (event.type) {
          case "ActionRecorded": {
            const action = transformActionRecorded(event.data, chainId);
            await this.storage.createAction(action);

            // Mark as synced if storage supports it
            if (supportsSync(this.storage)) {
              await this.storage.markActionSynced(
                action.id,
                event.data.transactionHash,
                chainId
              );
            }
            break;
          }

          case "ResourceRegistered": {
            const resource = transformResourceRegistered(event.data, chainId);
            // Check if resource already exists (idempotent)
            const exists = await this.storage.resourceExists(
              resource.address.ref
            );
            if (!exists) {
              await this.storage.createResource(resource);
            }
            break;
          }

          case "EntityRegistered": {
            const entity = transformEntityRegistered(event.data, chainId);
            await this.storage.upsertEntity(entity);
            break;
          }

          case "AttributionRecorded": {
            const attribution = transformAttributionRecorded(event.data, chainId);
            await this.storage.createAttribution(attribution);
            break;
          }

          case "ActionAttributionRecorded": {
            const attribution = transformActionAttributionRecorded(
              event.data,
              chainId
            );
            await this.storage.createAttribution(attribution);
            break;
          }
        }

        successCount++;
        this.emit({ type: "eventProcessed", event });
      } catch (error) {
        failureCount++;

        // Wrap the error with context
        const storageError = new StorageError(
          `Failed to store ${event.type} event`,
          event.type,
          error instanceof Error ? error : undefined,
          {
            blockNumber: event.data.blockNumber.toString(),
            transactionHash: event.data.transactionHash,
            logIndex: event.data.logIndex,
          }
        );

        this.emit({
          type: "error",
          error: storageError,
          recoverable: storageError.recoverable,
        });

        // Continue processing other events even if one fails
      }
    }

    // Log summary if there were failures
    if (failureCount > 0) {
      this.emit({
        type: "batchComplete",
        successCount,
        failureCount,
        totalEvents: events.length,
      } as any); // Type will be extended
    }
  }
}
