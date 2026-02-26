// packages/provenancekit-sdk/src/client.ts
import { Api, ApiClientOptions } from "./api";
import { ProvenanceKitError } from "./errors";
import { signAction, type ActionSignPayload, type ActionProof } from "./signing";
import {
  decryptVector,
  searchVectors,
  resolveKey,
} from "./vector-crypto";
import type {
  UploadMatchResult,
  DuplicateDetails,
  ProvenanceGraph,
  Match,
  ProvenanceBundle,
  Distribution,
  DistributionPreviewResult,
  MediaReadResult,
  MediaVerifyResult,
  MediaImportResult,
  AICheckResult,
  SupportedFormat,
  TextSearchResult,
  SessionProvenance,
  SearchOpts,
  SearchResult,
  EncryptedEmbeddingRecord,
  EntityResult,
  EntityListResult,
  EntityListOpts,
  AIAgentResult,
  OwnershipState,
  OwnershipClaimOpts,
  OwnershipTransferOpts,
  OwnershipActionResult,
} from "./types";

/**
 * Merge server-side (pgvector) and client-side (encrypted) search results.
 * Deduplicates by CID, ranks by score, and returns the top-K.
 */
function mergeResults(
  server: SearchResult[],
  encrypted: SearchResult[],
  topK: number
): SearchResult[] {
  const seen = new Set<string>();
  const all: SearchResult[] = [];

  for (const r of [...server, ...encrypted]) {
    if (!seen.has(r.cid)) {
      seen.add(r.cid);
      all.push(r);
    }
  }

  all.sort((a, b) => b.score - a.score);
  return all.slice(0, topK);
}

function asBlob(input: Blob | File | Buffer | Uint8Array): Blob {
  if (input instanceof Blob) return input;
  if (typeof Buffer !== "undefined" && input instanceof Buffer)
    return new Blob([input]);
  if (input instanceof Uint8Array) return new Blob([input]);
  throw new TypeError("Unsupported binary type");
}

export interface FileOpts {
  entity: {
    id?: string;
    role: string;
    name?: string;
    publicKey?: string;
  };
  action?: {
    type?: string;
    inputCids?: string[];
    toolCid?: string;
    proof?: string;
    /** Structured action proof (ext:proof@1.0.0) */
    actionProof?: ActionProof;
    extensions?: Record<string, any>;
  };
  resourceType?: string;
  sessionId?: string;
}

export interface UploadOptions {
  type?: string;
  topK?: number;
  min?: number;
}

export interface FileResult {
  cid: string;
  actionId?: string;
  entityId?: string;
  duplicate?: DuplicateDetails;
  matched?: Match;
}

export interface ProvenanceKitOptions extends ApiClientOptions {
  /**
   * Project ID for multi-tenant isolation.
   * All activities will be tagged with this ID,
   * and session queries will be scoped to it.
   */
  projectId?: string;

  /**
   * Hex-encoded Ed25519 private key for auto-signing actions.
   * When set, all actions created via `file()` are automatically signed.
   */
  signingKey?: string;

  /**
   * Entity ID to bind to signed actions.
   * Required when `signingKey` is set.
   */
  signingEntityId?: string;
}

export class ProvenanceKit {
  private readonly api: Api;
  private readonly projectId?: string;
  private readonly signingKey?: string;
  private readonly signingEntityId?: string;
  readonly unclaimed = "ent:unclaimed";

  constructor(opts: ProvenanceKitOptions = {}) {
    this.api = new Api(opts);
    this.projectId = opts.projectId;
    this.signingKey = opts.signingKey;
    this.signingEntityId = opts.signingEntityId;

    if (this.signingKey && !this.signingEntityId) {
      throw new Error("signingEntityId is required when signingKey is set");
    }
  }

  private form(file: Blob | File | Buffer | Uint8Array, json: unknown) {
    const f = new FormData();
    f.append("file", asBlob(file), (file as any).name ?? "file.bin");
    // Auto-inject projectId if set on the client
    const base = (typeof json === "object" && json !== null) ? json : {};
    const payload = this.projectId ? { ...base, projectId: this.projectId } : base;
    f.append("json", JSON.stringify(payload));
    return f;
  }

