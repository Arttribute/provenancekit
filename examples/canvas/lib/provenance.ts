/**
 * ProvenanceKit helpers for recording canvas content provenance.
 *
 * Uses the official @provenancekit/sdk — no raw API fetch calls.
 *
 * Two main flows:
 *   1. New post: pk.file() uploads content and records a "create" action
 *      with license + payment extensions in one call.
 *   2. Remix: pk.file() uploads remix content and records a "transform" action
 *      with the original CID as input.
 *
 * Revenue distribution:
 *   pk.distribution() walks the provenance graph and returns basis-point
 *   shares for each contributor. These are used to deploy a 0xSplits contract.
 */

import { ProvenanceKit } from "@provenancekit/sdk";
import type { CanvasUser } from "@/types";

function createPK(apiKey: string, apiUrl: string): ProvenanceKit {
  return new ProvenanceKit({ baseUrl: apiUrl, apiKey });
}

export interface DistributionEntry {
  entityId: string;
  wallet?: string;
  /** Basis points (0–10000) */
  bps: number;
  /** Human-readable percentage string, e.g. "33.33" */
  percentage: string;
}

export class CanvasPKClient {
  private pk: ProvenanceKit;

  constructor({ apiKey, apiUrl }: { apiKey: string; apiUrl: string }) {
    this.pk = createPK(apiKey, apiUrl);
  }

  /** Create or update an entity; returns its ID. */
  async upsertEntity(opts: {
    name: string;
    type: string;
    wallet?: string;
  }): Promise<{ id: string }> {
    // Map canvas "type" to EAA "role"
    const role =
      opts.type === "organization" ? "organization" : "human";

    const id = await this.pk.entity({ role, name: opts.name, wallet: opts.wallet });
    return { id };
  }

  /**
   * Upload content and record a "create" action with license + payment extensions.
   * Combines the old uploadContent() + recordNewPost() two-step into one SDK call.
   */
  async recordNewPost(opts: {
    authorEntityId: string;
    contentBlob: Blob;
    licenseType: string;
    commercial: boolean;
    aiTraining: "permitted" | "reserved" | "unspecified";
    paymentWallet?: string;
  }): Promise<{ action: { id: string }; resource: { cid: string } }> {
    const result = await this.pk.file(opts.contentBlob, {
      entity: { id: opts.authorEntityId, role: "human" },
      action: {
        type: "create",
        extensions: {
          "ext:license@1.0.0": {
            type: opts.licenseType,
            commercial: opts.commercial,
            aiTraining: opts.aiTraining,
          },
          ...(opts.paymentWallet && {
            "ext:payment@1.0.0": {
              method: "splits",
              recipient: opts.paymentWallet,
            },
          }),
        },
      },
    });

    return {
      action: { id: result.actionId ?? "" },
      resource: { cid: result.cid },
    };
  }

  /**
   * Upload remix content and record a "transform" action with the original as input.
   * Combines the old uploadContent() + recordRemix() two-step into one SDK call.
   */
  async recordRemix(opts: {
    remixerEntityId: string;
    originalCid: string;
    remixBlob: Blob;
    remixNote?: string;
  }): Promise<{ action: { id: string }; resource: { cid: string } }> {
    const result = await this.pk.file(opts.remixBlob, {
      entity: { id: opts.remixerEntityId, role: "human" },
      action: {
        type: "transform",
        inputCids: [opts.originalCid],
        extensions: {
          "ext:attribution@1.0.0": {
            note: opts.remixNote ?? "Remix",
          },
        },
      },
    });

    return {
      action: { id: result.actionId ?? "" },
      resource: { cid: result.cid },
    };
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
}

export function createCanvasPKClient(
  user: Pick<CanvasUser, "provenancekitApiKey" | "provenancekitApiUrl">
): CanvasPKClient | null {
  if (!user.provenancekitApiKey || !user.provenancekitApiUrl) return null;
  return new CanvasPKClient({
    apiKey: user.provenancekitApiKey,
    apiUrl: user.provenancekitApiUrl,
  });
}
