// app/api/stt/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { pk } from "@/lib/provenance";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const BodySchema = z.object({
  base64Audio: z.string(),
  mime: z.string().default("audio/wav"),
  model: z.string().default("whisper-1"),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const { base64Audio, mime, model, sessionId } = BodySchema.parse(
      await req.json()
    );
    const bytes = Uint8Array.from(Buffer.from(base64Audio, "base64"));
    const file = new File([bytes], "audio.wav", { type: mime });

    // Call OpenAI directly
    const transcription = await openai.audio.transcriptions.create({
      file,
      model,
    });

    // Record provenance for the transcription output
    const textBlob = new Blob([transcription.text], { type: "text/plain" });
    const result = await pk.file(textBlob, {
      entity: { role: "ai" },
      action: { type: "transform" },
      resourceType: "text",
      sessionId,
    });

    return NextResponse.json({
      text: transcription.text,
      cid: result.cid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
