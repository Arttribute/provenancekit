/**
 * Cipher implementations using @noble/ciphers
 *
 * Provides symmetric encryption/decryption with modern authenticated ciphers.
 * All ciphers are AEAD (Authenticated Encryption with Associated Data).
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { gcm, siv } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";

import type {
  CipherAlgorithm,
  EncryptionResult,
  EncryptionEnvelope,
  IEncryptionProvider,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

/** Required key length for all ciphers (256 bits) */
export const KEY_LENGTH = 32;

/** Nonce lengths for different algorithms */
export const NONCE_LENGTHS: Record<CipherAlgorithm, number> = {
  "xchacha20-poly1305": 24, // Extended nonce - safe for random generation
  "chacha20-poly1305": 12, // Standard nonce
  "aes-256-gcm": 12, // Standard nonce
  "aes-256-gcm-siv": 12, // Standard nonce, but nonce-misuse resistant
};

/** Default algorithm (recommended) */
export const DEFAULT_ALGORITHM: CipherAlgorithm = "xchacha20-poly1305";

/*─────────────────────────────────────────────────────────────*\
 | Low-Level Cipher Functions                                   |
\*─────────────────────────────────────────────────────────────*/

/**
 * Get cipher instance for the given algorithm
 */
function getCipher(algorithm: CipherAlgorithm, key: Uint8Array, nonce: Uint8Array) {
  switch (algorithm) {
    case "xchacha20-poly1305":
      return xchacha20poly1305(key, nonce);
    case "chacha20-poly1305":
      return chacha20poly1305(key, nonce);
    case "aes-256-gcm":
      return gcm(key, nonce);
    case "aes-256-gcm-siv":
      return siv(key, nonce);
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}

/**
 * Validate key length
 */
function validateKey(key: Uint8Array): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
}

/**
 * Validate nonce length for algorithm
 */
