/**
 * ProvenanceKit helpers for recording canvas content provenance.
 *
 * Two main flows:
 *   1. New post: create → record in PK with creator entity + license + payment
 *   2. Remix: transform → record in PK with original CID as input
 *
 * Revenue distribution:
 *   The distribution calculator walks the provenance graph and returns
 *   basis-point shares for each contributor. These are used to deploy a
 *   0xSplits contract on-chain.
 */

import type { CanvasUser, Post } from "@/types";

interface PKClientOptions {
  apiKey: string;
  apiUrl: string;
}

interface EntityResult {
  id: string;
}

interface ActionResult {
  action: { id: string };
  resource: { cid: string };
}

interface DistributionEntry {
  entityId: string;
  wallet?: string;
  share: number; // basis points
}

export class CanvasPKClient {
  private apiKey: string;
  private apiUrl: string;

  constructor({ apiKey, apiUrl }: PKClientOptions) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `PK error: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async upsertEntity(opts: { name: string; type: string; wallet?: string }) {
    return this.fetch<EntityResult>("/v1/entities", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  /** Record a new post as a "create" action */
  async recordNewPost(opts: {
    authorEntityId: string;
    contentCid: string;
    licenseType: string;
    commercial: boolean;
    aiTraining: "permitted" | "reserved" | "unspecified";
    paymentWallet?: string;
  }): Promise<ActionResult> {
    return this.fetch<ActionResult>("/v1/actions", {
      method: "POST",
      body: JSON.stringify({
        type: "create",
        performedBy: opts.authorEntityId,
        inputs: [],
        outputs: [{ ref: opts.contentCid, scheme: "cid" }],
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
      }),
    });
  }

  /** Record a remix as a "transform" action with original as input */
  async recordRemix(opts: {
    remixerEntityId: string;
    originalCid: string;
    remixCid: string;
    remixNote?: string;
  }): Promise<ActionResult> {
    return this.fetch<ActionResult>("/v1/actions", {
      method: "POST",
      body: JSON.stringify({
        type: "transform",
        performedBy: opts.remixerEntityId,
        inputs: [{ ref: opts.originalCid, scheme: "cid" }],
        outputs: [{ ref: opts.remixCid, scheme: "cid" }],
        extensions: {
          "ext:attribution@1.0.0": {
            note: opts.remixNote ?? "Remix",
          },
        },
      }),
    });
  }

  /** Calculate revenue distribution for a CID (walks provenance graph) */
  async getDistribution(cid: string): Promise<DistributionEntry[]> {
    return this.fetch<DistributionEntry[]>(`/v1/resources/${cid}/distribution`);
  }

  async uploadContent(content: string | Blob, mimeType = "text/plain"): Promise<string> {
    const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
    const form = new FormData();
    form.append("file", blob);

    const res = await fetch(`${this.apiUrl}/v1/resources/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return data.cid as string;
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
