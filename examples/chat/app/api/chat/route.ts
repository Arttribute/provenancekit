/**
 * Chat API route — streaming AI chat with OpenAI tool calling.
 *
 * Tools available to the AI:
 *   • generate_image  — DALL-E 3 image generation
 *   • text_to_speech  — OpenAI TTS (tts-1)
 *   • web_search      — simulated (returns instruction for AI to answer from knowledge)
 *
 * Multi-modal input: user messages can include image_url parts (GPT-4o vision).
 *
 * Provenance flow (non-blocking, in onFinish):
 *   1. Record user prompt → PK resource
 *   2. Record assistant response → PK resource with ext:ai@1.0.0 + inputCids
 *   3. For DALL-E calls: record generated image as separate PK resource
 *   4. Save all messages to MongoDB with provenance CIDs
 */

import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { connectDB, ConversationModel, MessageModel } from "@/lib/db";
import { getOpenAIClient } from "@/lib/openai-client";
import { recordChatProvenance, recordImageProvenance, type SupportedProvider } from "@/lib/provenance";
import type { IMessage } from "@/lib/db";

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

// ─── Route ────────────────────────────────────────────────────────────────────

export const maxDuration = 120;

export async function POST(req: Request) {
  await connectDB();
  const body = await req.json();
  const {
    messages,
    conversationId,
    userId,
    provider: bodyProvider = "openai",
    model: bodyModel = "gpt-4o",
  } = body;

  // Load conversation from DB to get canonical model + sessionId
  const conversation = conversationId
    ? await ConversationModel.findById(conversationId).lean()
    : null;

  const provider = (conversation?.provider ?? bodyProvider) as SupportedProvider;
  const model = (conversation as any)?.model ?? bodyModel;
  const sessionId = conversation?.provenance?.sessionId ?? null;
  const systemPrompt =
    conversation?.systemPrompt ??
    "You are a helpful AI assistant with access to image generation and text-to-speech tools. Be concise, accurate, and thoughtful. When users ask you to generate an image or create audio, use the appropriate tool.";

  const aiModel = getAIProvider(provider, model);

  // Track tool results during streaming for provenance recording
  const toolResults: Array<{ name: string; result: unknown }> = [];

  // Capture user message text
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const userContent =
    typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content
            .filter((p: { type: string }) => p.type === "text")
            .map((p: { text?: string }) => p.text ?? "")
            .join(" ")
        : "";

  const result = streamText({
    model: aiModel,
    messages,
    system: systemPrompt,
    maxSteps: 5, // allow multi-step tool use
    tools: {
      generate_image: tool({
        description:
          "Generate a high-quality image using DALL-E 3. Use this when the user asks to create, draw, generate, or visualize an image.",
        parameters: z.object({
          prompt: z.string().describe("Detailed description of the image to generate"),
          size: z
            .enum(["1024x1024", "1792x1024", "1024x1792"])
            .optional()
            .default("1024x1024")
            .describe("Image dimensions"),
          quality: z
            .enum(["standard", "hd"])
            .optional()
            .default("standard")
            .describe("Image quality"),
          style: z
            .enum(["vivid", "natural"])
            .optional()
            .default("vivid")
            .describe("vivid=dramatic/hyper-real, natural=more subdued"),
        }),
        execute: async ({ prompt, size, quality, style }) => {
          try {
            const openai = getOpenAIClient();
            const response = await openai.images.generate({
              model: "dall-e-3",
              prompt,
              size: size ?? "1024x1024",
              quality: quality ?? "standard",
              style: style ?? "vivid",
              n: 1,
            });
            const imageUrl = response.data?.[0]?.url ?? "";
            const revisedPrompt = response.data?.[0]?.revised_prompt ?? prompt;
            toolResults.push({ name: "generate_image", result: { imageUrl, revisedPrompt, prompt } });
            return { imageUrl, revisedPrompt, prompt };
          } catch (err) {
            return { error: String(err), imageUrl: "", revisedPrompt: prompt, prompt };
          }
        },
      }),

      text_to_speech: tool({
        description:
          "Convert text to spoken audio using OpenAI TTS. Use this when the user asks to speak, read aloud, or create audio from text.",
        parameters: z.object({
          text: z.string().describe("The text to convert to speech"),
          voice: z
            .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
            .optional()
            .default("nova")
            .describe("Voice to use"),
          speed: z
            .number()
            .min(0.25)
            .max(4.0)
            .optional()
            .default(1.0)
            .describe("Playback speed"),
        }),
        execute: async ({ text, voice, speed }) => {
          try {
            const openai = getOpenAIClient();
            const response = await openai.audio.speech.create({
              model: "tts-1",
              input: text,
              voice: (voice ?? "nova") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
              speed: speed ?? 1.0,
            });
            const buffer = Buffer.from(await response.arrayBuffer());
            const audioUrl = `data:audio/mpeg;base64,${buffer.toString("base64")}`;
            toolResults.push({ name: "text_to_speech", result: { audioUrl, text, voice } });
            return { audioUrl, text, voice: voice ?? "nova" };
          } catch (err) {
            return { error: String(err), audioUrl: "", text, voice: voice ?? "nova" };
          }
        },
      }),
    },

    onFinish: async ({ text, usage, finishReason, toolCalls: finishedToolCalls }) => {
      try {
        const now = new Date();
        const msgIds = { user: uuidv4(), assistant: uuidv4() };

        // Build user message (may have multi-modal contentParts)
        const userMsg: Partial<IMessage> = {
          _id: msgIds.user,
          conversationId,
          role: "user",
          content: userContent,
          // Store any image attachments from contentParts
          contentParts:
            Array.isArray(lastUserMsg?.content)
              ? lastUserMsg.content
              : undefined,
          createdAt: now,
        };

        // Record provenance for the text response
        const pkResult = await recordChatProvenance({
          userPrivyDid: userId ?? "anonymous",
          provider,
          model,
          prompt: messages,
          response: text,
          tokens: usage?.totalTokens ?? 0,
          sessionId,
        });

        // Record provenance for any generated images
        const imageToolResult = toolResults.find((r) => r.name === "generate_image");
        let imagePkResult = null;
        if (imageToolResult && pkResult) {
          imagePkResult = await recordImageProvenance({
            userPrivyDid: userId ?? "anonymous",
            provider,
            model: "dall-e-3",
            prompt: (imageToolResult.result as { prompt: string }).prompt,
            imageUrl: (imageToolResult.result as { imageUrl: string }).imageUrl,
            inputCids: [pkResult.promptCid ?? pkResult.cid],
            sessionId,
          });
        }

        // Build assistant message
        const ttsResult = toolResults.find((r) => r.name === "text_to_speech");
        const assistantMsg: Partial<IMessage> = {
          _id: msgIds.assistant,
          conversationId,
          role: "assistant",
          content: text,
          provider,
          model,
          // Embed generated media directly on the assistant message
          ...(imageToolResult ? {
            imageUrl: (imageToolResult.result as { imageUrl: string }).imageUrl,
            imageRevisedPrompt: (imageToolResult.result as { revisedPrompt: string }).revisedPrompt,
          } : {}),
          ...(ttsResult ? {
            audioUrl: (ttsResult.result as { audioUrl: string }).audioUrl,
            audioText: (ttsResult.result as { text: string }).text,
          } : {}),
          toolCalls: finishedToolCalls?.map((tc) => ({
            id: tc.toolCallId,
            name: tc.toolName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input: (tc as any).args as Record<string, unknown>,
            result: toolResults.find((r) => r.name === tc.toolName)?.result,
          })),
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
                  cid: imagePkResult?.cid ?? pkResult.cid,
                  actionId: imagePkResult?.actionId ?? pkResult.actionId,
                  promptCid: pkResult.promptCid,
                  sessionId: sessionId ?? undefined,
                },
              }
            : {}),
        };

        await MessageModel.insertMany([userMsg, assistantMsg]);

        // Update conversation
        const updateFields: Record<string, unknown> = { updatedAt: now };
        if (pkResult) {
          const primaryCid = imagePkResult?.cid ?? pkResult.cid;
          updateFields.provenanceCid = primaryCid;
          updateFields["provenance.lastCid"] = primaryCid;
          updateFields["provenance.totalMessages"] =
            (conversation?.provenance?.totalMessages ?? 0) + 1;
        }

        await ConversationModel.updateOne(
          { _id: conversationId },
          { $set: updateFields, $inc: { messageCount: 2 } }
        );

        // Set firstCid once
        if (pkResult && !conversation?.provenance?.firstCid) {
          await ConversationModel.updateOne(
            { _id: conversationId, "provenance.firstCid": { $exists: false } },
            { $set: { "provenance.firstCid": imagePkResult?.cid ?? pkResult.cid } }
          );
        }
      } catch (err) {
        console.error("[chat] onFinish error:", err);
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
