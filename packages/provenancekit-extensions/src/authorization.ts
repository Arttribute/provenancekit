import { z } from "zod";

/**
 * Namespace for authorization extension.
 * @example "ext:authorization@1.0.0"
 */
export const AUTHORIZATION_NAMESPACE = "ext:authorization@1.0.0" as const;

/**
 * Authorization status values.
 *
 * - `authorized`: Use was explicitly authorised by the rights holder or their delegate
 * - `unauthorized`: Use was not authorised (recorded for enforcement/audit purposes)
 * - `pending`: Authorisation has been requested but not yet granted
 * - `revoked`: Authorisation was previously granted but has since been revoked
 */
export const AuthorizationStatus = z.enum([
  "authorized",
  "unauthorized",
  "pending",
  "revoked",
]);
export type AuthorizationStatus = z.infer<typeof AuthorizationStatus>;

/**
 * Authorization extension schema.
 *
 * A general-purpose extension for recording whether a use was authorised,
 * by whom, and on what basis. This extension is intentionally agnostic about
 * the type of authorisation — it applies equally to:
 * - Copyright licence grants (attach to Action or Resource)
 * - GDPR consent records (attach to Action)
 * - Editorial approvals (attach to Action)
 * - Delegation records (attach to Action or Entity)
 * - AI training opt-in/opt-out enforcement records (attach to Action)
 *
 * @remarks
 * **Legal relevance:**
 * - NO FAKES Act § 2(b)(2)(B): authorisation for digital replica use
 * - GDPR Art. 9: special category data consent
 * - EU AI Act Art. 50(2): disclosure of AI-generated content
 *
 * **Design note:** This extension does NOT prescribe a specific legal regime.
 * It provides the data structure; downstream systems and legal practitioners
 * decide what constitutes valid authorisation for their context.
 *
 * @example
 * ```typescript
 * // Record that a use was explicitly authorised
 * const action = withAuthorization(action, {
 *   status: "authorized",
 *   authorizedBy: "did:key:alice",
 *   authorizedAt: "2025-01-15T10:00:00Z",
 *   scope: "Commercial use in product demo video",
 *   reference: "contract:2025-license-001",
 *   proof: "0xabc...def",
 * });
 *
 * // Record a pending authorisation request
 * const action = withAuthorization(action, {
 *   status: "pending",
 *   scope: "Requested: AI training use under DSM Art. 4",
 * });
 *
 * // Record a revoked authorisation
 * const resource = withAuthorization(resource, {
 *   status: "revoked",
 *   authorizedBy: "did:key:alice",
 *   authorizedAt: "2025-01-01T00:00:00Z",
 *   expiresAt: "2025-06-01T00:00:00Z",
 *   scope: "Usage rights revoked: licence expired",
 *   reference: "revocation:2025-06-01-001",
 * });
 * ```
 */
export const AuthorizationExtension = z.object({
  /**
   * Whether this use was explicitly authorised.
   * "unauthorized" is a valid and useful value — it records that a use
   * was NOT authorised, which is important for enforcement and audit trails.
   */
  status: AuthorizationStatus,

  /**
   * Entity ID of who granted the authorisation.
   * Should reference an Entity.id in the provenance bundle.
   * For self-authorisation, this is the same as the performing entity.
   */
  authorizedBy: z.string().optional(),

  /**
   * When the authorisation was granted (ISO 8601 timestamp).
   */
  authorizedAt: z.string().datetime().optional(),

  /**
   * When the authorisation expires (ISO 8601 timestamp).
   * Absence means no expiry. Use isAuthorized() to check current status.
   */
  expiresAt: z.string().datetime().optional(),

  /**
   * Free-form reference to the authorisation instrument.
   * Examples:
   * - "contract:2025-license-001" — contract identifier
   * - "0xabc...def" — on-chain transaction hash
   * - "gdpr-consent:session-xyz" — consent record reference
   * - "purchase:stripe-pi-abc" — purchase confirmation
   */
  reference: z.string().optional(),

  /**
   * Human-readable description of what was authorised and under what terms.
   * Keep concise. Full terms should be in a Resource or referenced via `reference`.
   */
  scope: z.string().optional(),

  /**
   * Cryptographic proof of authorisation.
   * Can be a signature, on-chain transaction hash, or commitment hash.
   * Format is implementation-defined; recommended: "0x..." for EVM tx hashes,
   * base64 for signatures.
   */
  proof: z.string().optional(),
});

export type AuthorizationExtension = z.infer<typeof AuthorizationExtension>;

/** Type for objects that can have extensions */
type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add authorization extension to an action, resource, or entity.
 *
 * @param obj - The EAA object to extend
 * @param authorization - Authorization data
 * @returns Object with authorization extension attached
 *
 * @example
 * ```typescript
 * const authorizedAction = withAuthorization(action, {
 *   status: "authorized",
 *   authorizedBy: "did:key:alice",
 *   authorizedAt: new Date().toISOString(),
 *   scope: "Commercial reproduction rights",
 * });
 * ```
 */
export function withAuthorization<T extends Extensible>(
  obj: T,
  authorization: z.input<typeof AuthorizationExtension>
): T {
  const validated = AuthorizationExtension.parse(authorization);
  return {
    ...obj,
    extensions: {
      ...obj.extensions,
      [AUTHORIZATION_NAMESPACE]: validated,
    },
  };
}

/**
 * Get authorization extension from an EAA object.
 *
 * @param obj - The EAA object to read from
 * @returns Authorization data or undefined if not present
 */
export function getAuthorization(
  obj: Extensible
): AuthorizationExtension | undefined {
  const data = obj.extensions?.[AUTHORIZATION_NAMESPACE];
  if (!data) return undefined;
  return AuthorizationExtension.parse(data);
}

/**
 * Check if an EAA object has an authorization extension.
 *
 * @param obj - The EAA object to check
 * @returns True if authorization extension exists (regardless of status)
 */
export function hasAuthorization(obj: Extensible): boolean {
  return obj.extensions?.[AUTHORIZATION_NAMESPACE] !== undefined;
}

/**
 * Check if a use is currently authorised.
 *
 * Returns true only if:
 * - An authorization extension exists
 * - Status is "authorized"
 * - The authorization has not expired
 *
 * @param obj - The EAA object to check
 * @param now - Reference date (defaults to current time)
 * @returns True if currently authorised
 *
 * @example
 * ```typescript
 * if (!isAuthorized(action)) {
 *   throw new Error("Unauthorized use of resource");
 * }
 * ```
 */
export function isAuthorized(
  obj: Extensible,
  now: Date = new Date()
): boolean {
  const auth = getAuthorization(obj);
  if (!auth) return false;
  if (auth.status !== "authorized") return false;
  if (auth.expiresAt && new Date(auth.expiresAt) <= now) return false;
  return true;
}

/**
 * Check if an authorisation has been revoked.
 *
 * @param obj - The EAA object to check
 * @returns True if authorization status is "revoked"
 */
export function isRevoked(obj: Extensible): boolean {
  return getAuthorization(obj)?.status === "revoked";
}

/**
 * Check if an authorisation is pending.
 *
 * @param obj - The EAA object to check
 * @returns True if authorization status is "pending"
 */
export function isPendingAuthorization(obj: Extensible): boolean {
  return getAuthorization(obj)?.status === "pending";
}
