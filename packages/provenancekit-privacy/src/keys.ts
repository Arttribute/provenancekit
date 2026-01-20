/**
 * Key derivation utilities
 *
 * Provides secure key derivation from passwords, wallet signatures, and other sources.
 */

import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { sha512, sha384 } from "@noble/hashes/sha512";
import { hkdf } from "@noble/hashes/hkdf";
import { randomBytes } from "@noble/ciphers/webcrypto";

import type {
  KeyDerivationOptions,
  DerivedKey,
  IKeyManager,
  CipherAlgorithm,
} from "./types.js";

import { KEY_LENGTH, NONCE_LENGTHS } from "./ciphers.js";

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

/** Default PBKDF2 iterations */
export const DEFAULT_ITERATIONS = 100_000;

/** Default salt length */
export const DEFAULT_SALT_LENGTH = 32;

/** Domain separator for wallet key derivation */
export const WALLET_KEY_DOMAIN = "provenancekit:encryption:v1";

/*─────────────────────────────────────────────────────────────*\
 | Hash Functions                                               |
\*─────────────────────────────────────────────────────────────*/

type HashAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

function getHashFunction(algo: HashAlgorithm) {
  switch (algo) {
    case "SHA-256":
      return sha256;
    case "SHA-384":
      return sha384;
    case "SHA-512":
      return sha512;
    default:
      throw new Error(`Unsupported hash algorithm: ${algo}`);
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Password Key Derivation                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Derive an encryption key from a password using PBKDF2
 *
 * @param password - The password to derive from
 * @param salt - Salt for derivation (will be generated if not provided)
 * @param iterations - Number of iterations (default: 100,000)
 * @param hash - Hash algorithm (default: SHA-256)
 * @returns Derived key and salt
 *
 * @example
 * ```ts
 * const { key, salt } = deriveKeyFromPassword("my-password");
 * // Store salt alongside encrypted data for decryption
 * ```
 */
export function deriveKeyFromPassword(
  password: string,
  salt?: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS,
  hash: HashAlgorithm = "SHA-256"
): DerivedKey {
  const actualSalt = salt ?? randomBytes(DEFAULT_SALT_LENGTH);
  const hashFn = getHashFunction(hash);

  const key = pbkdf2(hashFn, password, actualSalt, {
    c: iterations,
    dkLen: KEY_LENGTH,
  });

  return {
    key,
    salt: actualSalt,
    method: "password",
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Wallet Key Derivation                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Derive an encryption key from a wallet signature using HKDF
 *
 * This allows users to derive encryption keys by signing a message with their wallet.
 * The same signature always produces the same key.
 *
 * @param signature - Signature from wallet (hex string)
 * @param message - The message that was signed
 * @param domain - Domain separator (default: provenancekit:encryption:v1)
 * @returns Derived key
 *
 * @example
 * ```ts
 * // User signs message with wallet
 * const signature = await wallet.signMessage("Encrypt my data");
 * const { key } = deriveKeyFromWallet(signature, "Encrypt my data");
 * ```
 */
export function deriveKeyFromWallet(
  signature: string,
  message: string,
  domain: string = WALLET_KEY_DOMAIN
): DerivedKey {
  // Convert signature from hex to bytes
  const sigBytes = hexToBytes(signature);

  // Use HKDF to derive key from signature
  // Salt is the domain + message hash for deterministic derivation
  const info = new TextEncoder().encode(`${domain}:${message}`);
  const salt = sha256(info);

  const key = hkdf(sha256, sigBytes, salt, info, KEY_LENGTH);

  return {
    key,
    method: "wallet",
  };
}

/**
 * Get the message to sign for wallet key derivation
 *
 * @param purpose - Purpose description for the key
 * @returns Message to sign
 */
export function getWalletSignMessage(purpose: string = "encryption"): string {
  return `ProvenanceKit: Sign this message to derive your ${purpose} key.\n\nThis signature will be used to encrypt/decrypt your private data. Do not share this signature.`;
}

/*─────────────────────────────────────────────────────────────*\
 | Direct Key Usage                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Wrap a direct key for consistent API
 */
export function wrapDirectKey(key: Uint8Array): DerivedKey {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }

  return {
    key: new Uint8Array(key), // Copy to prevent mutation
    method: "direct",
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Unified Key Derivation                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Derive a key based on options
 */
export function deriveKey(options: KeyDerivationOptions): DerivedKey {
  switch (options.method) {
    case "password":
      return deriveKeyFromPassword(
        options.password,
        options.salt,
        options.iterations,
        options.hash
      );
    case "wallet":
      return deriveKeyFromWallet(options.signature, options.message, options.domain);
    case "direct":
      return wrapDirectKey(options.key);
    default:
      throw new Error(`Unsupported key derivation method`);
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Key Manager Implementation                                   |
\*─────────────────────────────────────────────────────────────*/

/**
 * Default key manager implementation
 */
export class DefaultKeyManager implements IKeyManager {
  async deriveKey(options: KeyDerivationOptions): Promise<DerivedKey> {
    return deriveKey(options);
  }

  generateKey(length: number = KEY_LENGTH): Uint8Array {
    return randomBytes(length);
  }

  generateNonce(algorithm: CipherAlgorithm): Uint8Array {
    return randomBytes(NONCE_LENGTHS[algorithm]);
  }
}

/**
 * Default key manager instance
 */
export const defaultKeyManager = new DefaultKeyManager();

/*─────────────────────────────────────────────────────────────*\
 | Utility Functions                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Securely compare two byte arrays (constant-time)
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Generate a random salt
 */
export function generateSalt(length: number = DEFAULT_SALT_LENGTH): Uint8Array {
  return randomBytes(length);
}
