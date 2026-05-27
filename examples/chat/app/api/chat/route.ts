/**
 * Chat API route — streaming AI chat with OpenAI tool calling.
 *
 * Tools available to the AI:
 *   • generate_image  — GPT Image generation
 *   • text_to_speech  — OpenAI TTS (tts-1)
 *   • web_search      — simulated (returns instruction for AI to answer from knowledge)
 *
 * Multi-modal input: user messages can include image_url parts (GPT-4o vision).
 *
 * Provenance flow (non-blocking, in onFinish):
 *   1. Save user + assistant messages to DB immediately (provenanceStatus: "recording")
 *   2. Record provenance async in the background — text first, then image if present
 *   3. Update messages in DB with CIDs + provenanceStatus: "recorded" | "failed"
 *   4. Client refetches twice: once quickly for the messages, once later for CIDs
 */

import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { connectDB, ConversationModel, MessageModel, UserModel } from "@/lib/db";
import { getOpenAIClient } from "@/lib/openai-client";
import { bufferToArrayBuffer, putGeneratedImage } from "@/lib/generated-image-cache";
import { recordChatProvenance, recordImageProvenance, type SupportedProvider } from "@/lib/provenance";
import { getPKClientAsync } from "@/lib/pk-client";
import { cacheBundle } from "@/lib/bundle-cache";
import type { IMessage } from "@/lib/db";
import type { AttachmentGovernance } from "@/types";

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

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
const FALLBACK_IMAGE_MODEL = process.env.OPENAI_IMAGE_FALLBACK_MODEL ?? "gpt-image-1";

function isGptImageModel(model: string) {
  return model.startsWith("gpt-image");
}

function normalizeImageSize(model: string, size: string) {
  if (!isGptImageModel(model)) return size;
  return size;
}

function normalizeImageQuality(model: string, quality: string) {
  if (!isGptImageModel(model)) return quality;
  return quality;
}

function normalizeLegacyImageSize(size: string) {
  if (size === "1536x1024") return "1792x1024";
  if (size === "1024x1536") return "1024x1792";
  if (size === "auto") return "1024x1024";
  return size;
}

function normalizeLegacyImageQuality(quality: string) {
  if (quality === "high") return "hd";
  return "standard";
}

function buildImageRequest({
  model,
  prompt,
  size,
  quality,
}: {
  model: string;
  prompt: string;
  size: string;
  quality: string;
}) {
  if (!isGptImageModel(model)) {
    return {
      model,
      prompt,
      size: normalizeLegacyImageSize(size),
      quality: normalizeLegacyImageQuality(quality),
      style: "vivid",
      response_format: "url",
      n: 1,
    };
  }

  const imageRequest: Record<string, unknown> = {
    model,
    prompt,
    size: normalizeImageSize(model, size),
    quality: normalizeImageQuality(model, quality),
    output_format: "png",
    moderation: "auto",
    n: 1,
  };

  return imageRequest;
}

async function bufferFromImageResult(imageUrl: string, b64Json?: string): Promise<{ buffer: Buffer; contentType: string } | undefined> {
  if (b64Json) {
    const buffer = Buffer.from(b64Json, "base64");
    return { buffer, contentType: "image/png" };
  }

  if (!imageUrl) return undefined;
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) {
    throw new Error(`Image download failed with HTTP ${imgResp.status}`);
  }
  const contentType = imgResp.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await imgResp.arrayBuffer());
  return { buffer, contentType };
}

// ─── Background provenance recorder ──────────────────────────────────────────

/**
 * Records provenance for a completed chat exchange, then updates MongoDB.
 * Runs after messages are already saved — never blocks the client response.
 */
