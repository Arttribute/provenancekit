/**
 * Search Service
 *
 * Similarity search using embeddings via @provenancekit/storage.
 */

import { createHash } from "node:crypto";
import { toDataURI, inferKindFromMime } from "../utils.js";
import { getContext } from "../context.js";
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

  const exactMatch = await findExactMatch(bytes);

  let vec: number[];
  try {
    vec = await embedder.vector(kind, toDataURI(bytes, mime));
  } catch (error) {
    if (exactMatch) return [exactMatch];
    throw error;
  }
  if (!vec?.length) {
    if (exactMatch) return [exactMatch];
    throw new ProvenanceKitError("EmbeddingFailed", `Failed to generate vector for ${kind}`);
  }

  const matches = await embedder.matchFiltered(vec, { ...opts, type: kind });
  if (!exactMatch) return matches;

  return [
    exactMatch,
    ...matches.filter((match) => match.cid !== exactMatch.cid),
  ].slice(0, opts.topK ?? 5);
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

async function findExactMatch(bytes: Buffer): Promise<SearchResult | null> {
  const { dbStorage } = getContext();
  const integrity = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const resource = await dbStorage.getResourceByIntegrity(integrity);
  const cid = resource?.address?.ref;
  if (!cid) return null;

  return {
    cid,
    type: resource.type,
    score: 1,
  };
}
