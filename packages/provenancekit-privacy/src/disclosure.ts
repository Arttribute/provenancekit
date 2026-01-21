/**
 * Selective Disclosure for Provenance Data
 *
 * Implements SD-JWT-like selective disclosure patterns for provenance claims.
 * Allows holders to reveal only specific claims while proving authenticity.
 *
 * Based on RFC 9901 (SD-JWT) concepts but using simple HMAC-based commitments
 * that don't require JWS infrastructure.
 *
 * @example
 * ```ts
 * import {
 *   createSelectiveDisclosure,
 *   createPresentation,
 *   verifyPresentation,
 * } from "@provenancekit/privacy";
 *
 * // Issuer creates disclosable claims
 * const sd = createSelectiveDisclosure({
 *   contributor: "alice.eth",
 *   weight: 6000,
 *   category: "design",
 * }, issuerSecret);
 *
 * // Holder reveals only some claims
 * const presentation = createPresentation(sd, ["contributor"]);
 *
 * // Verifier checks the presentation
 * const result = verifyPresentation(presentation, issuerSecret);
 * // result.verified === true
 * // result.disclosed === { contributor: "alice.eth" }
 * // result.hidden includes "weight" and "category"
 * ```
 *
 * @packageDocumentation
 */

import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/ciphers/webcrypto";

import { toBase64, fromBase64 } from "./ciphers.js";
import { bytesToHex } from "./keys.js";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * A single disclosure containing a claim
 */
export interface Disclosure {
  /** Random salt for this disclosure */
  salt: string;
  /** Claim key */
  key: string;
  /** Claim value (JSON-serializable) */
  value: unknown;
}

/**
 * Disclosure digest (commitment to a disclosure)
 */
export interface DisclosureDigest {
  /** Key of the disclosed claim */
  key: string;
  /** SHA-256 hash of salt + key + value */
  digest: string;
}

/**
 * Full selective disclosure document
 */
export interface SelectiveDisclosureDocument {
  /** Version identifier */
  version: "sd-prov-1.0";
  /** Issuer identifier (optional) */
  issuer?: string;
  /** Subject identifier (optional) */
  subject?: string;
  /** Issuance timestamp */
  issuedAt: string;
  /** Expiration timestamp (optional) */
  expiresAt?: string;
  /** Digests of all disclosures */
  digests: DisclosureDigest[];
  /** Claims that are always visible (not selectively disclosed) */
  claims?: Record<string, unknown>;
  /** HMAC signature over the document */
  signature: string;
}

/**
 * Encoded disclosure (base64url of JSON)
 */
export type EncodedDisclosure = string;

/**
 * Full selective disclosure with encoded disclosures
 */
export interface SelectiveDisclosure {
  /** The signed document */
  document: SelectiveDisclosureDocument;
  /** All encoded disclosures (holder keeps these secret) */
  disclosures: EncodedDisclosure[];
}

/**
 * Presentation containing selected disclosures
 */
export interface SelectiveDisclosurePresentation {
  /** The signed document */
  document: SelectiveDisclosureDocument;
  /** Only the disclosures being revealed */
  disclosures: EncodedDisclosure[];
}

/**
 * Result of verifying a presentation
 */
export interface VerificationResult {
  /** Whether the presentation is valid */
  verified: boolean;
  /** Error message if not verified */
  error?: string;
  /** Successfully disclosed claims */
  disclosed: Record<string, unknown>;
  /** Keys of hidden (not disclosed) claims */
  hidden: string[];
  /** Non-selectively-disclosed claims */
  claims?: Record<string, unknown>;
  /** Issuer identifier */
  issuer?: string;
  /** Subject identifier */
  subject?: string;
  /** Whether the document has expired */
  expired?: boolean;
}

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

const SALT_LENGTH = 16;
const VERSION = "sd-prov-1.0" as const;

/*─────────────────────────────────────────────────────────────*\
 | Internal Helpers                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Generate a random salt
 */
