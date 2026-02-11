// app/api/image/edit/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { pk } from "@/lib/provenance";

export const runtime = "nodejs"; // ensure File is available

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const prompt = form.get("prompt")?.toString() ?? "";
    const image = form.get("image");
    const sessionId = form.get("sessionId")?.toString();

    if (!(image instanceof File))
      return NextResponse.json(
        { error: "`image` file required" },
        { status: 400 }
      );

    // Call OpenAI directly
    const response = await openai.images.edit({
      model: "dall-e-2",
      prompt,
      image,
      response_format: "b64_json",
    });

    // Record provenance for edited image
    const results = [];
    for (const img of response.data ?? []) {
      if (img.b64_json) {
        const buffer = Buffer.from(img.b64_json, "base64");
        const blob = new Blob([buffer], { type: "image/png" });
        const result = await pk.file(blob, {
          entity: { role: "ai" },
          action: { type: "transform" },
          resourceType: "image",
          sessionId,
        });
        results.push(result);
      }
    }

    return NextResponse.json({ images: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
