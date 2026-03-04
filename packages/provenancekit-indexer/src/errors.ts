/**
 * Indexer Error Classes
 *
 * Structured error handling for the ProvenanceKit indexer.
 */

/**
 * Base class for all indexer errors
 */
export class IndexerError extends Error {
  constructor(
    message: string,
    public readonly code: IndexerErrorCode,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "IndexerError";
  }

  /**
   * Whether this error is recoverable (can retry)
   */
  get recoverable(): boolean {
    return RECOVERABLE_ERRORS.includes(this.code);
  }

  /**
   * Convert to plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      recoverable: this.recoverable,
      cause: this.cause?.message,
    };
  }
}

/**
 * Error codes for categorizing indexer errors
 */
export type IndexerErrorCode =
  // RPC/Network errors
  | "RPC_ERROR"
  | "RPC_TIMEOUT"
  | "RPC_RATE_LIMITED"
  | "NETWORK_ERROR"
  // Decoding errors
  | "DECODE_ERROR"
  | "INVALID_LOG"
  | "MISSING_FIELD"
  // Storage errors
  | "STORAGE_ERROR"
  | "STORAGE_CONFLICT"
  | "STORAGE_NOT_FOUND"
  // Transform errors
  | "TRANSFORM_ERROR"
  | "INVALID_DATA"
  // General errors
  | "UNKNOWN_ERROR"
  | "ABORTED"
  | "INVALID_STATE";

/**
 * Errors that can potentially be recovered from with a retry
 */
const RECOVERABLE_ERRORS: IndexerErrorCode[] = [
  "RPC_ERROR",
  "RPC_TIMEOUT",
  "RPC_RATE_LIMITED",
  "NETWORK_ERROR",
  "STORAGE_ERROR",
];

/**
 * RPC-specific error for blockchain interactions
 */
export class RpcError extends IndexerError {
  constructor(
    message: string,
    public readonly rpcMethod: string,
    cause?: Error,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      cause?.message?.includes("rate")
        ? "RPC_RATE_LIMITED"
        : cause?.message?.includes("timeout")
          ? "RPC_TIMEOUT"
          : "RPC_ERROR",
      { ...details, rpcMethod },
      cause
    );
    this.name = "RpcError";
  }
}

/**
 * Error when decoding event logs
 */
export class DecodeError extends IndexerError {
  constructor(
    message: string,
    public readonly eventType: string,
    public readonly log: unknown,
    cause?: Error
  ) {
    super(
      message,
      "DECODE_ERROR",
      { eventType, logBlockNumber: (log as any)?.blockNumber },
      cause
    );
    this.name = "DecodeError";
  }
}

/**
 * Error during storage operations
 */
export class StorageError extends IndexerError {
  constructor(
    message: string,
    public readonly operation: string,
    cause?: Error,
    details?: Record<string, unknown>
  ) {
    const code =
      cause?.message?.includes("already exists")
        ? "STORAGE_CONFLICT"
        : cause?.message?.includes("not found")
          ? "STORAGE_NOT_FOUND"
          : "STORAGE_ERROR";
    super(message, code, { ...details, operation }, cause);
    this.name = "StorageError";
  }
}

/**
 * Error during event transformation
 */
export class TransformError extends IndexerError {
  constructor(
    message: string,
    public readonly eventType: string,
    cause?: Error,
    details?: Record<string, unknown>
  ) {
    super(message, "TRANSFORM_ERROR", { ...details, eventType }, cause);
    this.name = "TransformError";
  }
}

/**
 * Utility to wrap unknown errors
 */
export function wrapError(error: unknown, defaultMessage: string): IndexerError {
  if (error instanceof IndexerError) {
    return error;
  }

  if (error instanceof Error) {
    return new IndexerError(
      error.message || defaultMessage,
      "UNKNOWN_ERROR",
      { originalName: error.name },
      error
    );
  }

  return new IndexerError(
    String(error) || defaultMessage,
    "UNKNOWN_ERROR",
    { originalError: error }
  );
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of attempts (including first try) */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to add randomness */
  jitter: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  shouldRetry?: (error: unknown, attempt: number) => boolean
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= opts.maxAttempts) {
        break;
      }

      // Check if error is recoverable
      const shouldAttemptRetry = shouldRetry
        ? shouldRetry(error, attempt)
        : isRecoverableError(error);

      if (!shouldAttemptRetry) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt - 1);
      const jitterAmount = baseDelay * opts.jitter * (Math.random() * 2 - 1);
      const delay = Math.min(baseDelay + jitterAmount, opts.maxDelay);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is recoverable
 */
function isRecoverableError(error: unknown): boolean {
  if (error instanceof IndexerError) {
    return error.recoverable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("rate limit") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket") ||
      message.includes("temporarily unavailable")
    );
  }

  return false;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Aggregated error for batch operations
 */
export class BatchError extends IndexerError {
  constructor(
    message: string,
    public readonly errors: IndexerError[],
    public readonly successCount: number,
    public readonly failureCount: number
  ) {
    super(message, "UNKNOWN_ERROR", {
      successCount,
      failureCount,
      errorCodes: errors.map((e) => e.code),
    });
    this.name = "BatchError";
  }

  get allRecoverable(): boolean {
    return this.errors.every((e) => e.recoverable);
  }
}
