/**
 * ProvenanceKit Database Storage Interface
 *
 * Defines the contract for provenance data storage backends.
 * Implementations can use any database (PostgreSQL, MongoDB, SQLite, etc.)
 *
 * Design principles:
 * - Minimal: Only core provenance operations
 * - Flexible: No assumptions about specific database features
 * - Composable: Optional capabilities can be added via extensions
 */

import type {
  Entity,
  Resource,
  Action,
  Attribution,
} from "@provenancekit/eaa-types";

/*-----------------------------------------------------------------*\
 | Ownership State Type                                              |
\*-----------------------------------------------------------------*/

/**
 * Materialized ownership state for a resource.
 *
 * This is a fast-query cache derived from the ownership action chain
 * (pk_action rows of type ext:ownership:transfer@1.0.0). The provenance
 * action chain is always the authoritative source of truth; this record
 * exists so "who owns this now?" is a cheap single-row lookup.
 *
 * - `currentOwnerId` starts as the resource's registrant (created_by) and
 *   updates atomically each time a transfer Action is recorded.
 * - `lastTransferId` is null when ownership has never been transferred.
 */
export interface OwnershipState {
  /** Content reference of the owned resource */
  resourceRef: string;
  /** Entity ID of the current authoritative owner */
  currentOwnerId: string;
  /** Action ID of the most recent transfer, or null if never transferred */
  lastTransferId: string | null;
  /** ISO 8601 timestamp of the last ownership change */
  updatedAt: string;
}

/*-----------------------------------------------------------------*\
 | Core Types                                                        |
\*-----------------------------------------------------------------*/

/**
 * Filter options for querying entities
 */
export interface EntityFilter {
  /** Filter by entity role */
  role?: string;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Filter options for querying resources
 */
export interface ResourceFilter {
  /** Filter by resource type */
  type?: string;
  /** Filter by creator entity ID */
  createdBy?: string;
  /** Filter resources created at or after this timestamp (ISO 8601) */
  createdAfter?: string;
  /** Filter resources created at or before this timestamp (ISO 8601) */
  createdBefore?: string;
  /** Filter by extension key-value pairs (JSONB contains — supports nested objects) */
  extensions?: Record<string, unknown>;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Filter options for querying actions
 */
export interface ActionFilter {
  /** Filter by action type */
  type?: string;
  /** Filter by performer entity ID */
  performedBy?: string;
  /** Filter actions at or after this timestamp (ISO 8601) */
  timestampAfter?: string;
  /** Filter actions at or before this timestamp (ISO 8601) */
  timestampBefore?: string;
  /** Filter by extension key-value pairs (JSONB contains — supports nested objects) */
  extensions?: Record<string, unknown>;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Filter options for querying attributions
 */
export interface AttributionFilter {
  /** Filter by entity ID */
  entityId?: string;
  /** Filter by role */
  role?: string;
  /** Limit number of results */
  limit?: number;
}

/*-----------------------------------------------------------------*\
 | Core Storage Interface                                            |
\*-----------------------------------------------------------------*/

/**
 * Core provenance storage interface.
 *
 * Implementations must provide these methods for basic provenance tracking.
 * This is the minimum required for a ProvenanceKit-compatible storage backend.
 */
export interface IProvenanceStorage {
  /*--------------------------------------------------------------
   | Entity Operations
   --------------------------------------------------------------*/

  /**
   * Create or update an entity.
   * If entity with same ID exists, update mutable fields.
   *
   * IMPORTANT: If the entity already exists with a publicKey, and the
   * incoming entity has a DIFFERENT publicKey, implementations MUST reject
   * the operation by throwing an error. Public keys are immutable after
   * first registration (first-registration-wins). This prevents entity
   * impersonation via key replacement.
   *
   * Mutable fields: name, metadata, extensions, role
   * Immutable fields: id, publicKey (once set)
   */
  upsertEntity(entity: Entity): Promise<Entity>;

  /**
   * Update mutable fields of an existing entity.
   * Cannot change: id, publicKey.
   *
   * @param id - The entity ID
   * @param update - Partial entity fields to update (name, metadata, extensions)
   * @returns The updated entity, or null if entity not found
   */
  updateEntity(
    id: string,
    update: Partial<Pick<Entity, "name" | "metadata" | "extensions">>
  ): Promise<Entity | null>;

