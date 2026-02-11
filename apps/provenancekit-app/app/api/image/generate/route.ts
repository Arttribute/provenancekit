// app/api/image/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { pk } from "@/lib/provenance";
import { ensureHumanEntity } from "@/lib/provenance";
import { getPrivyUser } from "@/lib/privy-server";

export const revalidate = 0;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const BodySchema = z.object({
  prompt: z.string(),
  model: z.string().default("dall-e-3"),
  size: z
    .enum([
      "1024x1024",
      "auto",
      "1536x1024",
      "1024x1536",
      "256x256",
      "512x512",
      "1792x1024",
      "1024x1792",
    ])
    .default("1024x1024"),
  n: z.number().default(1),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const { prompt, model, size, n, sessionId } = BodySchema.parse(
      await req.json()
    );
    const { user } = await getPrivyUser(
      req.headers.get("authorization") ?? undefined
    );
    const humanEntityId = await ensureHumanEntity({
      privyId: user.id,
      wallet: user.wallet?.address ?? null,
      name:
        user.email?.address ??
        user.google?.email ??
        user.discord?.username ??
        undefined,
    });

    // Call OpenAI directly
    const response = await openai.images.generate({
      model,
      prompt,
      n,
      size: size as any,
      response_format: "b64_json",
    });

    // Record provenance for each generated image
    const results = [];
    for (const img of response.data ?? []) {
      if (img.b64_json) {
        const buffer = Buffer.from(img.b64_json, "base64");
        const blob = new Blob([buffer], { type: "image/png" });
        const result = await pk.file(blob, {
          entity: { id: humanEntityId, role: "human" },
          action: { type: "create" },
          resourceType: "image",
          sessionId,
        });
        results.push({ ...result, url: img.url, revisedPrompt: img.revised_prompt });
      }
    }

    return NextResponse.json({ images: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
