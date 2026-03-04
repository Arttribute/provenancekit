import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "pk_live_";
const KEY_LENGTH = 32; // bytes → 64 hex chars

/** Generate a new API key. Returns the plaintext key (shown once) and its hash + prefix for storage. */
export function generateApiKey(): {
  key: string;
  keyHash: string;
  prefix: string;
} {
  const raw = randomBytes(KEY_LENGTH).toString("hex");
  const key = `${KEY_PREFIX}${raw}`;
  const keyHash = hashApiKey(key);
  const prefix = key.slice(0, 16); // "pk_live_" + 8 chars
  return { key, keyHash, prefix };
}

/** SHA-256 hash of the plaintext key for constant-time comparison. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Validate a plaintext key against its stored hash. */
export function validateApiKey(key: string, storedHash: string): boolean {
  const hash = hashApiKey(key);
  // Constant-time comparison via timing-safe equal
  if (hash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}
