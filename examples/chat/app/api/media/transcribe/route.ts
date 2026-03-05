/**
 * POST /api/media/transcribe
 *
 * Accepts a multipart form with an `audio` file field.
 * Uses OpenAI Whisper to transcribe speech to text.
 * The transcribed text is returned so the chat input can be pre-filled.
 */

import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { toFile } from "openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const audio = form.get("audio");

  if (!audio || !(audio instanceof File)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }

  try {
    const openai = getOpenAIClient();

    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audio, audio.name, { type: audio.type }),
      model: "whisper-1",
      response_format: "text",
    });

    return NextResponse.json({ text: transcription });
  } catch (err) {
    console.error("[transcribe] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