  uploadAndMatch(
    file: Blob | File | Buffer | Uint8Array,
    o: UploadOptions = {}
  ) {
    const qs = `topK=${o.topK ?? 5}&min=${o.min ?? 0}${
      o.type ? `&type=${o.type}` : ""
    }`;
    const form = new FormData();
    form.append("file", asBlob(file), (file as any).name ?? "file.bin");
    return this.api.postForm<UploadMatchResult>(`/search/file?${qs}`, form);
  }

  async file(
    file: Blob | File | Buffer | Uint8Array,
    opts: FileOpts
  ): Promise<FileResult> {
    // Auto-sign if signing key is configured and no proof already provided
    let finalOpts = opts;
    if (this.signingKey && !opts.action?.actionProof) {
      const entityId = opts.entity.id ?? this.signingEntityId!;
      const actionType = opts.action?.type ?? "create";
      const inputCids = opts.action?.inputCids ?? [];
      const timestamp = new Date().toISOString();

      const payload: ActionSignPayload = {
        entityId,
        actionType,
        inputs: inputCids,
        timestamp,
      };

      const actionProof = await signAction(payload, this.signingKey);

      finalOpts = {
        ...opts,
        action: { ...opts.action, actionProof },
      };
    }

    try {
      const res = await this.api.postForm<{
        cid: string;
        actionId: string;
        entityId: string;
      }>("/activity", this.form(file, finalOpts));
      return { ...res };
    } catch (e) {
      if (e instanceof ProvenanceKitError && e.code === "Duplicate") {
        const d = e.details as DuplicateDetails;
        return {
          cid: d.cid,
          duplicate: d,
          matched: {
            cid: d.cid,
            score: d.similarity,
            type: opts.resourceType ?? "unknown",
          },
        };
      }
      throw e;
    }
  }

  graph(cid: string, depth = 10) {
    return this.api.get<ProvenanceGraph>(`/graph/${cid}?depth=${depth}`);
  }

  async entity(e: {
    role: string;
    name?: string;
    publicKey?: string;
  }) {
    const r = await this.api.postJSON<{ id: string }>("/entity", e);
    return r.id;
  }

  /*─────────────────────────────────────────────────────────────*\
   | Session Provenance                                          |
   |                                                              |
   | Sessions are managed by the consuming app. Pass sessionId    |
   | when creating activities to link them. Query provenance      |
   | for a session using this method.                             |
  \*─────────────────────────────────────────────────────────────*/

  /*─────────────────────────────────────────────────────────────*\
   | Health                                                       |
  \*─────────────────────────────────────────────────────────────*/

  health() {
    return this.api.get<string>("/");
  }

  /*─────────────────────────────────────────────────────────────*\
   | Entity Queries                                               |
  \*─────────────────────────────────────────────────────────────*/

  /**
   * Get a single entity by ID, including AI agent info if applicable.
   */
  getEntity(id: string) {
    return this.api.get<EntityResult>(`/entity/${encodeURIComponent(id)}`);
  }

  /**
   * List entities with optional filtering by role and pagination.
   */
  listEntities(opts: EntityListOpts = {}) {
    const params = new URLSearchParams();
    if (opts.role) params.set("role", opts.role);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return this.api.get<EntityListResult>(`/entities${qs ? `?${qs}` : ""}`);
  }

  /**
   * Get AI agent extension data for an entity.
   * Throws if the entity is not an AI agent.
   */
  getAIAgent(id: string) {
    return this.api.get<AIAgentResult>(`/entity/${encodeURIComponent(id)}/ai-agent`);
  }

  /*─────────────────────────────────────────────────────────────*\
   | Ownership                                                    |
  \*─────────────────────────────────────────────────────────────*/

  /**
   * Get the current ownership state and full history for a resource.
   */
  ownership(cid: string) {
    return this.api.get<OwnershipState>(`/resource/${cid}/ownership`);
  }

