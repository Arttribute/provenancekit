import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { connectDB, UserSettingsModel } from "@/lib/db";
import type { AIProvider } from "@/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectDB();
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings: any = await UserSettingsModel.findOne({ userId }).lean();
  if (!settings) return NextResponse.json({ settings: { defaultProvider: "openai", defaultModel: "gpt-4o", userId } });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  await connectDB();
  const body = await req.json() as { userId?: string; defaultProvider?: string; defaultModel?: string; systemPrompt?: string };
  const { userId, defaultProvider, defaultModel, systemPrompt } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!defaultProvider || !defaultModel) return NextResponse.json({ error: "defaultProvider and defaultModel required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings: any = await UserSettingsModel.findOneAndUpdate(
    { userId },
    { $set: { defaultProvider: defaultProvider as AIProvider, defaultModel, systemPrompt: systemPrompt ?? null }, $setOnInsert: { _id: uuidv4(), userId } },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ settings });
}
