/**
 * Chat completion API route.
 *
 * Primary provider: OpenAI (gpt-4o, gpt-4o-mini, o3-mini)
 * Additional: Anthropic, Google (via env vars)
 *
 * Provenance recording flow (non-blocking, after stream completion):
 *   1. Fetch conversation from DB to get sessionId + model
 *   2. streamText() with the configured AI model
 *   3. onFinish: save user message + assistant message to MongoDB
 *   4. onFinish: record provenance via PK SDK (ext:ai@1.0.0 + sessionId)
 *   5. onFinish: update conversation (messageCount, provenanceCid)
 *
 * The provenanceCid is embedded in the saved message. The UI fetches messages
 * from /api/conversations/[id]/messages and reads provenance.cid directly.
 */

import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import { recordChatProvenance, type SupportedProvider } from "@/lib/provenance";
import type { Conversation, ChatMessage } from "@/types";

// ─── Provider factory ─────────────────────────────────────────────────────────

function getAIProvider(provider: SupportedProvider, model: string) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })(model);
    case "custom":
      return createOpenAI({
        apiKey: process.env.CUSTOM_AI_API_KEY ?? "",
        baseURL: process.env.CUSTOM_AI_BASE_URL ?? "",
      })(model);
    case "openai":
    default:
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const {
    messages,
    conversationId,
    userId,
    // provider/model are fallbacks for "new" conversations before DB record exists
    provider: bodyProvider = "openai",
    model: bodyModel = "gpt-4o",
  } = body;

  // Fetch conversation to get the canonical model and session ID
  let conversation: Conversation | null = null;
  let sessionId: string | null = null;
  try {
    const db = await getDb();
    if (conversationId) {
      conversation = await db
        .collection<Conversation>("conversations")
        .findOne({ _id: conversationId }) ?? null;
      sessionId = conversation?.provenance?.sessionId ?? null;
    }
  } catch {
    // DB read failure doesn't block streaming
  }

  const provider = (conversation?.provider ?? bodyProvider) as SupportedProvider;
  const model = conversation?.model ?? bodyModel;
  const systemPrompt =
    conversation?.systemPrompt ??
    "You are a helpful AI assistant. Be concise, accurate, and thoughtful.";

  const aiModel = getAIProvider(provider, model);

  // Capture the user message text (last message in the array with role "user")
  const userMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const userContent = typeof userMessage?.content === "string"
    ? userMessage.content
    : JSON.stringify(userMessage?.content ?? "");

  const result = streamText({
    model: aiModel,
    messages,
    system: systemPrompt,
    onFinish: async ({ text, usage, finishReason }) => {
      const db = await getDb();
      const now = new Date();

      // Save user message
      const userMsgId = uuidv4();
      const userMsg: ChatMessage = {
        _id: userMsgId,
        conversationId,
        role: "user",
        content: userContent,
        createdAt: now,
      };

      // Record provenance (non-blocking — failure is non-fatal)
      const pkResult = await recordChatProvenance({
        userPrivyDid: userId ?? "anonymous",
        provider,
        model,
        prompt: messages,
        response: text,
        tokens: usage?.totalTokens ?? 0,
        sessionId,
      });

      // Save assistant message with provenance metadata
      const assistantMsgId = uuidv4();
      const assistantMsg: ChatMessage = {
        _id: assistantMsgId,
        conversationId,
        role: "assistant",
        content: text,
        provider,
        model,
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
        finishReason,
        createdAt: now,
        ...(pkResult
          ? {
              provenance: {
                cid: pkResult.cid,
                actionId: pkResult.actionId,
                promptCid: pkResult.promptCid,
                sessionId: sessionId ?? undefined,
              },
            }
          : {}),
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.collection("messages").insertMany([userMsg as any, assistantMsg as any]);

        // Update conversation: messageCount, provenanceCid, updatedAt
        const updateFields: Record<string, unknown> = {
          updatedAt: now,
        };
        if (pkResult) {
          updateFields.provenanceCid = pkResult.cid;
          updateFields["provenance.lastCid"] = pkResult.cid;
          updateFields["provenance.totalMessages"] = (conversation?.provenance?.totalMessages ?? 0) + 1;
        }

        await db.collection("conversations").updateOne(
          { _id: conversationId },
          {
            $set: updateFields,
            $inc: { messageCount: 2 },
            ...(pkResult && !conversation?.provenance?.firstCid
              ? { $setOnInsert: {} } // firstCid set separately below
              : {}),
          }
        );

        // Set firstCid if this is the first provenance record
        if (pkResult && !conversation?.provenance?.firstCid) {
          await db.collection("conversations").updateOne(
            { _id: conversationId, "provenance.firstCid": { $exists: false } },
            { $set: { "provenance.firstCid": pkResult.cid } }
          );
        }
      } catch (err) {
        console.error("[chat] Failed to save messages:", err);
      }
    },
  });

  return result.toDataStreamResponse({
    sendUsage: true,
    getErrorMessage: (error: unknown) => {
      if (error instanceof Error) return error.message;
      return "An error occurred while generating the response.";
    },
  });
}
