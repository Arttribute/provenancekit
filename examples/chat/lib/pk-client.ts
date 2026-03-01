/**
 * Per-user ProvenanceKit client factory.
 * Each user configures their own ProvenanceKit API key and URL
 * (from the provenancekit-app dashboard) in settings.
 */

import type { ProvenanceKitConfig } from "@/types";

export interface PKClientOptions {
  apiKey: string;
  apiUrl: string;
}

export class PKClient {
  private apiKey: string;
  private apiUrl: string;

  constructor({ apiKey, apiUrl }: PKClientOptions) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `PK API error: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** Create or get an entity (user/AI agent) */
  async upsertEntity(entity: {
    name: string;
    type: string;
    isAIAgent?: boolean;
    provider?: string;
    model?: string;
  }) {
    return this.fetch<{ id: string }>("/v1/entities", {
      method: "POST",
      body: JSON.stringify(entity),
    });
  }

  /** Record a chat generation action with multi-provider support */
  async recordChatAction(opts: {
    performedBy: string;    // entity ID of the AI agent
    requestedBy: string;    // entity ID of the user
    inputCids: string[];    // CIDs of user message resources
    outputCid: string;      // CID of the AI response resource
    provider: string;       // "openai" | "anthropic" | "google" | ...
    model: string;          // "gpt-4o" | "claude-opus-4-6" | "gemini-2.0-flash" | ...
    promptHash: string;     // SHA-256 of the prompt for verifiability
    tokens: number;
  }) {
    return this.fetch<{ action: { id: string }; resource: { cid: string } }>(
      "/v1/actions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "create",
          performedBy: opts.performedBy,
          requestedBy: opts.requestedBy,
          inputs: opts.inputCids.map((ref) => ({ ref, scheme: "cid" })),
          outputs: [{ ref: opts.outputCid, scheme: "cid" }],
          extensions: {
            "ext:ai@1.0.0": {
              provider: opts.provider,
              model: opts.model,
              promptHash: opts.promptHash,
              tokens: opts.tokens,
            },
          },
        }),
      }
    );
  }

  /** Upload content to IPFS via the PK API */
  async uploadContent(content: string, mimeType = "text/plain") {
    const blob = new Blob([content], { type: mimeType });
    const form = new FormData();
    form.append("file", blob);

    const url = `${this.apiUrl}/v1/resources/upload`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return data.cid as string;
  }

  /** Get provenance bundle for a CID */
  async getBundle(cid: string) {
    return this.fetch<unknown>(`/v1/resources/${cid}/bundle`);
  }
}

/** Create a PK client from user config stored in the session/DB */
export function createPKClient(config: Pick<ProvenanceKitConfig, "apiKey" | "apiUrl">): PKClient {
  return new PKClient({ apiKey: config.apiKey, apiUrl: config.apiUrl });
}
