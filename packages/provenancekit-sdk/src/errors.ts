export type ErrorCode =
  | "Network"
  | "Server"
  | "MissingField"
  | "InvalidField"
  | "ValidationError"
  | "Duplicate"
  | "Unsupported"
  | "NotFound"
  | "EmbeddingFailed"
  | "Internal";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    recovery?: string;
    details?: unknown;
  };
}

export class ProvenanceKitError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly recovery?: string;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    recovery?: string,
    details?: unknown
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.recovery = recovery;
    this.details = details;
  }

  static fromResponse(status: number, body: ApiErrorBody) {
    const { code, message, recovery, details } = body.error;
    return new ProvenanceKitError(code, message, status, recovery, details);
  }

  toString() {
    return this.recovery ? `${this.message}. ${this.recovery}` : this.message;
  }
}
