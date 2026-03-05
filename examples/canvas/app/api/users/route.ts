/**
 * POST /api/users
 * Upsert a user after Privy login (called from app layout on first auth).
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { CanvasUser } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { privyDid, email, wallet, displayName, username } = body;

  if (!privyDid) {
    return NextResponse.json({ error: "privyDid is required" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  // Generate a fallback username if none provided
  const fallbackUsername = username ?? `user_${privyDid.slice(-8)}`;
  const fallbackDisplayName = displayName ?? fallbackUsername;

  // Check if username is taken (only on insert path)
  const existing = await db
    .collection<CanvasUser>("users")
    .findOne({ privyDid });

  if (existing) {
    // User exists — update wallet if changed
    const update: Record<string, unknown> = { updatedAt: now };
    if (wallet && !existing.wallet) update.wallet = wallet;
    await db.collection("users").updateOne({ privyDid }, { $set: update });
    return NextResponse.json(existing);
  }

  // New user — find a unique username
  let finalUsername = fallbackUsername;
  let suffix = 0;
  while (true) {
    const taken = await db
      .collection<CanvasUser>("users")
      .findOne({ username: finalUsername });
    if (!taken) break;
    suffix++;
    finalUsername = `${fallbackUsername}${suffix}`;
  }

  const newUser: CanvasUser = {
    _id: privyDid,
    privyDid,
    wallet,
    username: finalUsername,
    displayName: fallbackDisplayName,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.collection("users").insertOne(newUser as any);
  return NextResponse.json(newUser, { status: 201 });
}
