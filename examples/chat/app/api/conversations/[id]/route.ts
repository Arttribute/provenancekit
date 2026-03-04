import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Conversation, AIProvider } from "@/types";

type Params = { params: Promise<{ id: string }> };

// MongoDB driver defaults _id to ObjectId, but we use string UUIDs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const byId = (id: string) => ({ _id: id } as any);

/**
 * GET /api/conversations/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get("userId");

  const db = await getDb();
  const conversation = await db
    .collection<Conversation>("conversations")
    .findOne(byId(id));

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userId && conversation.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(conversation);
}

/**
 * PATCH /api/conversations/[id]
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { userId, model, provider, title, systemPrompt } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();
  const existing = await db.collection<Conversation>("conversations").findOne(byId(id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: Partial<Conversation> = { updatedAt: new Date() };
  if (model) updates.model = model;
  if (provider) updates.provider = provider as AIProvider;
  if (title) updates.title = title;
  if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;

  const result = await db
    .collection<Conversation>("conversations")
    .findOneAndUpdate(byId(id), { $set: updates }, { returnDocument: "after" });

  return NextResponse.json(result);
}

/**
 * DELETE /api/conversations/[id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = body.userId ?? req.nextUrl.searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();
  const existing = await db.collection<Conversation>("conversations").findOne(byId(id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await Promise.all([
    db.collection("conversations").deleteOne(byId(id)),
    db.collection("messages").deleteMany({ conversationId: id }),
  ]);

  return NextResponse.json({ success: true });
}
