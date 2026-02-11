// packages/provenancekit-sdk/src/client.ts
import { Api, ApiClientOptions } from "./api";
import { ProvenanceKitError } from "./errors";
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
} from "./types";

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
}

export class ProvenanceKit {
  private readonly api: Api;
  private readonly projectId?: string;
  readonly unclaimed = "ent:unclaimed";

  constructor(opts: ProvenanceKitOptions = {}) {
    this.api = new Api(opts);
    this.projectId = opts.projectId;
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
    try {
      const res = await this.api.postForm<{
        cid: string;
        actionId: string;
        entityId: string;
      }>("/activity", this.form(file, opts));
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

  async tool(
    spec: Blob | File | Buffer | Uint8Array,
    meta: { name?: string; sessionId?: string }
  ) {
    const res = await this.file(spec, {
      entity: { role: "organization", name: meta.name ?? "Tool Publisher" },
      resourceType: "data",
      sessionId: meta.sessionId,
    });
    return res.cid;
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