  /**
   * Record an ownership claim for a resource.
   * Does NOT change ownership state — trust level is conveyed via
   * ext:verification@1.0.0 on the returned action.
   */
  ownershipClaim(cid: string, opts: OwnershipClaimOpts) {
    return this.api.postJSON<OwnershipActionResult>(
      `/resource/${cid}/ownership/claim`,
      opts
    );
  }

  /**
   * Transfer ownership of a resource to a new entity.
   * Always updates ownership state. The returned action carries
   * ext:verification@1.0.0 showing whether the transfer was authorized.
   */
  ownershipTransfer(cid: string, opts: OwnershipTransferOpts) {
    return this.api.postJSON<OwnershipActionResult>(
      `/resource/${cid}/ownership/transfer`,
      opts
    );
  }

  /**
   * Get all provenance records linked to an app-managed session.
   * Returns actions, resources, entities, and attributions
   * that were created with the given sessionId.
   *
   * Automatically scoped by projectId if set on the client.
   */
  sessionProvenance(sessionId: string) {
    const qs = this.projectId ? `?projectId=${encodeURIComponent(this.projectId)}` : "";
    return this.api.get<SessionProvenance>(`/session/${sessionId}/provenance${qs}`);
  }

  /*─────────────────────────────────────────────────────────────*\
   | Provenance Bundle & Chain                                    |
  \*─────────────────────────────────────────────────────────────*/

  /**
   * Get the full provenance bundle for a resource.
   * Includes resource, actions, entities, attributions, and lineage.
   */
  bundle(cid: string) {
    return this.api.get<ProvenanceBundle>(`/bundle/${cid}`);
  }

  /**
   * Get the provenance chain for a resource.
   * Returns the same data as bundle() - alias for compatibility.
   */
  provenance(cid: string) {
    return this.api.get<ProvenanceBundle>(`/provenance/${cid}`);
  }

  /**
   * Find resources similar to the given resource.
   */
  similar(cid: string, topK = 5) {
    return this.api.get<Match[]>(`/similar/${cid}?topK=${topK}`);
  }

  /*─────────────────────────────────────────────────────────────*\
   | Search                                                       |
  \*─────────────────────────────────────────────────────────────*/

  /**
   * Search for similar resources by text query.
   */
  searchText(query: string, opts: { topK?: number; type?: string } = {}) {
    return this.api.postJSON<TextSearchResult>("/search/text", {
      query,
      topK: opts.topK ?? 5,
      type: opts.type,
    });
  }

  /**
   * Unified search across encrypted and non-encrypted resources.
   *
   * Non-encrypted resources: server-side pgvector similarity search (fast, scalable).
   * Encrypted resources: SDK fetches encrypted vector blobs from the server,
   * decrypts them locally with the provided key, runs brute-force cosine
   * similarity in-memory, and merges results with server-side matches.
   *
   * The server never sees plaintext vectors for encrypted resources.
   * Without an encryptionKey, only non-encrypted results are returned.
   */
  async search(query: string, opts: SearchOpts = {}): Promise<SearchResult[]> {
    const { topK = 5, minScore = 0, type, encryptionKey } = opts;

    // Server-side search for non-encrypted resources
    const serverPromise = this.api
      .postJSON<TextSearchResult>("/search/text", {
        text: query,
        topK,
        minScore,
        type,
      })
      .then((r) =>
        r.matches.map((m) => ({
          cid: m.cid,
          score: m.score,
          type: m.type,
          encrypted: false,
        }))
      )
      .catch(() => [] as SearchResult[]);

    // Client-side search for encrypted resources (only if key provided)
    let encryptedResults: SearchResult[] = [];
    if (encryptionKey) {
      try {
        encryptedResults = await this.searchEncryptedVectors(
          query,
          encryptionKey,
          { topK, minScore, type }
        );
      } catch {
        // Encrypted search failure should not break the overall search
      }
    }

    const serverResults = await serverPromise;
    return mergeResults(serverResults, encryptedResults, topK);
  }

