// app/api/stt/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiProv, DEMO_AI_ID } from "@/lib/provenance";

export const runtime = "nodejs";

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

    const out = await openaiProv.sttWithProvenance(
      { file, model },
      { entity: { role: "ai" } },
      { sessionId, aiEntityId: DEMO_AI_ID }
    );

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
