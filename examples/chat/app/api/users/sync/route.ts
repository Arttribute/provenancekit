import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import type { ChatUser } from "@/types";

/**
 * POST /api/users/sync
 * Upserts a MongoDB user record from Privy auth data.
 * Called once on app mount after Privy login.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { privyDid, email, name, avatar } = body;

  if (!privyDid) {
    return NextResponse.json({ error: "privyDid required" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  const result = await db.collection<ChatUser>("users").findOneAndUpdate(
    { privyDid },
    {
      $set: { email, name, avatar, updatedAt: now },
      $setOnInsert: { _id: uuidv4(), privyDid, createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );

  return NextResponse.json({ user: result });
}
