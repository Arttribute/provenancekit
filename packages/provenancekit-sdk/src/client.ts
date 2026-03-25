// packages/provenancekit-sdk/src/client.ts
import { Api, ApiClientOptions } from "./api";
import { ProvenanceKitError } from "./errors";
import { signAction, type ActionSignPayload, type ActionProof } from "./signing";
import type { IChainAdapter } from "./chain";
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
 * Compute a cache key for a file() call: SHA-256 of the file bytes combined
 * with the entity ID and action context so different callers recording the
 * same content each get their own action, while retries from the same caller
 * skip the redundant round-trip.
 *
 * Uses Web Crypto (crypto.subtle), available in Node.js 15+ and all modern
 * browsers without any imports.
 */
async function fileCallKey(
  file: Blob | File | Buffer | Uint8Array,
  opts: FileOpts
): Promise<string> {
  // Normalise to Uint8Array
  let bytes: Uint8Array;
  if (file instanceof Blob) {
    bytes = new Uint8Array(await file.arrayBuffer());
  } else if (typeof Buffer !== "undefined" && file instanceof Buffer) {
    bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  } else {
    bytes = file as Uint8Array;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Include entity ID + action type + input CIDs so different callers or
  // different action contexts with the same bytes stay separate cache entries.
  const ctx = [
    opts.entity.id ?? "",
    opts.action?.type ?? "create",
    (opts.action?.inputCids ?? []).join(","),
    opts.sessionId ?? "",
  ].join("::");

  return `${hex}::${ctx}`;
}

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
    return new Blob([input as unknown as ArrayBuffer]);
  if (input instanceof Uint8Array) return new Blob([input as unknown as ArrayBuffer]);
  throw new TypeError("Unsupported binary type");
}

export interface AIToolOpts {
  provider: string;
  model: string;
  version?: string;
  promptHash?: string;
  prompt?: string;
  systemPrompt?: string;
  parameters?: Record<string, unknown>;
  tokensUsed?: number;
  generationTime?: number;
  seed?: number;
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
    /** AI tool metadata — stored as ext:ai@1.0.0 with proper withAITool() processing */
    aiTool?: AIToolOpts;
  };
  resourceType?: string;
  sessionId?: string;
}

export interface UploadOptions {
  type?: string;
  topK?: number;
  min?: number;
}

export interface OnchainRecord {
  /** Transaction hash of the on-chain recording. */
  txHash: string;
  /** On-chain action ID (bytes32 as hex). */
  actionId: string;
  /** Chain ID where the action was recorded. */
  chainId?: number;
  /** Human-readable chain name. */
  chainName?: string;
  /** Address of the ProvenanceRegistry contract. */
  contractAddress: string;
}

export interface FileResult {
  cid: string;
  actionId?: string;
  entityId?: string;
  duplicate?: DuplicateDetails;
  matched?: Match;
  /** Present when on-chain recording succeeded via a configured chain adapter. */
  onchain?: OnchainRecord;
}

export interface ProvenanceKitOptions extends ApiClientOptions {
  /**
   * Project ID for multi-tenant isolation.
   *
   * **Optional when using the ProvenanceKit dashboard (pk-app).**
   * API keys created in the dashboard embed the project ID server-side —
   * the API derives it automatically from the key, so you don't need to pass it here.
   *
   * Only required when using the legacy static `API_KEYS` env-var auth (self-hosted),
   * or when you want to explicitly override the key's project for testing.
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

  /**
   * Optional on-chain adapter. When set, actions recorded via `file()` are
   * also recorded on the ProvenanceRegistry smart contract. The result will
   * include an `onchain` field with the transaction hash and on-chain action ID.
   *
   * On-chain recording is fire-and-forget by default (failures are non-fatal).
   * Use `createViemAdapter` to create a viem-backed adapter, or implement
   * `IChainAdapter` directly for other EVM clients (ethers.js, wagmi, etc.).
   */
  chain?: IChainAdapter;

  /**
   * In-memory bundle cache TTL in seconds.
   *
   * When set, `bundle()` and `provenance()` responses are cached in-memory
   * keyed by CID. Useful in Node.js server environments (Next.js API routes,
   * Express middleware) where the browser HTTP cache is not available.
   *
   * CIDs are content-addressed so the resource itself is immutable, but
   * lineage can grow as new transforms reference old CIDs as inputs.
   * A short TTL (e.g. 60–300 s) balances freshness against DB load.
   *
   * Default: 0 (disabled). Browsers don't need this — the HTTP cache
   * handles the `Cache-Control` + ETag headers the server already sends.
   */
  bundleCacheTtl?: number;

  /**
   * Client-side file deduplication cache TTL in seconds.
   *
   * When > 0, `file()` caches successful results keyed by
   * `sha256(bytes) + entityId + actionType + inputCids`. A subsequent call
   * with identical bytes from the same entity returns the cached `FileResult`
   * without making a network request.
   *
   * This primarily helps in two situations:
   *   1. **Retry loops** — if the server processed the request but the
   *      response was lost, the retry gets an instant cache hit instead of
   *      re-uploading the full file and waiting for the API to detect the
   *      duplicate.
   *   2. **Accidental double-calls** — e.g. the same content submitted twice
   *      by application code.
   *
   * Cache entries are scoped to the `ProvenanceKit` instance so different
   * API keys or projects never share cached results.
   *
   * Default: 300 (5 minutes). Set to 0 to disable.
   */
  fileDeduplicationTtl?: number;
}

interface BundleCacheEntry {
  value: ProvenanceBundle;
  expiresAt: number;
}

interface FileCacheEntry {
  result: FileResult;
  expiresAt: number;
}