function generateSalt(): string {
  return toBase64(randomBytes(SALT_LENGTH));
}

/**
 * Create a disclosure object
 */
function createDisclosureObject(key: string, value: unknown): Disclosure {
  return {
    salt: generateSalt(),
    key,
    value,
  };
}

/**
 * Encode a disclosure to base64url
 */
function encodeDisclosure(disclosure: Disclosure): EncodedDisclosure {
  const json = JSON.stringify([disclosure.salt, disclosure.key, disclosure.value]);
  return toBase64(new TextEncoder().encode(json));
}

/**
 * Decode a disclosure from base64url
 */
function decodeDisclosure(encoded: EncodedDisclosure): Disclosure {
  const json = new TextDecoder().decode(fromBase64(encoded));
  const [salt, key, value] = JSON.parse(json) as [string, string, unknown];
  return { salt, key, value };
}

/**
 * Calculate the digest of a disclosure
 */
function calculateDigest(disclosure: Disclosure): string {
  // Hash: SHA-256(salt || key || JSON(value))
  const input = disclosure.salt + disclosure.key + JSON.stringify(disclosure.value);
  const hash = sha256(new TextEncoder().encode(input));
  return bytesToHex(hash);
}

/**
 * Create HMAC signature over document
 */
function signDocument(
  document: Omit<SelectiveDisclosureDocument, "signature">,
  secret: Uint8Array
): string {
  const message = JSON.stringify({
    version: document.version,
    issuer: document.issuer,
    subject: document.subject,
    issuedAt: document.issuedAt,
    expiresAt: document.expiresAt,
    digests: document.digests,
    claims: document.claims,
  });

  // HMAC-SHA256
  const messageBytes = new TextEncoder().encode(message);
  const combined = new Uint8Array(secret.length + messageBytes.length);
  combined.set(secret);
  combined.set(messageBytes, secret.length);
  const hash = sha256(combined);

  return bytesToHex(hash);
}

/**
 * Verify HMAC signature
 */
function verifySignature(
  document: SelectiveDisclosureDocument,
  secret: Uint8Array
): boolean {
  const expected = signDocument(document, secret);
  return document.signature === expected;
}

/*─────────────────────────────────────────────────────────────*\
 | Public API                                                   |
\*─────────────────────────────────────────────────────────────*/

/**
 * Options for creating selective disclosure
 */
export interface CreateSelectiveDisclosureOptions {
  /** Issuer identifier */
  issuer?: string;
  /** Subject identifier */
  subject?: string;
  /** Expiration time (ISO string or Date) */
  expiresAt?: string | Date;
  /** Claims that should NOT be selectively disclosable */
  alwaysVisible?: string[];
}

/**
 * Create a selective disclosure document
 *
 * @param claims - The claims to make selectively disclosable
 * @param secret - Issuer's secret key (32 bytes recommended)
 * @param options - Additional options
 * @returns Selective disclosure with document and encoded disclosures
 *
 * @example
 * ```ts
 * const sd = createSelectiveDisclosure(
 *   {
 *     contributor: "alice.eth",
 *     weight: 6000,
 *     category: "design",
 *     timestamp: "2025-01-20T10:00:00Z",
 *   },
 *   issuerSecret,
 *   {
 *     issuer: "did:example:issuer",
 *     subject: "did:example:alice",
 *     alwaysVisible: ["timestamp"], // timestamp is always shown
 *   }
 * );
 * ```
 */
