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
 * Extended payload that includes output CIDs.
 * Used when the client computes the CID locally (highest assurance level).
 * When outputs are included, the signature covers the full action claim.
 */
export interface FullActionSignPayload extends ActionSignPayload {
  outputs: string[];
}

/**
 * Server witness attestation binding an action to its output.
 * Created by the API server after IPFS upload to link the entity's
 * signed intent to the actual output CID.
 */
export interface ServerWitnessPayload {
  actionId: string;
  entityId: string;
  outputCid: string;
  actionProofHash: string;
}

/**
 * Signed server witness (payload + cryptographic proof).
 */
export interface ServerWitness extends ServerWitnessPayload {
  serverSignature: string;
  serverPublicKey: string;
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
 | Entity Registration Signing                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Deterministic registration message for entity key ownership proof.
 * Stateless — no challenge-response needed.
 */
function registrationMessage(entityId: string, publicKeyHex: string): string {
  return `provenancekit:register:${entityId}:${publicKeyHex}`;
}

/**
 * Sign an entity registration to prove ownership of a public key.
 *
 * The entity signs a deterministic message: `provenancekit:register:{entityId}:{publicKey}`.
 * This proves the caller holds the private key corresponding to the public key being registered.
 *
 * @param entityId The entity ID being registered
 * @param privateKeyHex Hex-encoded Ed25519 private key
 * @returns Object with signature and publicKey (hex-encoded)
 */
export async function signRegistration(
  entityId: string,
  privateKeyHex: string
): Promise<{ signature: string; publicKey: string }> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const publicKeyHex = bytesToHex(publicKey);

  const message = new TextEncoder().encode(
    registrationMessage(entityId, publicKeyHex)
  );
  const sig = await ed.signAsync(message, privateKey);

  return {
    signature: bytesToHex(sig),
    publicKey: publicKeyHex,
  };
}

/**
 * Verify an entity registration signature.
 *
 * @param entityId The entity ID that was registered
 * @param publicKeyHex Hex-encoded public key
 * @param signatureHex Hex-encoded signature
 * @returns True if the signature is valid
 */
export async function verifyRegistration(
  entityId: string,
  publicKeyHex: string,
  signatureHex: string
): Promise<boolean> {
  const message = new TextEncoder().encode(
    registrationMessage(entityId, publicKeyHex)
  );

  return ed.verifyAsync(
    hexToBytes(signatureHex),
    message,
    hexToBytes(publicKeyHex)
  );
}

/*─────────────────────────────────────────────────────────────*\
 | Full Action Signing (with outputs)                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a canonical JSON representation of a full action sign payload.
 * Includes outputs for complete action binding.
 *
 * @param payload The full action payload to canonicalize
 * @returns Canonical JSON string
 */
export function canonicalizeFullAction(
  payload: FullActionSignPayload
): string {
  const normalized = {
    actionType: payload.actionType,
    entityId: payload.entityId,
    inputs: [...payload.inputs].sort(),
    outputs: [...payload.outputs].sort(),
    timestamp: payload.timestamp,
  };
  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Sign a full action payload (including outputs) with an Ed25519 private key.
 * Use this when the client computes the output CID locally for maximum assurance.
 *
 * @param payload The full action payload to sign
 * @param privateKeyHex Hex-encoded Ed25519 private key
 * @returns Structured ActionProof
 */
export async function signFullAction(
  payload: FullActionSignPayload,
  privateKeyHex: string
): Promise<ActionProof> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const canonical = canonicalizeFullAction(payload);
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
 * Verify a full action proof (including outputs) against the original payload.
 *
 * @param payload The full action payload that was signed
 * @param proof The proof to verify
 * @returns True if the signature is valid
 */
export async function verifyFullAction(
  payload: FullActionSignPayload,
  proof: ActionProof
): Promise<boolean> {
  if (proof.algorithm !== "Ed25519") {
    throw new Error(`Unsupported signing algorithm: ${proof.algorithm}`);
  }

  const canonical = canonicalizeFullAction(payload);
  const message = new TextEncoder().encode(canonical);

  return ed.verifyAsync(
    hexToBytes(proof.signature),
    message,
    hexToBytes(proof.publicKey)
  );
}

/*─────────────────────────────────────────────────────────────*\
 | Server Witness                                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a canonical JSON representation of a server witness payload.
 */
function canonicalizeWitness(payload: ServerWitnessPayload): string {
  const normalized = {
    actionId: payload.actionId,
    actionProofHash: payload.actionProofHash,
    entityId: payload.entityId,
    outputCid: payload.outputCid,
  };
  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Create and sign a server witness attestation.
 *
 * The server witnesses that a specific action by a specific entity
 * produced a specific output CID. The actionProofHash links the
 * witness to the entity's signed intent.
 *
 * @param payload The witness payload (actionId, entityId, outputCid, actionProofHash)
 * @param serverPrivateKeyHex Hex-encoded server Ed25519 private key
 * @returns Signed ServerWitness
 */
export async function createServerWitness(
  payload: ServerWitnessPayload,
  serverPrivateKeyHex: string
): Promise<ServerWitness> {
  const privateKey = hexToBytes(serverPrivateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const canonical = canonicalizeWitness(payload);
  const message = new TextEncoder().encode(canonical);
  const sig = await ed.signAsync(message, privateKey);

  return {
    ...payload,
    serverSignature: bytesToHex(sig),
    serverPublicKey: bytesToHex(publicKey),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Verify a server witness attestation.
 *
 * @param witness The signed server witness to verify
 * @returns True if the server's signature is valid
 */
export async function verifyServerWitness(
  witness: ServerWitness
): Promise<boolean> {
  const payload: ServerWitnessPayload = {
    actionId: witness.actionId,
    entityId: witness.entityId,
    outputCid: witness.outputCid,
    actionProofHash: witness.actionProofHash,
  };

  const canonical = canonicalizeWitness(payload);
  const message = new TextEncoder().encode(canonical);

  return ed.verifyAsync(
    hexToBytes(witness.serverSignature),
    message,
    hexToBytes(witness.serverPublicKey)
  );
}

/**
 * Compute a SHA-256 hash of an action proof for use in server witnesses.
 * This links the witness to the entity's signed intent.
 *
 * @param proof The action proof to hash
 * @returns Hex-encoded SHA-256 hash prefixed with "sha256:"
 */
export async function hashActionProof(proof: ActionProof): Promise<string> {
  const canonical = JSON.stringify(proof, Object.keys(proof).sort());
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return "sha256:" + bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Derive a public key from an Ed25519 private key.
 *
 * @param privateKeyHex Hex-encoded Ed25519 private key
 * @returns Hex-encoded public key
 */
export async function derivePublicKey(privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return bytesToHex(publicKey);
}

/**
 * Verify a raw Ed25519 signature over a hex-encoded payload hash.
 *
 * Used for provider-signed tool attestations where the provider signs
 * their own payload and we verify with their declared public key.
 *
 * @param signatureHex Hex-encoded Ed25519 signature
 * @param payloadHashHex Hex-encoded hash of the signed payload
 * @param publicKeyHex Hex-encoded Ed25519 public key
 * @returns True if the signature is valid
 */
export async function verifyEd25519Signature(
  signatureHex: string,
  payloadHashHex: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    return await ed.verifyAsync(
      hexToBytes(signatureHex),
      hexToBytes(payloadHashHex),
      hexToBytes(publicKeyHex)
    );
  } catch {
    return false;
  }
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
