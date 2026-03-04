/**
 * ProvenanceKit helpers for recording AI chat provenance.
 *
 * Uses the official @provenancekit/sdk — no raw API fetch calls.
 * Design principle: app-level PK client from env. Provider-agnostic;
 * works with OpenAI, Anthropic, Google, or any custom model.
 *
 * Provenance flow per message pair:
 *   1. Upsert human entity  (the user, identified by Privy DID)
 *   2. Upsert AI agent entity (the model, identified by provider/model)
 *   3. Upload prompt → "provide" action (records user input as a resource)
 *   4. Upload response → "generate" action with:
 *        - prompt CID as input (explicit lineage)
 *        - ext:ai@1.0.0: provider, model, promptHash, tokensUsed
 *        - sessionId: links this message to the full conversation session
 *
 * ext:license@1.0.0 and ext:witness@1.0.0 are planned Phase 2 additions
 * (require post-hoc action amendment not yet exposed in SDK).
 */

import { createHash } from "crypto";
import { getPKClient } from "./pk-client";
import type { AIProvider, ModelInfo } from "@/types";

export type SupportedProvider = AIProvider;

/** Well-known model catalogue — used for display, model selection, and ext:ai metadata */
export const KNOWN_MODELS: ModelInfo[] = [
  // OpenAI — primary provider
  { provider: "openai", model: "gpt-4o", displayName: "GPT-4o", contextWindow: "128k", description: "Most capable GPT-4o model" },
  { provider: "openai", model: "gpt-4o-mini", displayName: "GPT-4o mini", contextWindow: "128k", description: "Fast and cost-efficient" },
  { provider: "openai", model: "o3-mini", displayName: "o3-mini", contextWindow: "200k", description: "Advanced reasoning model" },
  // Anthropic
  { provider: "anthropic", model: "claude-opus-4-6", displayName: "Claude Opus 4.6", contextWindow: "200k", description: "Anthropic's most capable model" },
  { provider: "anthropic", model: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", contextWindow: "200k", description: "Balanced performance" },
  // Google
  { provider: "google", model: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", contextWindow: "1M", description: "Fast multimodal model" },
  { provider: "google", model: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", contextWindow: "1M", description: "Google's most capable model" },
];

export function getModelInfo(provider: SupportedProvider, model: string): ModelInfo | undefined {
  return KNOWN_MODELS.find((m) => m.provider === provider && m.model === model);
}

/** SHA-256 hash of canonicalized message thread for privacy-preserving prompt fingerprinting */
export function hashPrompt(messages: Array<{ role: string; content: string }>): string {
  const canonical = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content }))
  );
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}

export interface ProvenanceResult {
  cid: string;
  actionId?: string;
  promptCid?: string;
}

/**
 * Record provenance for a single AI chat response using the PK SDK.
 *
 * @returns ProvenanceResult with CIDs, or null if PK is not configured or fails
 */
export async function recordChatProvenance(opts: {
  userPrivyDid: string;
  provider: SupportedProvider;
  model: string;
  prompt: Array<{ role: string; content: string }>;
  response: string;
  tokens: number;
  sessionId: string | null; // PK session ID for the conversation (null = no session grouping)
}): Promise<ProvenanceResult | null> {
  const pk = getPKClient();
  if (!pk) return null; // PK not configured — chat works fine without provenance

  try {
    // 1. Upsert human entity (identified by Privy DID)
    const humanEntityId = await pk.entity({
      role: "human",
      name: opts.userPrivyDid,
    });

    // 2. Upsert AI agent entity (identified by provider/model string)
    const agentEntityId = await pk.entity({
      role: "ai",
      name: `${opts.provider}/${opts.model}`,
      aiAgent: {
        model: { provider: opts.provider, model: opts.model },
        autonomyLevel: "assistive",
      },
    });

    // 3. Upload prompt content — records a "provide" action (user gave the prompt)
    const promptText = JSON.stringify(
      opts.prompt.map((m) => ({ role: m.role, content: m.content }))
    );
    const promptBlob = new Blob([promptText], { type: "application/json" });
    const promptResult = await pk.file(promptBlob, {
      entity: { id: humanEntityId, role: "human", name: opts.userPrivyDid },
      action: { type: "provide" },
      resourceType: "text",
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    });

    // 4. Upload response content — records a "generate" action
    //    Input: prompt CID (explicit provenance lineage)
    //    Extension: ext:ai@1.0.0 carries provider/model attribution metadata
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

    return {
      cid: responseResult.cid,
      actionId: responseResult.actionId,
      promptCid: promptResult.cid,
    };
  } catch (error) {
    // Provenance failures must not break chat — log and continue gracefully
    console.warn("[PK] Failed to record provenance:", error);
    return null;
  }
}
