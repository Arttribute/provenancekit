// app/api/chat/route.ts
import { z } from "zod";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { pk } from "@/lib/provenance";
import { ensureHumanEntity } from "@/lib/provenance";
import { getPrivyUser } from "@/lib/privy-server";

export const revalidate = 0; // disable ISR for this route

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const BodySchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  messages: z.array(z.any()),
  model: z.string().default("gpt-4.1-mini"),
  inputCids: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model, sessionId, inputCids } = BodySchema.parse(body);

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
    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    // Record provenance for the output
    const outputText = completion.choices[0]?.message?.content ?? "";
    const outputBlob = new Blob([outputText], { type: "text/plain" });
    const result = await pk.file(outputBlob, {
      entity: { id: humanEntityId, role: "human" },
      action: { type: "create", inputCids },
      resourceType: "text",
      sessionId: sessionId ?? undefined,
    });

    return NextResponse.json({
      completion,
      cid: result.cid,
      sessionId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
