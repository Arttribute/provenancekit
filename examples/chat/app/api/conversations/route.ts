import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { connectDB, ConversationModel } from "@/lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectDB();
  const userId = req.nextUrl.searchParams.get("userId");
  const search = req.nextUrl.searchParams.get("search");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const filter: Record<string, unknown> = { userId };
  if (search?.trim()) filter.title = { $regex: search.trim(), $options: "i" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversations: any[] = await ConversationModel.find(filter).sort({ updatedAt: -1 }).limit(50).lean();
  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectDB();
  const body = await req.json() as { userId?: string; title?: string; provider?: string; model?: string; systemPrompt?: string };
  const { userId, title, provider = "openai", model = "gpt-4o", systemPrompt } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const id = uuidv4();
  const sessionId = uuidv4();

  const conversation = await ConversationModel.create({
    _id: id,
    title: title ?? "New conversation",
    userId,
    provider,
    model,
    systemPrompt,
    messageCount: 0,
    provenance: { sessionId, totalMessages: 0 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json(conversation.toObject() as any, { status: 201 });
}
