// apps/ProvenanceKit-api/src/errors.ts
import { ZodError } from "zod";

/** All ProvenanceKit‑specific error codes */
export type ErrorCode =
  | "MissingField" // required field absent
  | "InvalidField" // type/format wrong
  | "ValidationError" // Zod aggregated errors
  | "Unauthorized" // missing or invalid API key
  | "Forbidden" // valid credentials but lacking permission
  | "TooManyRequests" // rate limit exceeded
  | "Duplicate" // conflict / already exists
  | "Unsupported" // unsupported media or operation
  | "NotFound" // resource not found
  | "EmbeddingFailed" // ML encoder failure
  | "Internal"; // any uncaught error

export class ProvenanceKitError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Human hint to fix the problem (optional) */
  readonly recovery?: string;
  /** Any extra diagnostic data */
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    {
      status,
      recovery,
      details,
    }: { status?: number; recovery?: string; details?: unknown } = {}
  ) {
    super(message);
    this.code = code;
    this.status =
      status ??
      {
        MissingField: 400,
        InvalidField: 400,
        ValidationError: 422,
        Unauthorized: 401,
        Forbidden: 403,
        TooManyRequests: 429,
        Duplicate: 409,
        Unsupported: 415,
        NotFound: 404,
        EmbeddingFailed: 502,
        Internal: 500,
      }[code];
    this.recovery = recovery;
    this.details = details;
  }

  /* Helper: convert Zod errors → ValidationError */
  static fromZod(err: ZodError): ProvenanceKitError {
    return new ProvenanceKitError(
      "ValidationError",
      "Payload validation failed",
      {
        details: err.flatten(),
        recovery: "Review `details` and supply fields in the correct shape",
      }
    );
  }
}

/** Wrap *any* thrown value into ProvenanceKitError(Internal) */
export function toProvenanceKitError(err: unknown): ProvenanceKitError {
  if (err instanceof ProvenanceKitError) return err;
  if (err instanceof ZodError) return ProvenanceKitError.fromZod(err);
  console.error(err); // full stack trace for ops
  return new ProvenanceKitError("Internal", "Internal server error");
}
