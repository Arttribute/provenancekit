/**
 * ProvenanceKit helpers for recording AI chat provenance.
 *
 * Uses the official @provenancekit/sdk — no raw API fetch calls.
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
 * Record provenance for a single AI chat response using the PK SDK.
 *
 * Flow:
 *   1. Upsert human entity (the user)
 *   2. Upsert AI agent entity (the model)
 *   3. Upload the prompt via pk.file() — stores content, records a "provide" action
 *   4. Upload the response via pk.file() — stores content, records a "generate" action
 *      with the prompt CID as input and ext:ai@1.0.0 carrying provider/model metadata
 *
 * @returns The CID of the recorded response resource, or null if PK is not configured
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

    // 1. Upsert human entity
    const userId = await pk.entity({
      role: "human",
      name: opts.userPrivyDid,
    });

    // 2. Upsert AI agent entity, identified by provider:model
    const agentId = await pk.entity({
      role: "ai",
      name: `${opts.provider}/${opts.model}`,
      aiAgent: {
        model: { provider: opts.provider, model: opts.model },
      },
    });

    // 3. Upload prompt content and record a "provide" action
    const promptBlob = new Blob([JSON.stringify(opts.prompt)], {
      type: "application/json",
    });
    const promptResult = await pk.file(promptBlob, {
      entity: { id: userId, role: "human", name: opts.userPrivyDid },
      action: { type: "provide" },
      resourceType: "text",
    });

    // 4. Upload response content and record the "generate" action,
    //    linking the prompt as input and attaching AI metadata
    const responseBlob = new Blob([opts.response], { type: "text/plain" });
    const responseResult = await pk.file(responseBlob, {
      entity: { id: agentId, role: "ai", name: `${opts.provider}/${opts.model}` },
      action: {
        type: "generate",
        inputCids: [promptResult.cid],
        extensions: {
          "ext:ai@1.0.0": {
            provider: opts.provider,
            model: opts.model,
            promptHash: hashPrompt(opts.prompt),
            tokens: opts.tokens,
          },
        },
      },
      resourceType: "text",
    });

    return responseResult.cid;
  } catch (error) {
    // Provenance failures must not break the chat — log and continue
    console.warn("[PK] Failed to record provenance:", error);
    return null;
  }
}
