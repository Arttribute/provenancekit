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

/** True for transient network errors worth retrying (cold start, connection reset). */
function isRetryable(err: unknown): boolean {
  // Collect all text representations: message, cause message, and error codes
  // (ECONNRESET lives in err.cause.code, not in .toString(), so we must check codes explicitly)
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.message);
    const cause = err.cause;
    if (cause instanceof Error) {
      parts.push(cause.message);
      const code = (cause as NodeJS.ErrnoException).code;
      if (code) parts.push(code);
    } else if (typeof cause === "string") {
      parts.push(cause);
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code) parts.push(code);
  } else {
    parts.push(String(err));
  }
  const msg = parts.join(" ");
  return (
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("500") || // PK API cold start (e.g. model loading)
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

/** Retry `fn` up to `maxAttempts` times on transient errors with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      // 1s, 2s, 4s — exponential backoff gives Cloud Run time to warm up
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

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
  /**
   * Entity ID of the AI agent that performed this action.
   * Pass this to recordImageProvenance so DALL-E image actions are attributed
   * to the same conversation model rather than creating a duplicate entity.
   */
  agentEntityId?: string;
  /** Present when on-chain recording succeeded */
  onchain?: {
    txHash: string;
    actionId: string;
    chainId?: number;
    chainName?: string;
    contractAddress: string;
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Entity ID Cache                                              |
 |                                                              |
 | Deduplicates entity creation across messages in a session.   |
 | Key: "role:name" — stable for the lifetime of the process.  |
 | On server restart, new IDs are created (semantically fine). |
\*─────────────────────────────────────────────────────────────*/

const entityIdCache = new Map<string, string>();

async function getOrCreateEntity(
  pk: Awaited<ReturnType<typeof getPKClientAsync>>,
  opts: Parameters<NonNullable<typeof pk>["entity"]>[0]
): Promise<string> {
  const cacheKey = `${opts.role}:${opts.name ?? ""}`;
  const cached = entityIdCache.get(cacheKey);
  if (cached) return cached;
  const id = await pk!.entity(opts);
  entityIdCache.set(cacheKey, id);
  return id;
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
  /** Attachments sent with the user message — their CIDs become inputCids on the response action */
  attachments?: Array<{ cid?: string; url?: string; mimeType: string; name: string }>;
}): Promise<ProvenanceResult | null> {
  const pk = await getPKClientAsync();
  if (!pk) return null;

  try {
    return await withRetry(async () => {
      // getOrCreateEntity caches by "role:name" — same user and same model
      // always reuse the same entity ID across all messages in a session.
      const humanEntityId = await getOrCreateEntity(pk, { role: "human", name: opts.userPrivyDid });
      const agentEntityId = await getOrCreateEntity(pk, {
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

      // Include attachment CIDs as additional inputs to the response action
      const attachmentCids = (opts.attachments ?? []).filter((a) => a.cid).map((a) => a.cid!);

      const responseBlob = new Blob([opts.response], { type: "text/plain" });
      const responseResult = await pk.file(responseBlob, {
        entity: { id: agentEntityId, role: "ai", name: `${opts.provider}/${opts.model}` },
        action: {
          type: "generate",
          inputCids: [promptResult.cid, ...attachmentCids],
          aiTool: {
            provider: opts.provider,
            model: opts.model,
            promptHash: hashPrompt(opts.prompt),
            tokensUsed: opts.tokens,
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
        agentEntityId,
        onchain: responseResult.onchain,
      };
    });
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
  /**
   * Entity ID of the conversation AI model (e.g. gpt-4o) that called DALL-E as a tool.
   * When provided, the image action is attributed to this entity with dall-e-3 recorded
   * only as aiTool metadata — no separate DALL-E entity is created.
   * This keeps the entity count at 2 (human + AI model) regardless of image tool usage.
   */
  agentEntityId?: string;
}): Promise<ProvenanceResult | null> {
  const pk = await getPKClientAsync();
  if (!pk) return null;

  const promptHash = "sha256:" + createHash("sha256").update(opts.prompt).digest("hex");

  // Determine the upload blob outside the retry so we only compute it once.
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

  try {
    return await withRetry(async () => {
      // DALL-E is a tool called by the conversation AI model, not a separate entity.
      // Reuse the conversation model's entity ID if provided; fall back to creating one
      // (deduplicated by name via cache) only when called outside a chat exchange context.
      const performerEntityId =
        opts.agentEntityId ??
        (await getOrCreateEntity(pk, {
          role: "ai",
          name: `${opts.provider}/${opts.model}`,
          aiAgent: { model: { provider: opts.provider, model: opts.model }, autonomyLevel: "assistive" },
        }));

      // Use the conversation model's display name if we have its entity ID, otherwise dall-e-3
      const performerName = opts.agentEntityId
        ? `${opts.provider}/${opts.model}` // still label it by the base model for readability
        : `${opts.provider}/${opts.model}`;

      const result = await pk.file(uploadBlob, {
        entity: { id: performerEntityId, role: "ai", name: performerName },
        action: {
          type: "generate",
          inputCids: opts.inputCids,
          // dall-e-3 is recorded as the tool used, not as the performer entity
          aiTool: {
            provider: opts.provider,
            model: opts.model,
            promptHash,
          },
        },
        resourceType: "image",
        ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
      });

      if (result.onchain) {
        console.log(`[PK] Image on-chain: txHash=${result.onchain.txHash} chain=${result.onchain.chainName}`);
      }

      return { cid: result.cid, actionId: result.actionId, onchain: result.onchain };
    });
  } catch (error) {
    console.warn("[PK] recordImageProvenance failed:", error);
    return null;
  }
}