  /**
   * Get an entity by ID.
   * Returns null if not found.
   */
  getEntity(id: string): Promise<Entity | null>;

  /**
   * Check if an entity exists.
   */
  entityExists(id: string): Promise<boolean>;

  /**
   * List entities with optional filtering.
   */
  listEntities(filter?: EntityFilter): Promise<Entity[]>;

  /*--------------------------------------------------------------
   | Resource Operations
   --------------------------------------------------------------*/

  /**
   * Create a new resource.
   * The resource's address.ref is used as the primary identifier.
   *
   * @throws If resource with same ref already exists (use resourceExists to check first)
   */
  createResource(resource: Resource): Promise<Resource>;

  /**
   * Get a resource by its content reference.
   * Returns null if not found.
   *
   * @param ref - The content reference string (e.g., CID)
   */
  getResource(ref: string): Promise<Resource | null>;

  /**
   * Get a resource by the integrity hash stored in its address.
   *
   * The integrity field stores `sha256:{hex}` for unencrypted resources.
   * This enables a fast pre-upload duplicate check without knowing the CID:
   * compute SHA-256 locally, query the DB, skip the IPFS upload if found.
   *
   * Returns null if not found or if the adapter does not support the query.
   */
  getResourceByIntegrity(integrity: string): Promise<Resource | null>;

  /**
   * Check if a resource exists by its content reference.
   * Use this for deduplication before creating.
   *
   * @param ref - The content reference string (e.g., CID)
   */
  resourceExists(ref: string): Promise<boolean>;

  /**
   * List resources with optional filtering.
   */
  listResources(filter?: ResourceFilter): Promise<Resource[]>;

  /*--------------------------------------------------------------
   | Action Operations
   --------------------------------------------------------------*/

  /**
   * Create a new action.
   */
  createAction(action: Action): Promise<Action>;

  /**
   * Get an action by ID.
   * Returns null if not found.
   */
  getAction(id: string): Promise<Action | null>;

  /**
   * Find actions that produced a specific output.
   * Used for provenance graph traversal.
   *
   * @param ref - The output content reference string
   */
  getActionsByOutput(ref: string): Promise<Action[]>;

  /**
   * Find actions that consumed a specific input.
   *
   * @param ref - The input content reference string
   */
  getActionsByInput(ref: string): Promise<Action[]>;

  /**
   * List actions with optional filtering.
   */
  listActions(filter?: ActionFilter): Promise<Action[]>;

  /**
   * Update an existing action.
   * Only the provided fields are updated (partial update).
   * Returns the updated action, or null if not found.
   *
   * @param id - The action ID
   * @param update - Partial action fields to update
   */
  updateAction(
    id: string,
    update: Partial<Pick<Action, "extensions" | "proof">>
  ): Promise<Action | null>;

  /*--------------------------------------------------------------
   | Attribution Operations
   --------------------------------------------------------------*/

  /**
   * Create a new attribution.
   */
  createAttribution(attribution: Attribution): Promise<Attribution>;

  /**
   * Get attributions for a resource.
   *
   * @param ref - The resource content reference string
   */
  getAttributionsByResource(ref: string): Promise<Attribution[]>;

  /**
   * Get attributions for an action.
   *
   * @param actionId - The action ID
   */
  getAttributionsByAction(actionId: string): Promise<Attribution[]>;

  /**
   * Get all attributions for an entity.
   *
   * @param entityId - The entity ID
   */
  getAttributionsByEntity(
    entityId: string,
    filter?: AttributionFilter
  ): Promise<Attribution[]>;

  /*--------------------------------------------------------------
   | Ownership Operations
   --------------------------------------------------------------*/

  /**
   * Initialize the ownership state for a newly created resource.
   * Sets the current owner to the registrant (created_by entity).
   * Called once immediately after createResource().
   *
   * @param resourceRef - The resource content reference (CID)
   * @param ownerId     - The registrant entity ID (same as resource.createdBy)
   */
  initOwnershipState(resourceRef: string, ownerId: string): Promise<void>;

  /**
   * Get the current ownership state for a resource.
   * Returns null if the resource has no ownership state record
   * (e.g. resources created before migration 002).
   *
   * @param resourceRef - The resource content reference (CID)
   */
  getOwnershipState(resourceRef: string): Promise<OwnershipState | null>;

