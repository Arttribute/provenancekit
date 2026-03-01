/**
 * POST /api/users
 * Upsert a user after Privy login (called from app layout on first auth).
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { CanvasUser } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { privyDid, email, wallet } = body;

  if (!privyDid) {
    return NextResponse.json({ error: "privyDid is required" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  const result = await db.collection<CanvasUser>("users").findOneAndUpdate(
    { privyDid },
    {
      $setOnInsert: {
        privyDid,
        email,
        wallet,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      $set: { updatedAt: now },
    },
    { returnDocument: "after", upsert: true }
  );

  return NextResponse.json(result);
}
