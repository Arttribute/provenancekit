/**
 * File storage error codes
 */
export type FileStorageErrorCode =
  | "NOT_FOUND"
  | "UPLOAD_FAILED"
  | "DOWNLOAD_FAILED"
  | "PIN_FAILED"
  | "UNPIN_FAILED"
  | "GATEWAY_ERROR"
  | "NOT_INITIALIZED"
  | "INVALID_CID"
  | "SIZE_LIMIT_EXCEEDED";

/**
 * Base error class for file storage operations.
 */
export class FileStorageError extends Error {
  readonly code: FileStorageErrorCode;
  readonly details?: unknown;

  constructor(code: FileStorageErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "FileStorageError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown when a file is not found.
 */
export class FileNotFoundError extends FileStorageError {
  constructor(cid: string) {
    super("NOT_FOUND", `File not found: ${cid}`, { cid });
  }
}

/**
 * Thrown when file upload fails.
 */
export class UploadError extends FileStorageError {
  constructor(message: string, cause?: unknown) {
    super("UPLOAD_FAILED", message, cause);
  }
}

/**
 * Thrown when file download fails.
 */
export class DownloadError extends FileStorageError {
  constructor(message: string, cause?: unknown) {
    super("DOWNLOAD_FAILED", message, cause);
  }
}

/**
 * Thrown when pinning fails.
 */
export class PinError extends FileStorageError {
  constructor(message: string, cause?: unknown) {
    super("PIN_FAILED", message, cause);
  }
}

/**
 * Thrown when gateway request fails.
 */
export class GatewayError extends FileStorageError {
  constructor(message: string, cause?: unknown) {
    super("GATEWAY_ERROR", message, cause);
  }
}

/**
 * Thrown when storage is not initialized.
 */
export class FileNotInitializedError extends FileStorageError {
  constructor() {
    super("NOT_INITIALIZED", "File storage not initialized. Call initialize() first.");
  }
}

/**
 * Thrown when CID is invalid.
 */
export class InvalidCidError extends FileStorageError {
  constructor(cid: string) {
    super("INVALID_CID", `Invalid CID: ${cid}`, { cid });
  }
}

/**
 * Thrown when file exceeds size limit.
 */
export class SizeLimitError extends FileStorageError {
  constructor(size: number, limit: number) {
    super(
      "SIZE_LIMIT_EXCEEDED",
      `File size ${size} bytes exceeds limit of ${limit} bytes`,
      { size, limit }
    );
  }
}
