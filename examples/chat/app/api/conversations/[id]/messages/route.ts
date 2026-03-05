import { NextRequest, NextResponse } from "next/server";
import { connectDB, ConversationModel, MessageModel } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  await connectDB();
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any = await ConversationModel.findById(id).lean();
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conversation.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = await MessageModel.find({ conversationId: id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json({ messages });
}