  /**
   * Fetch encrypted vector blobs, decrypt locally, and run similarity search.
   * This is the client-side leg of the unified search — the server only
   * provides opaque encrypted blobs it cannot read.
   */
  private async searchEncryptedVectors(
    query: string,
    encryptionKey: string | Uint8Array,
    opts: { topK?: number; minScore?: number; type?: string }
  ): Promise<SearchResult[]> {
    const key = resolveKey(encryptionKey);

    // Fetch encrypted embedding blobs from the server
    const qs = opts.type ? `&kind=${opts.type}` : "";
    const response = await this.api.get<{
      embeddings: EncryptedEmbeddingRecord[];
    }>(`/embeddings/encrypted?limit=10000${qs}`);

    if (!response.embeddings.length) return [];

    // Decrypt vectors locally — the key never leaves the client
    const decrypted: Array<{ ref: string; vec: Float32Array; kind?: string }> = [];
    for (const record of response.embeddings) {
      try {
        const vec = decryptVector(record.blob, key);
        decrypted.push({ ref: record.ref, vec, kind: record.kind });
      } catch {
        // Skip vectors that don't decrypt with this key (different owner)
      }
    }

    if (!decrypted.length) return [];

    // Generate a query vector from the first decrypted vector's dimensionality.
    // For text search, we need the server to generate the query embedding.
    const queryEmbedding = await this.api.postJSON<{ vector: number[] }>(
      "/search/text/vector",
      { text: query }
    ).catch(() => null);

    if (!queryEmbedding?.vector) return [];

    const queryVec = new Float32Array(queryEmbedding.vector);
    const results = searchVectors(queryVec, decrypted, opts);

    return results.map((r) => ({
      cid: r.ref,
      score: r.score,
      type: opts.type,
      encrypted: true,
    }));
  }

  /*─────────────────────────────────────────────────────────────*\
   | Distribution / Payments                                      |
  \*─────────────────────────────────────────────────────────────*/

  /**
   * Calculate payment distribution for a resource based on its attributions.
   */
  distribution(cid: string) {
    return this.api.get<Distribution>(`/distribution/${cid}`);
  }

  /**
   * Preview distribution for multiple resources.
   * Optionally combine them into a single distribution.
   */
  distributionPreview(cids: string[], combine = false) {
    return this.api.postJSON<DistributionPreviewResult>("/distribution/preview", {
      cids,
      combine,
    });
  }

  /*─────────────────────────────────────────────────────────────*\
   | Media / C2PA                                                 |
  \*─────────────────────────────────────────────────────────────*/

  /**
   * Get list of supported media formats for C2PA operations.
   */
  mediaFormats() {
    return this.api.get<SupportedFormat[]>("/media/formats");
  }

  /**
   * Read C2PA manifest from a media file.
   */
  mediaRead(file: Blob | File | Buffer | Uint8Array) {
    const form = new FormData();
    form.append("file", asBlob(file), (file as any).name ?? "file.bin");
    return this.api.postForm<MediaReadResult>("/media/read", form);
  }

  /**
   * Verify C2PA manifest in a media file.
   */
  mediaVerify(file: Blob | File | Buffer | Uint8Array) {
    const form = new FormData();
    form.append("file", asBlob(file), (file as any).name ?? "file.bin");
    return this.api.postForm<MediaVerifyResult>("/media/verify", form);
  }

  /**
   * Import C2PA provenance from a media file as EAA records.
   */
  mediaImport(
    file: Blob | File | Buffer | Uint8Array,
    opts: { sessionId?: string } = {}
  ) {
    const form = new FormData();
    form.append("file", asBlob(file), (file as any).name ?? "file.bin");
    if (opts.sessionId) {
      form.append("sessionId", opts.sessionId);
    }
    return this.api.postForm<MediaImportResult>("/media/import", form);
  }

  /**
   * Check if a resource was AI-generated based on C2PA or extension data.
   */
  aiCheck(cid: string) {
    return this.api.get<AICheckResult>(`/media/ai-check/${cid}`);
  }
}
