/**
 * Chat completion API route with multi-provider AI support.
 *
 * Supports:
 *   - OpenAI (gpt-4o, o3, etc.) via @ai-sdk/openai
 *   - Anthropic (claude-opus-4-6, claude-sonnet-4-6, etc.) via @ai-sdk/anthropic
 *   - Google (gemini-2.0-flash, gemini-2.5-pro, etc.) via @ai-sdk/google
 *
 * Every response is recorded to ProvenanceKit with:
 *   - ext:ai@1.0.0: { provider, model, promptHash, tokens }
 *   - The user entity and AI agent entity are tracked separately
 *
 * The provenanceCid is returned as a stream annotation for the UI.
 */

import { streamText, appendResponseMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getDb } from "@/lib/mongodb";
import { recordChatProvenance, type SupportedProvider } from "@/lib/provenance";
import type { ProvenanceKitConfig } from "@/types";

// ─── Provider factory ─────────────────────────────────────────────────────────

function getProvider(provider: SupportedProvider, model: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })(model);

    case "anthropic":
      return createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })(model);

    case "google":
      return createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_AI_API_KEY,
      })(model);

    default:
      // Fallback to OpenAI-compatible custom endpoint
      return createOpenAI({
        apiKey: process.env.CUSTOM_AI_API_KEY ?? "",
        baseURL: process.env.CUSTOM_AI_BASE_URL ?? "",
      })(model);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    conversationId,
    userId,
    provider = "openai",
    model = "gpt-4o",
  } = await req.json();

  // Get user's ProvenanceKit config from DB
  let pkConfig: ProvenanceKitConfig | null = null;
  try {
    const db = await getDb();
    pkConfig = await db.collection<ProvenanceKitConfig>("provenancekit_config")
      .findOne({ userId }) ?? null;
  } catch {
    // DB failure shouldn't break chat
  }

  const aiModel = getProvider(provider as SupportedProvider, model);

  const result = streamText({
    model: aiModel,
    messages,
    system: "You are a helpful assistant. Be concise and accurate.",
    onFinish: async ({ text, usage }) => {
      // Record provenance after completion (non-blocking)
      const provenanceCid = await recordChatProvenance({
        pkConfig,
        userPrivyDid: userId ?? "anonymous",
        provider: provider as SupportedProvider,
        model,
        prompt: messages,
        response: text,
        tokens: usage?.totalTokens ?? 0,
      });

      // Save message to MongoDB
      if (conversationId) {
        try {
          const db = await getDb();
          await db.collection("messages").insertMany([
            {
              conversationId,
              role: "assistant",
              content: text,
              provider,
              model,
              provenanceCid,
              usage: usage
                ? {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                  }
                : null,
              createdAt: new Date(),
            },
          ]);

          // Update conversation updatedAt
          await db.collection("conversations").updateOne(
            { _id: conversationId },
            { $set: { updatedAt: new Date(), provenanceCid } }
          );
        } catch {
          // DB failure shouldn't affect response
        }
      }
    },
  });

  return result.toDataStreamResponse({
    sendUsage: true,
  });
}