  /**
   * Update the ownership state to reflect a completed transfer.
   * Called atomically alongside createAction() for a transfer Action.
   *
   * @param resourceRef      - The resource content reference (CID)
   * @param newOwnerId       - Entity ID of the new owner
   * @param transferActionId - Action ID of the transfer event
   */
  transferOwnershipState(
    resourceRef: string,
    newOwnerId: string,
    transferActionId: string
  ): Promise<void>;

  /**
   * Get all ownership-related Actions for a resource in ascending
   * timestamp order (oldest first). Returns both claim Actions
   * (ext:ownership:claim@1.0.0) and transfer Actions
   * (ext:ownership:transfer@1.0.0) so callers can reconstruct the
   * full ownership history from the immutable provenance chain.
   *
   * @param resourceRef - The resource content reference (CID)
   */
  getOwnershipHistory(resourceRef: string): Promise<Action[]>;

  /*--------------------------------------------------------------
   | Lifecycle
   --------------------------------------------------------------*/

  /**
   * Initialize the storage backend.
   * Called once before any operations.
   * Use for connection setup, schema creation, etc.
   */
  initialize(): Promise<void>;

  /**
   * Close the storage backend.
   * Called when shutting down.
   * Use for connection cleanup.
   */
  close(): Promise<void>;
}

/*-----------------------------------------------------------------*\
 | Optional Capabilities                                             |
\*-----------------------------------------------------------------*/

/**
 * Optional: Transaction support.
 * Implement if your backend supports atomic operations.
 */
export interface ITransactionalStorage {
  /**
   * Execute operations within a transaction.
   * All operations succeed or all fail.
   */
  transaction<T>(
    fn: (storage: IProvenanceStorage) => Promise<T>
  ): Promise<T>;
}

/**
 * Optional: Vector/embedding support.
 * Implement if your backend supports vector similarity search.
 */
export interface IVectorStorage {
  /**
   * Store an embedding vector for a resource.
   *
   * @param ref - The resource content reference
   * @param vector - The embedding vector (array of numbers)
   */
  storeEmbedding(ref: string, vector: number[]): Promise<void>;

  /**
   * Get the embedding vector for a resource.
   * Returns null if no embedding exists for the given ref.
   *
   * @param ref - The resource content reference
   */
  getEmbedding(ref: string): Promise<number[] | null>;

  /**
   * Find similar resources by vector similarity.
   *
   * @param vector - The query vector
   * @param options - Search options
   */
  findSimilar(
    vector: number[],
    options?: {
      limit?: number;
      minScore?: number;
      type?: string;
    }
  ): Promise<Array<{ ref: string; score: number }>>;
}

/**
 * Optional: Encrypted vector storage.
 *
 * Stores embedding vectors as opaque encrypted blobs — the server cannot
 * read or search them. Only the key holder can decrypt and search client-side.
 * This preserves confidentiality: no semantic information leaks to the server.
 */
export interface IEncryptedVectorStorage {
  /**
   * Store an encrypted embedding blob for a resource.
   * @param ref - The resource content reference
   * @param blob - JSON-serialized EncryptionEnvelope (opaque to server)
   * @param kind - Resource kind (image, text, audio, etc.)
   */
  storeEncryptedEmbedding(
    ref: string,
    blob: string,
    kind?: string
  ): Promise<void>;

  /**
   * Get a single encrypted embedding blob by resource ref.
   */
  getEncryptedEmbedding(
    ref: string
  ): Promise<{ blob: string; kind?: string } | null>;

  /**
   * List encrypted embeddings for delta sync.
   * Supports pagination via `since` timestamp so the SDK only
   * fetches new/changed vectors after initial sync.
   */
  listEncryptedEmbeddings(opts?: {
    since?: string;
    kind?: string;
    limit?: number;
  }): Promise<
    Array<{ ref: string; blob: string; kind?: string; createdAt: string }>
  >;
}

/*-----------------------------------------------------------------*\
 | Type Guards                                                       |
\*-----------------------------------------------------------------*/

/**
 * Optional: Blockchain sync tracking.
 * Implement if your backend needs to track synchronization state with on-chain data.
 */
export interface ISyncableStorage {
  /**
   * Get the last synced block number for a specific chain.
   *
   * @param chainId - The blockchain chain ID
   * @returns The last synced block number, or 0 if never synced
   */
  getLastSyncedBlock(chainId: number): Promise<number>;

