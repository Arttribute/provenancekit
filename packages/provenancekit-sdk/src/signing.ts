/**
 * Bundle Signing Utilities
 *
 * Sign and verify ProvenanceKit bundles using Ed25519.
 * Uses @noble/ed25519 for cryptographic operations.
 *
 * @example
 * ```typescript
 * import { signBundle, verifyBundle, generateKeyPair } from "@provenancekit/sdk/signing";
 *
 * const { privateKey, publicKey } = await generateKeyPair();
 * const signedBundle = await signBundle(bundle, privateKey);
 * const isValid = await verifyBundle(signedBundle);
 * ```
 */

import * as ed from "@noble/ed25519";
import type { ProvenanceBundle, BundleSignature } from "@arttribute/eaa-types";

/** Structured action proof (matches ext:proof@1.0.0 extension schema) */
export interface ActionProof {
  algorithm: "Ed25519" | "ECDSA-secp256k1";
  publicKey: string;
  signature: string;
  timestamp: string;
}

/**
 * Generate an Ed25519 key pair for bundle signing.
 *
 * @returns Object with hex-encoded privateKey and publicKey
 */
export async function generateKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}

/**
 * Create a canonical JSON representation of bundle content for signing.
 *
 * Excludes the `signature` field to avoid circular dependency.
 * Uses deterministic JSON serialization (sorted keys).
 *
 * @param bundle The bundle to canonicalize
 * @returns Canonical JSON string
 */
export function canonicalize(bundle: ProvenanceBundle): string {
  const { signature: _, ...content } = bundle as ProvenanceBundle & {
    signature?: unknown;
  };
  return JSON.stringify(content, Object.keys(content).sort());
}

/**
 * Sign a provenance bundle.
 *
 * @param bundle The bundle to sign (signature field will be overwritten)
 * @param privateKeyHex Hex-encoded Ed25519 private key
 * @returns The bundle with a `signature` field added
 */
export async function signBundle(
  bundle: ProvenanceBundle,
  privateKeyHex: string
): Promise<ProvenanceBundle & { signature: BundleSignature }> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const canonical = canonicalize(bundle);
  const message = new TextEncoder().encode(canonical);

  const sig = await ed.signAsync(message, privateKey);

  const signature: BundleSignature = {
    algorithm: "Ed25519",
    publicKey: bytesToHex(publicKey),
    signature: bytesToHex(sig),
    timestamp: new Date().toISOString(),
  };

  return { ...bundle, signature };
}

/**
 * Verify a signed provenance bundle.
 *
 * @param bundle The signed bundle to verify
 * @returns True if the signature is valid
 */
export async function verifyBundle(
  bundle: ProvenanceBundle & { signature?: BundleSignature }
): Promise<boolean> {
  if (!bundle.signature) {
    return false;
  }

  const { algorithm, publicKey, signature: sig } = bundle.signature;

  if (algorithm !== "Ed25519") {
    throw new Error(`Unsupported signing algorithm: ${algorithm}`);
  }

  const canonical = canonicalize(bundle);
  const message = new TextEncoder().encode(canonical);

  return ed.verifyAsync(hexToBytes(sig), message, hexToBytes(publicKey));
}

/*─────────────────────────────────────────────────────────────*\
 | Action Signing                                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Payload signed by an entity to prove they authorized an action.
 * Output CIDs are excluded since they're computed server-side.
 */
export interface ActionSignPayload {
  entityId: string;
  actionType: string;
  inputs: string[];
  timestamp: string;
}

/**
 * Create a canonical JSON representation of an action sign payload.
 * Keys sorted alphabetically, inputs sorted for determinism.
 *
 * @param payload The action payload to canonicalize
 * @returns Canonical JSON string
 */
export function canonicalizeAction(payload: ActionSignPayload): string {
  const normalized: ActionSignPayload = {
    actionType: payload.actionType,
    entityId: payload.entityId,
    inputs: [...payload.inputs].sort(),
    timestamp: payload.timestamp,
  };
  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Sign an action payload with an Ed25519 private key.
 *
 * @param payload The action payload to sign
 * @param privateKeyHex Hex-encoded Ed25519 private key
 * @returns Structured ActionProof
 */
export async function signAction(
  payload: ActionSignPayload,
  privateKeyHex: string
): Promise<ActionProof> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const canonical = canonicalizeAction(payload);
  const message = new TextEncoder().encode(canonical);
  const sig = await ed.signAsync(message, privateKey);

  return {
    algorithm: "Ed25519",
    publicKey: bytesToHex(publicKey),
    signature: bytesToHex(sig),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Verify an action proof against the original payload.
 *
 * @param payload The action payload that was signed
 * @param proof The proof to verify
 * @returns True if the signature is valid
 */
export async function verifyAction(
  payload: ActionSignPayload,
  proof: ActionProof
): Promise<boolean> {
  if (proof.algorithm !== "Ed25519") {
    throw new Error(`Unsupported signing algorithm: ${proof.algorithm}`);
  }

  const canonical = canonicalizeAction(payload);
  const message = new TextEncoder().encode(canonical);

  return ed.verifyAsync(
    hexToBytes(proof.signature),
    message,
    hexToBytes(proof.publicKey)
  );
}

/*─────────────────────────────────────────────────────────────*\
 | Hex Conversion Helpers                                       |
\*─────────────────────────────────────────────────────────────*/

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
