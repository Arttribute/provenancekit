/**
 * Embedding Service
 *
 * Generates embeddings and performs vector similarity search
 * using Xenova transformers and @provenancekit/storage.
 */

import { XenovaUniversalProvider } from "./xenova-universal.provider.js";
import { getContext } from "../context.js";
import { config } from "../config.js";
import { encrypt, toEnvelope } from "@provenancekit/privacy";
import { supportsVectors, supportsEncryptedVectors } from "@provenancekit/storage";

export type ResourceKind = "text" | "image" | "audio" | "video" | "tool";

export class EmbeddingService {
  constructor(private p = new XenovaUniversalProvider()) {}

  /**
   * Pre-load embedding models so they're hot before the first request.
   * Safe to call at startup — logs a warning if HuggingFace is unreachable.
   */
  async warmup(): Promise<void> {
    try {
      await this.p.warmup();
      console.log("[PK] Embedding models warmed up.");
    } catch (err) {
      console.warn("[PK] Embedding warmup failed (will retry on first request):", err instanceof Error ? err.message : err);
    }
  }

  /**
   * Generate an embedding vector for content.
   */
  async vector(kind: ResourceKind, dataUriOrUrl: string): Promise<number[]> {
    switch (kind) {
      case "text":
      case "tool":
        return this.p.encodeText(dataUriOrUrl);
      case "image":
        return this.p.encodeImage(dataUriOrUrl);
      case "audio":
        return this.p.encodeAudio(dataUriOrUrl);
      case "video":
        return this.p.encodeVideo(dataUriOrUrl);
    }
  }

  /**
   * Store an embedding for a resource.
   */
  async store(ref: string, vec: number[]): Promise<void> {
    const { dbStorage } = getContext();
    if (!supportsVectors(dbStorage)) return;
    await dbStorage.storeEmbedding(ref, vec);
  }

  /**
   * Cosine-similarity search with verdict classification.
   */
  async match(vec: number[], { high = 0.85, low = 0.75, topK = 5 } = {}) {
    const { dbStorage } = getContext();
    if (!supportsVectors(dbStorage)) return { verdict: "no-match" as const, matches: [] };
    const results = await dbStorage.findSimilar(vec, { limit: topK });

    if (!results.length) return { verdict: "no-match" as const, matches: [] };

    const matches = results.map((r: { ref: string; score: number }) => ({ cid: r.ref, score: r.score }));
    const best = matches[0];

    if (best.score >= high) return { verdict: "auto" as const, matches };
    if (best.score >= low) return { verdict: "review" as const, matches };
    return { verdict: "no-match" as const, matches };
  }

  /**
   * Find similar resources with filtering.
   */
  async matchFiltered(
    vec: number[],
    opts: { topK?: number; minScore?: number; type?: string } = {}
  ): Promise<Array<{ cid: string; type?: string; score: number }>> {
    const { topK = 5, minScore = 0, type } = opts;

    if (!vec || !vec.length) {
      return [];
    }

    const { dbStorage } = getContext();
    if (!supportsVectors(dbStorage)) return [];
    const results = await dbStorage.findSimilar(vec, {
      limit: topK,
      minScore,
      type,
    });

    return results.map((r: { ref: string; score: number; type?: string }) => ({ cid: r.ref, score: r.score }));
  }

  /**
   * Find the top match above a minimum score.
   */
  async matchTop1(
    vec: number[],
    minScore = config.duplicateThreshold,
    type?: string
  ): Promise<{ cid: string; score: number } | undefined> {
    const res = await this.matchFiltered(vec, { topK: 1, minScore, type });
    return res[0];
  }

  /**
   * Encrypt an embedding vector and store it as an opaque blob.
   *
   * The vector is serialized as Float32Array bytes, encrypted with the
   * resource's encryption key, and stored as a JSON EncryptionEnvelope.
   * The server never sees the plaintext vector — only the key holder
   * can decrypt and search it client-side.
   */
  async storeEncrypted(
    ref: string,
    vec: number[],
    key: Uint8Array,
    kind?: string
  ): Promise<void> {
    const { dbStorage } = getContext();
    if (!supportsEncryptedVectors(dbStorage)) {
      throw new Error("Encrypted vector storage not supported by current backend");
    }
    const bytes = new Uint8Array(new Float32Array(vec).buffer);
    const result = encrypt(bytes, key);
    const envelope = toEnvelope(result);
    const blob = JSON.stringify(envelope);
    await dbStorage.storeEncryptedEmbedding(ref, blob, kind);
  }
}