  /**
   * Set the last synced block number for a specific chain.
   *
   * @param chainId - The blockchain chain ID
   * @param blockNumber - The block number that was just synced
   */
  setLastSyncedBlock(chainId: number, blockNumber: number): Promise<void>;

  /**
   * Mark an action as synced to blockchain.
   *
   * @param actionId - The action ID
   * @param txHash - The transaction hash on-chain
   * @param chainId - The blockchain chain ID
   */
  markActionSynced(
    actionId: string,
    txHash: string,
    chainId: number
  ): Promise<void>;

  /**
   * Get actions that haven't been synced to blockchain yet.
   *
   * @param chainId - Optional chain ID to filter by
   * @param limit - Maximum number of actions to return
   */
  getPendingActions(chainId?: number, limit?: number): Promise<Action[]>;

  /**
   * Check if an action has been synced to a specific chain.
   *
   * @param actionId - The action ID
   * @param chainId - The blockchain chain ID
   */
  isActionSynced(actionId: string, chainId: number): Promise<boolean>;
}

/**
 * Callback types for subscription events.
 */
export type ResourceCallback = (resource: Resource) => void;
export type ActionCallback = (action: Action) => void;
export type AttributionCallback = (attribution: Attribution) => void;

/**
 * Unsubscribe function returned by subscription methods.
 */
export type Unsubscribe = () => void;

/**
 * Optional: Real-time subscription support.
 * Implement if your backend supports watching for changes.
 */
export interface ISubscribableStorage {
  /**
   * Subscribe to new resources.
   *
   * @param callback - Called when a new resource is created
   * @param filter - Optional filter to limit which resources trigger the callback
   * @returns Unsubscribe function
   */
  subscribeToResources(
    callback: ResourceCallback,
    filter?: ResourceFilter
  ): Unsubscribe;

  /**
   * Subscribe to new actions.
   *
   * @param callback - Called when a new action is created
   * @param filter - Optional filter to limit which actions trigger the callback
   * @returns Unsubscribe function
   */
  subscribeToActions(
    callback: ActionCallback,
    filter?: ActionFilter
  ): Unsubscribe;

  /**
   * Subscribe to new attributions.
   *
   * @param callback - Called when a new attribution is created
   * @param filter - Optional filter to limit which attributions trigger the callback
   * @returns Unsubscribe function
   */
  subscribeToAttributions(
    callback: AttributionCallback,
    filter?: AttributionFilter
  ): Unsubscribe;
}

/*-----------------------------------------------------------------*\
 | Type Guards                                                       |
\*-----------------------------------------------------------------*/

/**
 * Type guard to check if storage supports transactions.
 */
export function supportsTransactions(
  storage: IProvenanceStorage
): storage is IProvenanceStorage & ITransactionalStorage {
  return "transaction" in storage && typeof storage.transaction === "function";
}

/**
 * Type guard to check if storage supports vector search.
 */
export function supportsVectors(
  storage: IProvenanceStorage
): storage is IProvenanceStorage & IVectorStorage {
  return (
    "storeEmbedding" in storage &&
    "getEmbedding" in storage &&
    "findSimilar" in storage &&
    typeof storage.storeEmbedding === "function"
  );
}

/**
 * Type guard to check if storage supports encrypted vector storage.
 */
export function supportsEncryptedVectors(
  storage: IProvenanceStorage
): storage is IProvenanceStorage & IEncryptedVectorStorage {
  return (
    "storeEncryptedEmbedding" in storage &&
    "listEncryptedEmbeddings" in storage &&
    typeof storage.storeEncryptedEmbedding === "function"
  );
}

/**
 * Type guard to check if storage supports blockchain sync tracking.
 */
export function supportsSync(
  storage: IProvenanceStorage
): storage is IProvenanceStorage & ISyncableStorage {
  return (
    "getLastSyncedBlock" in storage &&
    "markActionSynced" in storage &&
    typeof storage.getLastSyncedBlock === "function"
  );
}

/**
 * Type guard to check if storage supports subscriptions.
 */
export function supportsSubscriptions(
  storage: IProvenanceStorage
): storage is IProvenanceStorage & ISubscribableStorage {
  return (
    "subscribeToResources" in storage &&
    "subscribeToActions" in storage &&
    typeof storage.subscribeToResources === "function"
  );
}
