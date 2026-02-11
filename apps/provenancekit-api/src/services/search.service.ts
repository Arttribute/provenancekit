/**
 * Search Service
 *
 * Similarity search using embeddings via @provenancekit/storage.
 */

import { toDataURI, inferKindFromMime } from "../utils.js";
import { EmbeddingService, type ResourceKind } from "../embedding/service.js";
import { ProvenanceKitError } from "../errors.js";

const embedder = new EmbeddingService();

export interface SearchOptions {
  type?: string;
  topK?: number;
  minScore?: number;
}

export interface SearchResult {
  cid: string;
  score: number;
  type?: string;
}

/**
 * Search for similar resources by uploaded file.
 */
export async function searchByFile(
  file: File,
  opts: SearchOptions = {}
): Promise<SearchResult[]> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";

  const kind = (opts.type ?? inferKindFromMime(mime)) as ResourceKind;
  if (!kind) {
    throw new ProvenanceKitError(
      "Unsupported",
      `Cannot infer resource kind from mime ${mime}`
    );
  }

  const vec = await embedder.vector(kind, toDataURI(bytes, mime));
  if (!vec?.length) {
    throw new ProvenanceKitError("EmbeddingFailed", `Failed to generate vector for ${kind}`);
  }

  return embedder.matchFiltered(vec, { ...opts, type: kind });
}

/**
 * Search for similar resources by text prompt.
 */
export async function searchByText(
  text: string,
  opts: SearchOptions = {}
): Promise<SearchResult[]> {
  const vec = await embedder.vector("text", text);
  if (!vec?.length) {
    throw new ProvenanceKitError("EmbeddingFailed", "Failed to generate vector for text");
  }

  return embedder.matchFiltered(vec, opts);
}
