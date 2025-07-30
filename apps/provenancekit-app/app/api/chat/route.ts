// app/api/chat/route.ts
import { z } from "zod";
import { NextResponse } from "next/server";
import { openaiProv, pk } from "@/lib/provenance";
import { ensureHumanEntity } from "@/lib/provenance";
import { getPrivyUser } from "@/lib/privy-server";

export const revalidate = 0; // disable ISR for this route

const BodySchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  messages: z.array(z.any()),
  model: z.string().default("gpt-4.1-mini"),
  inputCids: z.array(z.string()).default([]), // NEW
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model, sessionId, inputCids } = BodySchema.parse(body);

    const { user } = await getPrivyUser(
      req.headers.get("authorization") ?? undefined
    );
    //console.log("Privy user:", user);
    const humanEntityId = await ensureHumanEntity({
      privyId: user.id,
      wallet: user.wallet?.address ?? null,
      name:
        user.email?.address ??
        user.google?.email ??
        user.discord?.username ??
        undefined,
    });
    console.log("Human entity ID:", humanEntityId);

    const sid =
      sessionId ??
      (await openaiProv.pk.createSession("Chat", { privyUser: user.id }));

    const { completion, actions, finalOutputCids } =
      await openaiProv.chatWithProvenance(
        { model, messages },
        async () => {
          throw new Error("No tools in this demo");
        },
        {
          action: { inputCids }, // pass file inputs
          entity: { id: humanEntityId, role: "human" },
        },

        { sessionId: sid }
      );

    return NextResponse.json({
      completion,
      actions,
      finalOutputCids,
      sessionId: sid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
