import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import type { Conversation } from "@/types";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();
  const conversations = await db
    .collection<Conversation>("conversations")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, title, provider = "openai", model = "gpt-4o" } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();
  const conversation: Conversation = {
    _id: uuidv4(),
    title: title ?? "New conversation",
    userId,
    provider,
    model,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("conversations").insertOne(conversation);
  return NextResponse.json(conversation, { status: 201 });
}
