/**
 * ProvenanceKit helpers for recording AI chat provenance.
 *
 * Uses @provenancekit/sdk — no raw API calls.
 *
 * Tracks:
 *   - recordChatProvenance: text prompt/response pairs with ext:ai@1.0.0
 *   - recordImageProvenance: DALL-E generated images with ext:ai@1.0.0
 *
 * On-chain provenance: if CHAIN_PRIVATE_KEY + BASE_SEPOLIA_RPC_URL are set,
 * every pk.file() call also records the action on the Base Sepolia
 * ProvenanceRegistry (fire-and-forget; off-chain record always stands).
 */

import { createHash } from "crypto";
import { getPKClientAsync } from "./pk-client";
import type { AIProvider, ModelInfo } from "@/types";

export type SupportedProvider = AIProvider;

export const KNOWN_MODELS: ModelInfo[] = [
  { provider: "openai", model: "gpt-4o", displayName: "GPT-4o", contextWindow: "128k", description: "Most capable, multimodal" },
  { provider: "openai", model: "gpt-4o-mini", displayName: "GPT-4o mini", contextWindow: "128k", description: "Fast and cost-efficient" },
  { provider: "openai", model: "o3-mini", displayName: "o3-mini", contextWindow: "200k", description: "Advanced reasoning model" },
  { provider: "anthropic", model: "claude-opus-4-6", displayName: "Claude Opus 4.6", contextWindow: "200k", description: "Anthropic's most capable" },
  { provider: "anthropic", model: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", contextWindow: "200k", description: "Balanced performance" },
  { provider: "google", model: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", contextWindow: "1M", description: "Fast multimodal" },
  { provider: "google", model: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", contextWindow: "1M", description: "Google's most capable" },
];

export function getModelInfo(provider: SupportedProvider, model: string): ModelInfo | undefined {
  return KNOWN_MODELS.find((m) => m.provider === provider && m.model === model);
}

export function hashPrompt(messages: Array<{ role: string; content: unknown }>): string {
  const canonical = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }))
  );
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}

export interface ProvenanceResult {
  cid: string;
  actionId?: string;
  promptCid?: string;
  /** Present when on-chain recording succeeded */
  onchain?: {
    txHash: string;
    actionId: string;
    chainId?: number;
    chainName?: string;
    contractAddress: string;
  };
}

/**
 * Record provenance for a text chat response.
 * Uses getPKClientAsync to ensure the on-chain adapter is initialised.
 */
export async function recordChatProvenance(opts: {
  userPrivyDid: string;
  provider: SupportedProvider;
  model: string;
  prompt: Array<{ role: string; content: unknown }>;
  response: string;
  tokens: number;
  sessionId: string | null;
}): Promise<ProvenanceResult | null> {
  const pk = await getPKClientAsync();
  if (!pk) return null;

  try {
    const humanEntityId = await pk.entity({ role: "human", name: opts.userPrivyDid });
    const agentEntityId = await pk.entity({
      role: "ai",
      name: `${opts.provider}/${opts.model}`,
      aiAgent: { model: { provider: opts.provider, model: opts.model }, autonomyLevel: "assistive" },
    });

    const promptText = JSON.stringify(opts.prompt.map((m) => ({ role: m.role, content: m.content })));
    const promptBlob = new Blob([promptText], { type: "application/json" });
    const promptResult = await pk.file(promptBlob, {
      entity: { id: humanEntityId, role: "human", name: opts.userPrivyDid },
      action: { type: "provide" },
      resourceType: "text",
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    });

    const responseBlob = new Blob([opts.response], { type: "text/plain" });
    const responseResult = await pk.file(responseBlob, {
      entity: { id: agentEntityId, role: "ai", name: `${opts.provider}/${opts.model}` },
      action: {
        type: "generate",
        inputCids: [promptResult.cid],
        extensions: {
          "ext:ai@1.0.0": {
            provider: opts.provider,
            model: opts.model,
            promptHash: hashPrompt(opts.prompt),
            tokensUsed: opts.tokens,
          },
        },
      },
      resourceType: "text",
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    });

    if (responseResult.onchain) {
      console.log(`[PK] On-chain recorded: txHash=${responseResult.onchain.txHash} chain=${responseResult.onchain.chainName}`);
    }

    return {
      cid: responseResult.cid,
      actionId: responseResult.actionId,
      promptCid: promptResult.cid,
      onchain: responseResult.onchain,
    };
  } catch (error) {
    console.warn("[PK] recordChatProvenance failed:", error);
    return null;
  }
}

/**
 * Record provenance for a DALL-E generated image.
 *
 * Two-path strategy:
 *   1. If `imageBlob` is provided (pre-downloaded in the tool execute callback while
 *      the DALL-E URL was fresh), upload the real image binary to IPFS. This enables
 *      vector embeddings for content-based similarity search.
 *   2. If `imageBlob` is absent (download failed), fall back to a small JSON metadata
 *      blob. The provenance record is still permanent and auditable — only embeddings
 *      are missing.
 *
 * The caller (generate_image tool execute) is responsible for downloading the image
 * immediately after DALL-E returns it, before the ephemeral URL can expire (~60 min).
 */
export async function recordImageProvenance(opts: {
  userPrivyDid: string;
  provider: SupportedProvider;
  model: string; // "dall-e-3"
  prompt: string;
  imageUrl: string;
  /** Pre-downloaded image binary — enables real IPFS storage and vector embeddings */
  imageBlob?: Blob;
  inputCids: string[]; // prompt CID(s) from the parent chat exchange
  sessionId: string | null;
}): Promise<ProvenanceResult | null> {
  const pk = await getPKClientAsync();
  if (!pk) return null;

  try {
    const agentEntityId = await pk.entity({
      role: "ai",
      name: `${opts.provider}/${opts.model}`,
      aiAgent: { model: { provider: opts.provider, model: opts.model }, autonomyLevel: "autonomous" },
    });

    const promptHash = "sha256:" + createHash("sha256").update(opts.prompt).digest("hex");

    // Use real image binary when available (enables IPFS content addressing + embeddings).
    // Fall back to metadata JSON if the binary wasn't captured in the tool execute.
    let uploadBlob: Blob;
    if (opts.imageBlob && opts.imageBlob.size > 0) {
      uploadBlob = opts.imageBlob;
    } else {
      console.warn("[PK] recordImageProvenance: no image blob, falling back to metadata JSON (no embeddings)");
      const metadata = JSON.stringify({
        type: "image_generation",
        provider: opts.provider,
        model: opts.model,
        promptHash,
        imageUrl: opts.imageUrl,
        timestamp: new Date().toISOString(),
      });
      uploadBlob = new Blob([metadata], { type: "application/json" });
    }

    const result = await pk.file(uploadBlob, {
      entity: { id: agentEntityId, role: "ai", name: `${opts.provider}/${opts.model}` },
      action: {
        type: "generate",
        inputCids: opts.inputCids,
        extensions: {
          "ext:ai@1.0.0": {
            provider: opts.provider,
            model: opts.model,
            promptHash,
          },
        },
      },
      resourceType: "image",
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    });

    if (result.onchain) {
      console.log(`[PK] Image on-chain: txHash=${result.onchain.txHash} chain=${result.onchain.chainName}`);
    }

    return { cid: result.cid, actionId: result.actionId, onchain: result.onchain };
  } catch (error) {
    console.warn("[PK] recordImageProvenance failed:", error);
    return null;
  }
}