export function createSelectiveDisclosure(
  claims: Record<string, unknown>,
  secret: Uint8Array,
  options: CreateSelectiveDisclosureOptions = {}
): SelectiveDisclosure {
  const alwaysVisible = new Set(options.alwaysVisible ?? []);

  // Separate always-visible from selectively disclosable
  const visibleClaims: Record<string, unknown> = {};
  const disclosableClaims: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(claims)) {
    if (alwaysVisible.has(key)) {
      visibleClaims[key] = value;
    } else {
      disclosableClaims[key] = value;
    }
  }

  // Create disclosures and digests
  const disclosures: Disclosure[] = [];
  const digests: DisclosureDigest[] = [];

  for (const [key, value] of Object.entries(disclosableClaims)) {
    const disclosure = createDisclosureObject(key, value);
    disclosures.push(disclosure);
    digests.push({
      key,
      digest: calculateDigest(disclosure),
    });
  }

  // Create the document (without signature)
  const doc: Omit<SelectiveDisclosureDocument, "signature"> = {
    version: VERSION,
    issuer: options.issuer,
    subject: options.subject,
    issuedAt: new Date().toISOString(),
    expiresAt:
      options.expiresAt instanceof Date
        ? options.expiresAt.toISOString()
        : options.expiresAt,
    digests,
    claims: Object.keys(visibleClaims).length > 0 ? visibleClaims : undefined,
  };

  // Sign the document
  const signature = signDocument(doc, secret);

  return {
    document: { ...doc, signature },
    disclosures: disclosures.map(encodeDisclosure),
  };
}

/**
 * Create a presentation with selected disclosures
 *
 * @param sd - The full selective disclosure
 * @param keysToDisclose - Which claim keys to reveal (empty = reveal nothing)
 * @returns Presentation with only selected disclosures
 *
 * @example
 * ```ts
 * // Reveal only contributor, hide weight and category
 * const presentation = createPresentation(sd, ["contributor"]);
 * ```
 */
export function createPresentation(
  sd: SelectiveDisclosure,
  keysToDisclose: string[]
): SelectiveDisclosurePresentation {
  const keysSet = new Set(keysToDisclose);

  // Decode all disclosures to find matching ones
  const selectedDisclosures: EncodedDisclosure[] = [];

  for (const encoded of sd.disclosures) {
    const disclosure = decodeDisclosure(encoded);
    if (keysSet.has(disclosure.key)) {
      selectedDisclosures.push(encoded);
    }
  }

  return {
    document: sd.document,
    disclosures: selectedDisclosures,
  };
}

/**
 * Verify a selective disclosure presentation
 *
 * @param presentation - The presentation to verify
 * @param secret - Issuer's secret key (must match the one used to create)
 * @returns Verification result with disclosed claims
 *
 * @example
 * ```ts
 * const result = verifyPresentation(presentation, issuerSecret);
 *
 * if (result.verified) {
 *   console.log("Disclosed:", result.disclosed);
 *   console.log("Hidden:", result.hidden);
 * } else {
 *   console.error("Invalid:", result.error);
 * }
 * ```
 */
export function verifyPresentation(
  presentation: SelectiveDisclosurePresentation,
  secret: Uint8Array
): VerificationResult {
  const { document, disclosures } = presentation;

  // Check version
  if (document.version !== VERSION) {
    return {
      verified: false,
      error: `Unsupported version: ${document.version}`,
      disclosed: {},
      hidden: document.digests.map((d) => d.key),
    };
  }

  // Verify signature
  if (!verifySignature(document, secret)) {
    return {
      verified: false,
      error: "Invalid signature",
      disclosed: {},
      hidden: document.digests.map((d) => d.key),
    };
  }

  // Check expiration
  let expired = false;
  if (document.expiresAt) {
    expired = new Date(document.expiresAt) < new Date();
  }

  // Build digest map for verification
  const digestMap = new Map<string, string>();
  for (const { key, digest } of document.digests) {
    digestMap.set(key, digest);
  }

  // Verify each disclosure
  const disclosed: Record<string, unknown> = {};
  const disclosedKeys = new Set<string>();

  for (const encoded of disclosures) {
    const disclosure = decodeDisclosure(encoded);
    const expectedDigest = digestMap.get(disclosure.key);

    if (!expectedDigest) {
      return {
        verified: false,
        error: `Unknown disclosure key: ${disclosure.key}`,
        disclosed: {},
        hidden: document.digests.map((d) => d.key),
      };
    }

    const actualDigest = calculateDigest(disclosure);
    if (actualDigest !== expectedDigest) {
      return {
        verified: false,
        error: `Invalid disclosure for key: ${disclosure.key}`,
        disclosed: {},
        hidden: document.digests.map((d) => d.key),
      };
    }

    disclosed[disclosure.key] = disclosure.value;
    disclosedKeys.add(disclosure.key);
  }

  // Determine hidden keys
  const hidden = document.digests
    .filter((d) => !disclosedKeys.has(d.key))
    .map((d) => d.key);

  return {
    verified: true,
    disclosed,
    hidden,
    claims: document.claims,
    issuer: document.issuer,
    subject: document.subject,
    expired,
  };
}

