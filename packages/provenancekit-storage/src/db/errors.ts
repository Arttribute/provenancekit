/**
 * Database storage error codes
 */
export type DbStorageErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "CONNECTION_ERROR"
  | "QUERY_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_INITIALIZED"
  | "TRANSACTION_ERROR";

/**
 * Base error class for database storage operations.
 */
export class DbStorageError extends Error {
  readonly code: DbStorageErrorCode;
  readonly details?: unknown;

  constructor(code: DbStorageErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DbStorageError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown when a requested resource/entity/action is not found.
 */
export class NotFoundError extends DbStorageError {
  constructor(type: string, id: string) {
    super("NOT_FOUND", `${type} not found: ${id}`, { type, id });
  }
}

/**
 * Thrown when trying to create something that already exists.
 */
export class AlreadyExistsError extends DbStorageError {
  constructor(type: string, id: string) {
    super("ALREADY_EXISTS", `${type} already exists: ${id}`, { type, id });
  }
}

/**
 * Thrown when storage is not initialized.
 */
export class DbNotInitializedError extends DbStorageError {
  constructor() {
    super("NOT_INITIALIZED", "Storage not initialized. Call initialize() first.");
  }
}

/**
 * Thrown when a database connection fails.
 */
export class ConnectionError extends DbStorageError {
  constructor(message: string, cause?: unknown) {
    super("CONNECTION_ERROR", message, cause);
  }
}

/**
 * Thrown when a query fails.
 */
export class QueryError extends DbStorageError {
  constructor(message: string, cause?: unknown) {
    super("QUERY_ERROR", message, cause);
  }
}
