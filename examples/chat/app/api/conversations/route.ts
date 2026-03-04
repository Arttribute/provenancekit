import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import type { Conversation } from "@/types";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const search = req.nextUrl.searchParams.get("search");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();

  const filter: Record<string, unknown> = { userId };
  if (search?.trim()) {
    filter.title = { $regex: search.trim(), $options: "i" };
  }

  const conversations = await db
    .collection<Conversation>("conversations")
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, title, provider = "openai", model = "gpt-4o", systemPrompt } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Generate a UUID as the ProvenanceKit session ID for this conversation.
  // Every pk.file() call for messages in this conversation passes this sessionId,
  // enabling pk.sessionProvenance(sessionId) to return the full conversation timeline.
  const sessionId = uuidv4();

  const db = await getDb();
  const conversation: Conversation = {
    _id: uuidv4(),
    title: title ?? "New conversation",
    userId,
    provider,
    model,
    systemPrompt,
    messageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    provenance: {
      sessionId,
      totalMessages: 0,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.collection("conversations").insertOne(conversation as any);
  return NextResponse.json(conversation, { status: 201 });
}
