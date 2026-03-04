import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import type { UserSettings, AIProvider } from "@/types";

const DEFAULT_SETTINGS: Omit<UserSettings, "_id" | "userId" | "createdAt" | "updatedAt"> = {
  defaultProvider: "openai",
  defaultModel: "gpt-4o",
};

/**
 * GET /api/settings?userId=<privyDid>
 * Returns the user's saved model preferences.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = await getDb();
  const settings = await db.collection<UserSettings>("user_settings").findOne({ userId });

  if (!settings) {
    return NextResponse.json({
      settings: { ...DEFAULT_SETTINGS, userId },
    });
  }

  return NextResponse.json({ settings });
}

/**
 * PUT /api/settings
 * Updates the user's model preferences.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { userId, defaultProvider, defaultModel, systemPrompt } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!defaultProvider || !defaultModel) {
    return NextResponse.json({ error: "defaultProvider and defaultModel required" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  const result = await db.collection<UserSettings>("user_settings").findOneAndUpdate(
    { userId },
    {
      $set: {
        defaultProvider: defaultProvider as AIProvider,
        defaultModel,
        systemPrompt: systemPrompt ?? null,
        updatedAt: now,
      },
      $setOnInsert: { _id: uuidv4(), userId, createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );

  return NextResponse.json({ settings: result });
}