/**
 * Get all claim keys from a selective disclosure
 *
 * @param sd - The selective disclosure
 * @returns All claim keys (both disclosable and always-visible)
 */
export function getClaimKeys(sd: SelectiveDisclosure): string[] {
  const keys = sd.document.digests.map((d) => d.key);
  if (sd.document.claims) {
    keys.push(...Object.keys(sd.document.claims));
  }
  return keys;
}

/**
 * Check if a presentation has expired
 *
 * @param presentation - The presentation to check
 * @returns True if expired or no expiration set
 */
export function isExpired(presentation: SelectiveDisclosurePresentation): boolean {
  const { expiresAt } = presentation.document;
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/*─────────────────────────────────────────────────────────────*\
 | Provenance-Specific Helpers                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create selective disclosure for an attribution
 *
 * @param attribution - Attribution data
 * @param secret - Issuer's secret
 * @param options - Options
 * @returns Selective disclosure for the attribution
 *
 * @example
 * ```ts
 * const sd = createAttributionDisclosure({
 *   entity: { id: "did:example:alice", type: "human" },
 *   role: "author",
 *   weight: 6000,
 *   category: "design",
 * }, secret);
 *
 * // Holder can prove they're an author without revealing weight
 * const presentation = createPresentation(sd, ["entity", "role"]);
 * ```
 */
export function createAttributionDisclosure(
  attribution: {
    entity: { id: string; type?: string };
    role?: string;
    weight?: number;
    category?: string;
    [key: string]: unknown;
  },
  secret: Uint8Array,
  options: CreateSelectiveDisclosureOptions = {}
): SelectiveDisclosure {
  // Entity ID is always visible, other fields are selectively disclosable
  const alwaysVisible = options.alwaysVisible ?? ["entity"];

  return createSelectiveDisclosure(attribution, secret, {
    ...options,
    alwaysVisible,
  });
}

/**
 * Create selective disclosure for a resource
 *
 * @param resource - Resource data
 * @param secret - Issuer's secret
 * @param options - Options
 * @returns Selective disclosure for the resource
 */
export function createResourceDisclosure(
  resource: {
    type: string;
    ref?: { ref: string; scheme: string };
    name?: string;
    description?: string;
    [key: string]: unknown;
  },
  secret: Uint8Array,
  options: CreateSelectiveDisclosureOptions = {}
): SelectiveDisclosure {
  // Type and ref are always visible
  const alwaysVisible = options.alwaysVisible ?? ["type", "ref"];

  return createSelectiveDisclosure(resource, secret, {
    ...options,
    alwaysVisible,
  });
}

/**
 * Serialize a selective disclosure for storage/transmission
 */
export function serializeSelectiveDisclosure(sd: SelectiveDisclosure): string {
  return JSON.stringify(sd);
}

/**
 * Deserialize a selective disclosure
 */
export function deserializeSelectiveDisclosure(json: string): SelectiveDisclosure {
  return JSON.parse(json) as SelectiveDisclosure;
}

/**
 * Serialize a presentation for transmission
 */
export function serializePresentation(
  presentation: SelectiveDisclosurePresentation
): string {
  return JSON.stringify(presentation);
}

/**
 * Deserialize a presentation
 */
export function deserializePresentation(
  json: string
): SelectiveDisclosurePresentation {
  return JSON.parse(json) as SelectiveDisclosurePresentation;
}
