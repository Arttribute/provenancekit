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
} from "@arttribute/eaa-types";

/*-----------------------------------------------------------------*\
 | Core Types                                                        |
\*-----------------------------------------------------------------*/

/**
 * Filter options for querying resources
 */
export interface ResourceFilter {
  /** Filter by resource type */
  type?: string;
  /** Filter by creator entity ID */
  createdBy?: string;
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
   * If entity with same ID exists, update it (upsert behavior).
   */
  upsertEntity(entity: Entity): Promise<Entity>;

  /**
   * Get an entity by ID.
   * Returns null if not found.
   */
  getEntity(id: string): Promise<Entity | null>;

  /**
   * Check if an entity exists.
   */
  entityExists(id: string): Promise<boolean>;

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
    "findSimilar" in storage &&
    typeof storage.storeEmbedding === "function"
  );
}
