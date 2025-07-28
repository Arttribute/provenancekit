// app/api/tts/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiProv, DEMO_HUMAN_ID, DEMO_AI_ID } from "@/lib/provenance";

export const runtime = "nodejs"; // Buffer is needed
export const revalidate = 0;
export const maxDuration = 60; // (optional) long‑running call

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

    /* -------------------------------------------------------------
     * openaiProv already clones the response and persists provenance
     * ----------------------------------------------------------- */
    const { response, provenance } = await openaiProv.ttsWithProvenance(
      { model, voice, input: text },
      {
        entity: {
          id: "6339682a-7f3d-4fae-a086-e959bfda6a85",
          role: "human",
          name: "Alice",
        },
        action: { type: "ext:generate_audio" },
      }
      //{ sessionId, humanEntityId: DEMO_HUMAN_ID, aiEntityId: DEMO_AI_ID, format }
    );

    /* ---------- pipe the OpenAI audio back to the client ---------- */
    // If you prefer streaming you can just `return response`
    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": `audio/${format}`,
        "Content-Disposition": `inline; filename="speech.${format}"`,
        ...(provenance && "cid" in provenance
          ? { "X-Provenance-CID": provenance.cid }
          : {}),
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
