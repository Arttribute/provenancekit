import { NextRequest, NextResponse } from "next/server";
import { connectDB, ConversationModel, MessageModel } from "@/lib/db";
import type { AIProvider } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  await connectDB();
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get("userId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any = await ConversationModel.findById(id).lean();
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (userId && conversation.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(conversation);
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  await connectDB();
  const { id } = await params;
  const body = await req.json() as { userId?: string; model?: string; provider?: string; title?: string; systemPrompt?: string };
  const { userId, model, provider, title, systemPrompt } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const existing = await ConversationModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use set() to avoid conflict with Mongoose's built-in .model property
  const updates: Record<string, unknown> = {};
  if (model) updates["model"] = model;
  if (provider) updates["provider"] = provider as AIProvider;
  if (title) updates["title"] = title;
  if (systemPrompt !== undefined) updates["systemPrompt"] = systemPrompt;

  existing.set(updates);
  await existing.save();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json(existing.toObject() as any);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  await connectDB();
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { userId?: string };
  const userId = body.userId ?? req.nextUrl.searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const existing = await ConversationModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await Promise.all([
    ConversationModel.deleteOne({ _id: id }),
    MessageModel.deleteMany({ conversationId: id }),
  ]);

  return NextResponse.json({ success: true });
}
