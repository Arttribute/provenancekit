// app/api/tts/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { pk } from "@/lib/provenance";

export const runtime = "nodejs"; // Buffer is needed
export const revalidate = 0;
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/* ---------- request schema ---------- */
const BodySchema = z.object({
  text: z.string().min(1, "text is required"),
  model: z.string().default("tts-1"),
  voice: z.string().default("alloy"),
  format: z.enum(["mp3", "wav", "aac"]).default("mp3"),
  sessionId: z.string().uuid().optional(),
});

/* ---------- POST handler ---------- */
export async function POST(req: Request) {
  try {
    const { text, model, voice, format, sessionId } = BodySchema.parse(
      await req.json()
    );

    // Call OpenAI directly
    const response = await openai.audio.speech.create({
      model,
      voice: voice as any,
      input: text,
      response_format: format,
    });

    // Record provenance for the audio output
    const buffer = Buffer.from(await response.arrayBuffer());
    const audioBlob = new Blob([buffer], { type: `audio/${format}` });
    const result = await pk.file(audioBlob, {
      entity: { role: "human", name: "Alice" },
      action: { type: "create" },
      resourceType: "audio",
      sessionId,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": `audio/${format}`,
        "Content-Disposition": `inline; filename="speech.${format}"`,
        "X-Provenance-CID": result.cid,
      },
    });
  } catch (err: any) {
    console.error("TTS route error:", err);
    return NextResponse.json(
      { error: err.message ?? "tts failed" },
      { status: 500 }
    );
  }
}