export class ProvenanceKit {
  private readonly api: Api;
  private readonly projectId?: string;
  private readonly signingKey?: string;
  private readonly signingEntityId?: string;
  private readonly chainAdapter?: IChainAdapter;
  private readonly bundleCache: Map<string, BundleCacheEntry> | null;
  private readonly bundleCacheTtlMs: number;
  private readonly fileCache: Map<string, FileCacheEntry> | null;
  private readonly fileCacheTtlMs: number;
  readonly unclaimed = "ent:unclaimed";

  constructor(opts: ProvenanceKitOptions = {}) {
    this.api = new Api(opts);
    this.projectId = opts.projectId;
    this.signingKey = opts.signingKey;
    this.signingEntityId = opts.signingEntityId;
    this.chainAdapter = opts.chain;
    this.bundleCacheTtlMs = (opts.bundleCacheTtl ?? 0) * 1000;
    this.bundleCache = this.bundleCacheTtlMs > 0 ? new Map() : null;
    this.fileCacheTtlMs = (opts.fileDeduplicationTtl ?? 300) * 1000;
    this.fileCache = this.fileCacheTtlMs > 0 ? new Map() : null;

    if (this.signingKey && !this.signingEntityId) {
      throw new Error("signingEntityId is required when signingKey is set");
    }
  }

  private getCachedBundle(cid: string): ProvenanceBundle | null {
    if (!this.bundleCache) return null;
    const entry = this.bundleCache.get(cid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.bundleCache.delete(cid);
      return null;
    }
    return entry.value;
  }

  private setCachedBundle(cid: string, bundle: ProvenanceBundle): void {
    if (!this.bundleCache) return;
    this.bundleCache.set(cid, { value: bundle, expiresAt: Date.now() + this.bundleCacheTtlMs });
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

  async uploadAndMatch(
    file: Blob | File | Buffer | Uint8Array,
    o: UploadOptions = {}
  ): Promise<UploadMatchResult> {
    const qs = `topK=${o.topK ?? 5}&min=${o.min ?? 0}${
      o.type ? `&type=${o.type}` : ""
    }`;
    const form = new FormData();
    form.append("file", asBlob(file), (file as any).name ?? "file.bin");
    const raw = await this.api.postForm<
      UploadMatchResult | Array<{ cid: string; score: number; type?: string }>
    >(`/search/file?${qs}`, form);

    // Normalize: older API versions return a plain SearchResult[]; newer returns { verdict, matches }
    if (Array.isArray(raw)) {
      const matches = raw;
      const topScore = matches[0]?.score ?? 0;
      const verdict: UploadMatchResult["verdict"] =
        matches.length === 0 ? "no-match" : topScore >= 0.95 ? "auto" : "review";
      return { verdict, matches };
    }
    return raw;
  }

  async file(
    file: Blob | File | Buffer | Uint8Array,
    opts: FileOpts
  ): Promise<FileResult> {
    // Check client-side deduplication cache before making any network call.
    // Cache key = sha256(bytes) + entityId + actionType + inputCids + sessionId,
    // so different entities or action contexts never share a cached result.
    let cacheKey: string | null = null;
    if (this.fileCache) {
      cacheKey = await fileCallKey(file, opts);
      const cached = this.fileCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.result;
      }
    }

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

      const result: FileResult = { ...res };

      // Record on-chain if a chain adapter is configured (fire-and-forget)
      if (this.chainAdapter) {
        try {
          const onchainResult = await this.chainAdapter.recordAction({
            actionType: finalOpts.action?.type ?? "create",
            inputs: finalOpts.action?.inputCids ?? [],
            outputs: [res.cid],
          });
          result.onchain = {
            txHash: onchainResult.txHash,
            actionId: onchainResult.actionId,
            chainId: this.chainAdapter.chainId,
            chainName: this.chainAdapter.chainName,
            contractAddress: this.chainAdapter.contractAddress,
          };
        } catch {
          // On-chain recording is non-fatal — the off-chain record stands
        }
      }

      if (this.fileCache && cacheKey) {
        this.fileCache.set(cacheKey, { result, expiresAt: Date.now() + this.fileCacheTtlMs });
      }
      return result;
    } catch (e) {
      if (e instanceof ProvenanceKitError && e.code === "Duplicate") {
        const d = e.details as DuplicateDetails;
        const result: FileResult = {
          cid: d.cid,
          duplicate: d,
          matched: {
            cid: d.cid,
            score: d.similarity,
            type: opts.resourceType ?? "unknown",
          },
        };
        // Cache the duplicate result too — future retries with the same bytes
        // return instantly without any network call.
        if (this.fileCache && cacheKey) {
          this.fileCache.set(cacheKey, { result, expiresAt: Date.now() + this.fileCacheTtlMs });
        }
        return result;
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
    /** AI agent model config — include when role is "ai" */
    aiAgent?: {
      model: { provider: string; model: string; version?: string };
      delegatedBy?: string;
      autonomyLevel?: "autonomous" | "supervised" | "assistive";
    };
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
   * Scoped by projectId: uses the value set on this client instance,
   * or the project embedded in the API key when using dashboard-issued keys.
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
  async bundle(cid: string): Promise<ProvenanceBundle> {
    const cached = this.getCachedBundle(cid);
    if (cached) return cached;
    const bundle = await this.api.get<ProvenanceBundle>(`/bundle/${cid}`);
    this.setCachedBundle(cid, bundle);
    return bundle;
  }

  /**
   * Get the provenance chain for a resource.
   * Returns the same data as bundle() - alias for compatibility.
   */
  async provenance(cid: string): Promise<ProvenanceBundle> {
    const cached = this.getCachedBundle(cid);
    if (cached) return cached;
    const bundle = await this.api.get<ProvenanceBundle>(`/provenance/${cid}`);
    this.setCachedBundle(cid, bundle);
    return bundle;
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