function validateNonce(nonce: Uint8Array, algorithm: CipherAlgorithm): void {
  const expected = NONCE_LENGTHS[algorithm];
  if (nonce.length !== expected) {
    throw new Error(
      `Invalid nonce length for ${algorithm}: expected ${expected} bytes, got ${nonce.length}`
    );
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Core Encryption Functions                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Generate a random nonce for the given algorithm
 */
export function generateNonce(algorithm: CipherAlgorithm = DEFAULT_ALGORITHM): Uint8Array {
  return randomBytes(NONCE_LENGTHS[algorithm]);
}

/**
 * Generate a random encryption key
 */
export function generateKey(): Uint8Array {
  return randomBytes(KEY_LENGTH);
}

/**
 * Encrypt data with the specified algorithm
 *
 * @param data - Plaintext to encrypt
 * @param key - 32-byte encryption key
 * @param algorithm - Cipher algorithm (default: xchacha20-poly1305)
 * @param nonce - Optional nonce (will be generated if not provided)
 * @returns Encryption result with ciphertext and nonce
 *
 * @example
 * ```ts
 * const key = generateKey();
 * const result = encrypt(new TextEncoder().encode("secret"), key);
 * // Store result.ciphertext and result.nonce together
 * ```
 */
export function encrypt(
  data: Uint8Array,
  key: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM,
  nonce?: Uint8Array
): EncryptionResult {
  validateKey(key);

  const actualNonce = nonce ?? generateNonce(algorithm);
  validateNonce(actualNonce, algorithm);

  const cipher = getCipher(algorithm, key, actualNonce);
  const ciphertext = cipher.encrypt(data);

  return {
    ciphertext,
    nonce: actualNonce,
    algorithm,
  };
}

/**
 * Decrypt data with the specified algorithm
 *
 * @param ciphertext - Encrypted data (includes auth tag)
 * @param key - 32-byte decryption key
 * @param nonce - Nonce used during encryption
 * @param algorithm - Cipher algorithm
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 *
 * @example
 * ```ts
 * const plaintext = decrypt(result.ciphertext, key, result.nonce, result.algorithm);
 * const text = new TextDecoder().decode(plaintext);
 * ```
 */
export function decrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
): Uint8Array {
  validateKey(key);
  validateNonce(nonce, algorithm);

  const cipher = getCipher(algorithm, key, nonce);
  return cipher.decrypt(ciphertext);
}

/*─────────────────────────────────────────────────────────────*\
 | String/JSON Helpers                                          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Encrypt a string
 */
export function encryptString(
  text: string,
  key: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
): EncryptionResult {
  const data = new TextEncoder().encode(text);
  return encrypt(data, key, algorithm);
}

/**
 * Decrypt to a string
 */
export function decryptToString(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
): string {
  const data = decrypt(ciphertext, key, nonce, algorithm);
  return new TextDecoder().decode(data);
}

/**
 * Encrypt a JSON object
 */
export function encryptJson<T>(
  obj: T,
  key: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
): EncryptionResult {
  const json = JSON.stringify(obj);
  return encryptString(json, key, algorithm);
}

/**
 * Decrypt to a JSON object
 */
export function decryptToJson<T>(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
): T {
  const json = decryptToString(ciphertext, key, nonce, algorithm);
  return JSON.parse(json) as T;
}

/*─────────────────────────────────────────────────────────────*\
 | Envelope Functions (Serialization)                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert Uint8Array to base64 string
 */
export function toBase64(data: Uint8Array): string {
  // Use Buffer in Node.js, btoa in browser
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data).toString("base64");
  }
  return btoa(String.fromCharCode(...data));
}

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  return new Uint8Array(
    atob(base64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

/**
 * Create a serializable envelope from encryption result
 *
 * @example
 * ```ts
 * const result = encrypt(data, key);
 * const envelope = toEnvelope(result);
 * // Store envelope as JSON
 * const json = JSON.stringify(envelope);
 * ```
 */
export function toEnvelope(result: EncryptionResult): EncryptionEnvelope {
  return {
    ciphertext: toBase64(result.ciphertext),
    nonce: toBase64(result.nonce),
    algorithm: result.algorithm,
    version: "1.0",
  };
}

/**
 * Parse an envelope back to binary form
 */
export function fromEnvelope(envelope: EncryptionEnvelope): EncryptionResult {
  return {
    ciphertext: fromBase64(envelope.ciphertext),
    nonce: fromBase64(envelope.nonce),
    algorithm: envelope.algorithm,
  };
}

/**
 * Encrypt data and return as envelope
 */
export function encryptToEnvelope(
  data: Uint8Array,
  key: Uint8Array,
  algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
): EncryptionEnvelope {
  const result = encrypt(data, key, algorithm);
  return toEnvelope(result);
}

/**
 * Decrypt from an envelope
 */
export function decryptFromEnvelope(envelope: EncryptionEnvelope, key: Uint8Array): Uint8Array {
  const { ciphertext, nonce, algorithm } = fromEnvelope(envelope);
  return decrypt(ciphertext, key, nonce, algorithm);
}

/*─────────────────────────────────────────────────────────────*\
 | Noble Encryption Provider                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Default encryption provider using @noble/ciphers
 */
export class NobleEncryptionProvider implements IEncryptionProvider {
  readonly name = "noble-ciphers";

  readonly supportedAlgorithms: CipherAlgorithm[] = [
    "xchacha20-poly1305",
    "chacha20-poly1305",
    "aes-256-gcm",
    "aes-256-gcm-siv",
  ];

  async encrypt(
    data: Uint8Array,
    key: Uint8Array,
    algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
  ): Promise<EncryptionResult> {
    return encrypt(data, key, algorithm);
  }

  async decrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    nonce: Uint8Array,
    algorithm: CipherAlgorithm = DEFAULT_ALGORITHM
  ): Promise<Uint8Array> {
    return decrypt(ciphertext, key, nonce, algorithm);
  }
}

/**
 * Default encryption provider instance
 */
export const defaultEncryptionProvider = new NobleEncryptionProvider();
