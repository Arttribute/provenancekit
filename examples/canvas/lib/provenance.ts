/**
 * ProvenanceKit platform client for Canvas.
 *
 * Architecture:
 *   Canvas is a platform app that holds ONE server-side PK API key
 *   (PROVENANCEKIT_API_KEY env var). All users' content is recorded
 *   within this single project. Each user is identified as a PK entity
 *   using their Privy DID as the entityId — stable and globally unique.
 *
 *   Users do NOT manage their own PK API keys. The platform handles
 *   provenance on their behalf.
 *
 * Usage pattern:
 *   const pk = getPlatformPKClient();
 *   if (!pk) { // PK not configured, skip provenance gracefully }
 */

import { ProvenanceKit } from "@provenancekit/sdk";

const PK_API_KEY = process.env.PROVENANCEKIT_API_KEY;

/**
 * Returns the platform-level ProvenanceKit SDK instance, or null if unconfigured.
 * The SDK defaults to https://api.provenancekit.com — no URL env var needed.
 */
export function getPlatformPKClient(): ProvenanceKit | null {
  if (!PK_API_KEY) return null;
  return new ProvenanceKit({ apiKey: PK_API_KEY });
}

export interface DistributionEntry {
  entityId: string;
  wallet?: string;
  /** Basis points (0–10000) */
  bps: number;
  /** Human-readable percentage string, e.g. "33.33" */
  percentage: string;
}

/**
 * CanvasPKClient — thin wrapper around the SDK with Canvas-specific helpers.
 * All methods are async and swallow non-fatal errors.
 */
export class CanvasPKClient {
  private pk: ProvenanceKit;

  constructor(pk: ProvenanceKit) {
    this.pk = pk;
  }

  /**
   * Upload content and record a "create" action.
   * Attaches license, payment, and AI-training extensions.
   */
  async recordNewPost(opts: {
    authorPrivyDid: string;
    authorDisplayName: string;
    authorWallet?: string;
    contentBlob: Blob;
    licenseType: string;
    commercial: boolean;
    aiTraining: "permitted" | "reserved" | "unspecified";
    tags?: string[];
  }): Promise<{ actionId: string; cid: string; entityId: string }> {
    const result = await this.pk.file(opts.contentBlob, {
      entity: {
        id: opts.authorPrivyDid,
        role: "human",
        name: opts.authorDisplayName,
      },
      action: {
        type: "create",
        extensions: {
          "ext:license@1.0.0": {
            type: opts.licenseType,
            commercial: opts.commercial,
            aiTraining: opts.aiTraining,
          },
          ...(opts.authorWallet && {
            "ext:payment@1.0.0": {
              method: "splits",
              recipient: opts.authorWallet,
            },
          }),
          ...(opts.tags?.length && {
            "ext:tags@1.0.0": { tags: opts.tags },
          }),
        },
      },
    });

    return {
      actionId: result.actionId ?? "",
      cid: result.cid,
      entityId: result.entityId ?? opts.authorPrivyDid,
    };
  }

  /**
   * Upload remix content and record a "transform" action with the original as input.
   */
  async recordRemix(opts: {
    remixerPrivyDid: string;
    remixerDisplayName: string;
    remixerWallet?: string;
    originalCid: string;
    remixBlob: Blob;
    remixNote?: string;
    licenseType?: string;
    aiTraining?: "permitted" | "reserved" | "unspecified";
  }): Promise<{ actionId: string; cid: string; entityId: string }> {
    const result = await this.pk.file(opts.remixBlob, {
      entity: {
        id: opts.remixerPrivyDid,
        role: "human",
        name: opts.remixerDisplayName,
      },
      action: {
        type: "transform",
        inputCids: [opts.originalCid],
        extensions: {
          ...(opts.remixNote && {
            "ext:attribution@1.0.0": { note: opts.remixNote },
          }),
          ...(opts.licenseType && {
            "ext:license@1.0.0": {
              type: opts.licenseType,
              commercial: !["CC-BY-NC-4.0", "all-rights-reserved"].includes(opts.licenseType),
              aiTraining: opts.aiTraining ?? "unspecified",
            },
          }),
          ...(opts.remixerWallet && {
            "ext:payment@1.0.0": {
              method: "splits",
              recipient: opts.remixerWallet,
            },
          }),
        },
      },
    });

    return {
      actionId: result.actionId ?? "",
      cid: result.cid,
      entityId: result.entityId ?? opts.remixerPrivyDid,
    };
  }

  /**
   * Upload a media file and record a "create" action for it.
   * Used when a post has attached images/video/audio.
   */
  async recordMediaUpload(opts: {
    authorPrivyDid: string;
    authorDisplayName: string;
    mediaBlob: Blob;
    mimeType: string;
    licenseType?: string;
    aiTraining?: "permitted" | "reserved" | "unspecified";
  }): Promise<{ cid: string; actionId: string }> {
    const result = await this.pk.file(opts.mediaBlob, {
      entity: { id: opts.authorPrivyDid, role: "human", name: opts.authorDisplayName },
      action: {
        type: "create",
        extensions: {
          ...(opts.licenseType && {
            "ext:license@1.0.0": {
              type: opts.licenseType,
              commercial: !["CC-BY-NC-4.0", "all-rights-reserved"].includes(opts.licenseType),
              aiTraining: opts.aiTraining ?? "unspecified",
            },
          }),
        },
      },
    });
    return { cid: result.cid, actionId: result.actionId ?? "" };
  }

  /** Calculate revenue distribution for a CID (walks the provenance graph). */
  async getDistribution(cid: string): Promise<DistributionEntry[]> {
    const dist = await this.pk.distribution(cid);
    return dist.entries.map((e) => ({
      entityId: e.entityId,
      wallet: e.payment?.address,
      bps: e.bps,
      percentage: e.percentage,
    }));
  }

  /** Get the full provenance bundle for a CID. */
  async getBundle(cid: string) {
    return this.pk.bundle(cid);
  }

  /** Get the provenance graph for a CID. */
  async getGraph(cid: string, depth = 3) {
    return this.pk.graph(cid, depth);
  }
}

/**
 * Get the platform CanvasPKClient, or null if PROVENANCEKIT_API_KEY is not set.
 * Safe to call in any API route — returns null when PK is not configured so
 * the route can skip provenance recording without crashing.
 */
export function getPlatformClient(): CanvasPKClient | null {
  const pk = getPlatformPKClient();
  if (!pk) return null;
  return new CanvasPKClient(pk);
}
