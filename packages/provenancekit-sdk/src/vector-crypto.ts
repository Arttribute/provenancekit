/**
 * Client-side vector decryption and similarity search.
 *
 * Encrypted vectors are stored server-side as JSON EncryptionEnvelope blobs —
 * opaque ciphertext the server cannot read. This module decrypts them locally
 * and runs brute-force cosine similarity.
 *
 * Performance characteristics (no indexing needed at these scales):
 * - 512D float32 vectors: 100K vectors ≈ 200MB, linear scan < 50ms
 * - With int8 quantization: 100K vectors ≈ 50MB
 */

import {
  decrypt,
  fromEnvelope,
  fromBase64,
  type EncryptionEnvelope,
} from "@provenancekit/privacy";

/**
 * Decrypt an encrypted embedding blob back to a Float32Array vector.
 * The blob is a JSON-serialized EncryptionEnvelope produced by the server
 * during upload (activity service encrypts the vector with the resource key).
 */
export function decryptVector(blob: string, key: Uint8Array): Float32Array {
  const envelope: EncryptionEnvelope = JSON.parse(blob);
  const { ciphertext, nonce, algorithm } = fromEnvelope(envelope);
  const plainBytes = decrypt(ciphertext, key, nonce, algorithm);
  return new Float32Array(plainBytes.buffer, plainBytes.byteOffset, plainBytes.byteLength / 4);
}

/**
 * Cosine similarity between two vectors.
 * Both vectors must be the same dimension.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Brute-force similarity search over decrypted vectors.
 * Returns results sorted by descending similarity score.
 */
export function searchVectors(
  query: Float32Array,
  vectors: Array<{ ref: string; vec: Float32Array; kind?: string }>,
  opts: { topK?: number; minScore?: number; type?: string } = {}
): Array<{ ref: string; score: number }> {
  const { topK = 5, minScore = 0, type } = opts;

  const scored: Array<{ ref: string; score: number }> = [];

  for (const entry of vectors) {
    if (type && entry.kind !== type) continue;
    const score = cosineSimilarity(query, entry.vec);
    if (score >= minScore) {
      scored.push({ ref: entry.ref, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Resolve an encryption key from either base64 string or raw Uint8Array.
 */
export function resolveKey(key: string | Uint8Array): Uint8Array {
  if (key instanceof Uint8Array) return key;
  return fromBase64(key);
}
