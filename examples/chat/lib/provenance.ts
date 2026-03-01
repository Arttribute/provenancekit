/**
 * ProvenanceKit helpers for recording AI chat provenance.
 *
 * Design principle: provider-agnostic. Works with OpenAI, Anthropic, Google,
 * or any custom model. The `provider` + `model` fields in ext:ai@1.0.0 carry
 * the attribution.
 */

import { createHash } from "crypto";
import { createPKClient } from "./pk-client";
import type { ProvenanceKitConfig } from "@/types";

export type SupportedProvider = "openai" | "anthropic" | "google" | "custom";

export interface ModelInfo {
  provider: SupportedProvider;
  model: string;
  /** Human-readable display name */
  displayName?: string;
}

/** Well-known model catalogue — used for display and ext:ai@1.0.0 metadata */
export const KNOWN_MODELS: ModelInfo[] = [
  // OpenAI
  { provider: "openai", model: "gpt-4o", displayName: "GPT-4o" },
  { provider: "openai", model: "gpt-4o-mini", displayName: "GPT-4o mini" },
  { provider: "openai", model: "o3", displayName: "o3" },
  // Anthropic
  { provider: "anthropic", model: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
  { provider: "anthropic", model: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
  // Google
  { provider: "google", model: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
  { provider: "google", model: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
];

export function hashPrompt(messages: Array<{ role: string; content: string }>): string {
  const canonical = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content }))
  );
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Record provenance for a single AI chat response.
 * Call this server-side after every AI generation.
 *
 * @returns The CID of the provenance record, or null if PK is not configured
 */
export async function recordChatProvenance(opts: {
  pkConfig: ProvenanceKitConfig | null;
  userPrivyDid: string;
  provider: SupportedProvider;
  model: string;
  prompt: Array<{ role: string; content: string }>;
  response: string;
  tokens: number;
}): Promise<string | null> {
  if (!opts.pkConfig?.enabled || !opts.pkConfig.apiKey) {
    return null;
  }

  try {
    const pk = createPKClient(opts.pkConfig);

    // Get/create user entity
    const userEntity = await pk.upsertEntity({
      name: opts.userPrivyDid,
      type: "person",
    });

    // Get/create AI agent entity — uniquely identified by provider:model
    const agentEntity = await pk.upsertEntity({
      name: `${opts.provider}/${opts.model}`,
      type: "software",
      isAIAgent: true,
      provider: opts.provider,
      model: opts.model,
    });

    // Upload the prompt and response to IPFS
    const [promptCid, responseCid] = await Promise.all([
      pk.uploadContent(JSON.stringify(opts.prompt), "application/json"),
      pk.uploadContent(opts.response, "text/plain"),
    ]);

    // Record the generation action
    const result = await pk.recordChatAction({
      performedBy: agentEntity.id,
      requestedBy: userEntity.id,
      inputCids: [promptCid],
      outputCid: responseCid,
      provider: opts.provider,
      model: opts.model,
      promptHash: hashPrompt(opts.prompt),
      tokens: opts.tokens,
    });

    return result.resource.cid;
  } catch (error) {
    // Provenance failures should not break the chat — log and continue
    console.warn("[PK] Failed to record provenance:", error);
    return null;
  }
}
