import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Conversation, ChatMessage } from "@/types";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/conversations/[id]/messages
 * Returns all messages for a conversation, sorted chronologically.
 * Verifies the requesting user owns the conversation.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();

  // Verify ownership
  const conversation = await db
    .collection<Conversation>("conversations")
    .findOne({ _id: id });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conversation.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await db
    .collection<ChatMessage>("messages")
    .find({ conversationId: id })
    .sort({ createdAt: 1 })
    .toArray();

  return NextResponse.json({ messages });
}