async function recordAndUpdateProvenance(opts: {
  assistantMsgId: string;
  conversationId: string;
  userId: string;
  /** Pre-registered PK entity ID for the user — sourced from user.pkEntityId in MongoDB. */
  humanEntityId: string | undefined;
  provider: SupportedProvider;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  text: string;
  tokens: number;
  sessionId: string | null;
  imageToolResult: { name: string; result: unknown; blob?: Blob } | undefined;
  conversationFirstCid: string | undefined;
  conversationTotalMessages: number;
  attachments?: Array<{ cid?: string; url?: string; mimeType: string; name: string; governance?: AttachmentGovernance }>;
}) {
  const {
    assistantMsgId,
    conversationId,
    userId,
    humanEntityId,
    provider,
    model,
    messages,
    text,
    tokens,
    sessionId,
    imageToolResult,
    conversationFirstCid,
    conversationTotalMessages,
    attachments,
  } = opts;

  const t0 = Date.now();
  const hasImage = !!imageToolResult;
  console.log(`[pk:chat] recordAndUpdateProvenance START msgId=${assistantMsgId} hasImage=${hasImage} provider=${provider} model=${model}`);

  // 1. Record text-response provenance
  const t1 = Date.now();
  const pkResult = await recordChatProvenance({
    userPrivyDid: userId,
    humanEntityId,
    provider,
    model,
    prompt: messages,
    response: text,
    tokens,
    sessionId,
    attachments,
  });

  if (!pkResult) {
    // PK not configured — mark as failed so the UI can show the right state
    await MessageModel.updateOne(
      { _id: assistantMsgId },
      { $set: { provenanceStatus: "failed" } }
    );
    console.log(`[pk:chat] pk_not_configured — marked failed ms=${Date.now()-t0}`);
    return;
  }

  console.log(`[pk:chat] text_provenance_done cid=${pkResult.cid.slice(0,16)}… ms=${Date.now()-t1}`);

  // Helper: warm the server-side pk-proxy cache and update MongoDB with the bundle.
  // Called as fire-and-forget AFTER the DB is already marked "recorded" — so a failed
  // or slow bundle fetch never blocks the badge from appearing.
  const pkClient = await getPKClientAsync();
  function warmBundleAsync(cid: string, dbField: string) {
    if (!pkClient) return;
    const tb = Date.now();
    pkClient.bundle(cid)
      .then((bundle) => {
        const bundleData = bundle as unknown as Record<string, unknown>;
        cacheBundle(cid, bundleData); // warm pk-proxy cache so browser fetch is instant
        console.log(`[pk:chat] bundle_warm HIT cid=${cid.slice(0,16)}… ms=${Date.now()-tb}`);
        // Secondary DB write — badge is already showing, this enriches the popover data
        return MessageModel.updateOne(
          { _id: assistantMsgId },
          { $set: { [dbField]: bundleData } }
        );
      })
      .then(() => {
        console.log(`[pk:chat] bundle_db_write done field=${dbField}`);
      })
      .catch((err) => {
        console.warn(`[pk:chat] bundle_warm FAILED cid=${cid.slice(0,16)}… ms=${Date.now()-tb}`, err instanceof Error ? err.message : err);
      });
  }

  // 2. If there is a generated image, record its provenance separately.
  if (imageToolResult) {
    const imageResult = imageToolResult.result as { imageUrl: string; prompt: string; model?: string };
    const ipfsGateway = (process.env.PK_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs").replace(/\/$/, "");

    const t2 = Date.now();
    console.log(`[pk:chat] image_provenance_start`);
    const imagePkResult = await recordImageProvenance({
      userPrivyDid: userId,
      provider,
      model: imageResult.model ?? IMAGE_MODEL,
      prompt: imageResult.prompt,
      imageUrl: imageResult.imageUrl,
      imageBlob: imageToolResult.blob,
      inputCids: [pkResult.promptCid ?? pkResult.cid],
      sessionId,
      agentEntityId: pkResult.agentEntityId,
    });
    console.log(`[pk:chat] image_provenance_done ms=${Date.now()-t2} image_cid=${imagePkResult?.cid?.slice(0,16) ?? "null"}…`);

    // Immediately write "recorded" with CIDs — badge appears on next poll (~500ms).
    // Bundle warm-up runs in the background and writes bundle data once ready.
    const tdb = Date.now();
    await MessageModel.updateOne(
      { _id: assistantMsgId },
      {
        $set: {
          provenance: {
            cid: pkResult.cid,
            actionId: pkResult.actionId,
            promptCid: pkResult.promptCid,
            sessionId: sessionId ?? undefined,
          },
          provenanceStatus: "recorded",
          ...(imagePkResult
            ? {
                imageUrl: `${ipfsGateway}/${imagePkResult.cid}`,
                imageProvenance: {
                  cid: imagePkResult.cid,
                  actionId: imagePkResult.actionId,
                  status: "recorded",
                },
              }
            : { "imageProvenance.status": "failed" }),
        },
      }
    );
    console.log(`[pk:chat] db_update done ms=${Date.now()-tdb} — badge visible on next poll`);

    // Fire-and-forget bundle warm-up. Warms pk-proxy cache so the badge popover
    // loads instantly when the user hovers/clicks it. Also writes bundle to DB so
    // future page loads render the badge with zero fetches.
    warmBundleAsync(pkResult.cid, "provenance.bundle");
    if (imagePkResult) warmBundleAsync(imagePkResult.cid, "imageProvenance.bundle");

    console.log(`[pk:chat] recordAndUpdateProvenance DONE (image) total_ms=${Date.now()-t0}`);
  } else {
    // Text-only: immediately write "recorded" + CID, warm bundle in background.
    const tdb = Date.now();
    await MessageModel.updateOne(
      { _id: assistantMsgId },
      {
        $set: {
          provenance: {
            cid: pkResult.cid,
            actionId: pkResult.actionId,
            promptCid: pkResult.promptCid,
            sessionId: sessionId ?? undefined,
          },
          provenanceStatus: "recorded",
        },
      }
    );
    console.log(`[pk:chat] db_update done ms=${Date.now()-tdb} — badge visible on next poll`);

    // Fire-and-forget bundle warm-up.
    warmBundleAsync(pkResult.cid, "provenance.bundle");

    console.log(`[pk:chat] recordAndUpdateProvenance DONE (text-only) total_ms=${Date.now()-t0}`);
  }

  // 3. Update conversation provenance fields
  const primaryCid = pkResult.cid;
  const convUpdate: Record<string, unknown> = {
    provenanceCid: primaryCid,
    "provenance.lastCid": primaryCid,
    "provenance.totalMessages": conversationTotalMessages + 1,
  };

  await ConversationModel.updateOne({ _id: conversationId }, { $set: convUpdate });

  // Set firstCid once (only if it doesn't exist yet)
  if (!conversationFirstCid) {
    await ConversationModel.updateOne(
      { _id: conversationId, "provenance.firstCid": { $exists: false } },
      { $set: { "provenance.firstCid": primaryCid } }
    );
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
    attachments,
  } = body;
  // attachments?: Array<{cid?: string, url?: string, mimeType: string, name: string}>

  // Load conversation from DB to get canonical model + sessionId
  const conversation = conversationId
    ? await ConversationModel.findById(conversationId).lean()
    : null;

  const provider = (conversation?.provider ?? bodyProvider) as SupportedProvider;
  const model = (conversation as any)?.model ?? bodyModel;
  const sessionId = conversation?.provenance?.sessionId ?? null;

  // Load the user's pre-registered PK entity ID (stored at login via /api/users/sync).
  // One lightweight indexed read per request; falls back to undefined gracefully.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRecord = userId ? await UserModel.findOne({ privyDid: userId }, { pkEntityId: 1 }).lean() as any : null;
  const humanEntityId: string | undefined = userRecord?.pkEntityId;

  const systemPrompt =
    conversation?.systemPrompt ??
    "You are a helpful AI assistant with access to image generation and text-to-speech tools. Be concise, accurate, and thoughtful. When users ask you to generate an image or create audio, use the appropriate tool.";

  const aiModel = getAIProvider(provider, model);

  // Track tool results during streaming for provenance recording.
  // `blob` holds the pre-downloaded image binary so we can upload it to IPFS
  // for real vector embeddings. Downloaded immediately inside the tool execute
  // while any generated-image URL or base64 payload is fresh.
  const toolResults: Array<{ name: string; result: unknown; blob?: Blob }> = [];

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
          "Generate an image using OpenAI GPT Image. Use this when the user asks to create, draw, generate, or visualize an image.",
        parameters: z.object({
          prompt: z.string().describe("Detailed description of the image to generate"),
          size: z
            .enum(["auto", "1024x1024", "1536x1024", "1024x1536"])
            .optional()
            .default("auto")
            .describe("Image dimensions. Use auto unless the user asks for square, landscape, or portrait."),
          quality: z
            .enum(["auto", "low", "medium", "high"])
            .optional()
            .default("auto")
            .describe("Rendering quality. Use low for drafts, medium/high for final assets, or auto by default."),
        }),
        execute: async ({ prompt, size, quality }) => {
          try {
            if (!process.env.OPENAI_API_KEY) {
              throw new Error("OPENAI_API_KEY is not configured.");
            }

            const openai = getOpenAIClient();
            const requestedSize = size ?? "auto";
            const requestedQuality = quality ?? "auto";
            let imageModel = IMAGE_MODEL;
            let response;

            try {
              response = await openai.images.generate(
                buildImageRequest({
                  model: imageModel,
                  prompt,
                  size: requestedSize,
                  quality: requestedQuality,
                }) as never
              );
            } catch (primaryErr) {
              if (imageModel === FALLBACK_IMAGE_MODEL) throw primaryErr;
              console.warn(
                `[chat] image generation failed with ${imageModel}; retrying with ${FALLBACK_IMAGE_MODEL}:`,
                primaryErr instanceof Error ? primaryErr.message : primaryErr
              );
              imageModel = FALLBACK_IMAGE_MODEL;
              response = await openai.images.generate(
                buildImageRequest({
                  model: imageModel,
                  prompt,
                  size: requestedSize,
                  quality: requestedQuality,
                }) as never
              );
            }

            const firstImage = response.data?.[0] as { url?: string; b64_json?: string; revised_prompt?: string } | undefined;
            const b64Json = firstImage?.b64_json;
            const revisedPrompt = firstImage?.revised_prompt ?? prompt;

            if (!firstImage?.url && !b64Json) {
              throw new Error("Image API returned no image data.");
            }

            // GPT Image models return base64 by default and do not support URL output.
            // Store bytes in a short-lived server cache so MongoDB only stores a small URL;
            // provenance later replaces this with a durable IPFS gateway URL.
            let imageBlob: Blob | undefined;
            let imageUrl = firstImage.url ?? "";
            try {
              const imageBytes = await bufferFromImageResult(firstImage.url ?? "", b64Json);
              if (!imageBytes) throw new Error("Image API returned no downloadable image data.");
              const cached = await putGeneratedImage(imageBytes.buffer, imageBytes.contentType);
              imageUrl = cached.url;
              imageBlob = new Blob([bufferToArrayBuffer(imageBytes.buffer)], { type: imageBytes.contentType });
            } catch (err) {
              console.warn("[chat] generated image byte capture failed:", err);
              if (!imageUrl) throw err;
              // Non-fatal for legacy URL responses: provenance recording will fall back to metadata JSON.
            }

            toolResults.push({ name: "generate_image", result: { imageUrl, revisedPrompt, prompt, model: imageModel }, blob: imageBlob });
            return { imageUrl, revisedPrompt, prompt, model: imageModel };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[chat] image generation failed:", err);
            return { error: message, imageUrl: "", revisedPrompt: prompt, prompt };
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

        // Build user message contentParts in our MongoDB format from attachments metadata.
        // We use the `attachments` body field (not the AI SDK content array) because it carries
        // mimeType + name info that the raw content array lacks.
        const userContentParts: Array<{ type: string; url?: string; mimeType?: string; name?: string }> = [];
        if (Array.isArray(attachments) && attachments.length > 0) {
          for (const att of attachments as Array<{ cid?: string; url?: string; mimeType: string; name: string; governance?: AttachmentGovernance }>) {
            if (att.mimeType?.startsWith("image/") && att.url) {
              userContentParts.push({ type: "image_url", url: att.url, mimeType: att.mimeType, name: att.name });
            } else {
              userContentParts.push({ type: "file", name: att.name, mimeType: att.mimeType });
            }
          }
        }

        // Build user message (may have multi-modal contentParts)
        const userMsg: Partial<IMessage> = {
          _id: msgIds.user,
          conversationId,
          role: "user",
          content: userContent,
          contentParts: userContentParts.length > 0 ? userContentParts : undefined,
          createdAt: now,
        };

        const imageToolResult = toolResults.find((r) => r.name === "generate_image");
        const ttsResult = toolResults.find((r) => r.name === "text_to_speech");

        // Build assistant message — saved immediately with provenanceStatus: "recording"
        // so the client can see the message right after streaming ends.
        // Provenance CIDs will be filled in asynchronously.
        const assistantMsg: Partial<IMessage> = {
          _id: msgIds.assistant,
          conversationId,
          role: "assistant",
          content: text,
          provider,
          model,
          provenanceStatus: "recording",
          ...(imageToolResult
            ? {
                imageUrl: (imageToolResult.result as { imageUrl: string }).imageUrl,
                imageRevisedPrompt: (imageToolResult.result as { revisedPrompt: string }).revisedPrompt,
                // Pre-populate imageProvenance with "recording" status so the UI shows a spinner
                imageProvenance: {
                  cid: "",
                  status: "recording" as const,
                },
              }
            : {}),
          ...(ttsResult
            ? {
                audioUrl: (ttsResult.result as { audioUrl: string }).audioUrl,
                audioText: (ttsResult.result as { text: string }).text,
              }
            : {}),
          toolCalls: finishedToolCalls?.map((tc) => ({
            id: tc.toolCallId,
            name: tc.toolName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input: (tc as any).args as Record<string, unknown>,
            result: toolResults.find((r) => r.name === tc.toolName)?.result,
          })),
          usage: usage
            ? {
                promptTokens: Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0,
                completionTokens: Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0,
                totalTokens: Number.isFinite(usage.totalTokens) ? usage.totalTokens : 0,
              }
            : undefined,
          finishReason,
          createdAt: now,
        };

        // ── STEP 1: Save messages to DB immediately ──────────────────────────
        // Client can refetch as soon as streaming ends and see the messages.
        await MessageModel.insertMany([userMsg, assistantMsg]);

        await ConversationModel.updateOne(
          { _id: conversationId },
          { $set: { updatedAt: now }, $inc: { messageCount: 2 } }
        );

        // ── STEP 2: Record provenance in the background ─────────────────────
        // Fire-and-forget: DB already has the messages, so the client sees them.
        // This will update the messages with CIDs + provenanceStatus once done.
        recordAndUpdateProvenance({
          assistantMsgId: msgIds.assistant,
          conversationId,
          userId: userId ?? "anonymous",
          humanEntityId,
          provider,
          model,
          messages,
          text,
          tokens: (Number.isFinite(usage?.promptTokens) ? usage!.promptTokens : 0) +
                  (Number.isFinite(usage?.completionTokens) ? usage!.completionTokens : 0),
          sessionId,
          imageToolResult,
          conversationFirstCid: conversation?.provenance?.firstCid,
          conversationTotalMessages: conversation?.provenance?.totalMessages ?? 0,
          attachments: Array.isArray(attachments) ? attachments : undefined,
        }).catch((err) => {
          console.error("[chat] provenance background error:", err);
          // Best-effort: mark the message as failed so the UI can surface it
          MessageModel.updateOne(
            { _id: msgIds.assistant },
            { $set: { provenanceStatus: "failed" } }
          ).catch(() => {});
        });
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
