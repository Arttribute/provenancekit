/**
 * POST   /api/users/[id]/follow  — Follow a user
 * DELETE /api/users/[id]/follow  — Unfollow a user
 *
 * Body: { followerId: string }  (Privy DID of the user performing the action)
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import type { Follow } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: followingId } = await params;
  const { followerId } = await req.json();

  if (!followerId) {
    return NextResponse.json({ error: "followerId is required" }, { status: 400 });
  }

  if (followerId === followingId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const db = await getDb();

  const existing = await db
    .collection<Follow>("follows")
    .findOne({ followerId, followingId });

  if (existing) {
    return NextResponse.json({ error: "Already following" }, { status: 409 });
  }

  const follow: Follow = {
    _id: uuidv4(),
    followerId,
    followingId,
    createdAt: new Date(),
  };

  await db.collection("follows").insertOne(follow as unknown as Document);

  // Update counts
  await Promise.all([
    db.collection("users").updateOne(
      { privyDid: followerId },
      { $inc: { followingCount: 1 } }
    ),
    db.collection("users").updateOne(
      { privyDid: followingId },
      { $inc: { followersCount: 1 } }
    ),
  ]);

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: followingId } = await params;
  const followerId = req.nextUrl.searchParams.get("followerId");

  if (!followerId) {
    return NextResponse.json({ error: "followerId is required" }, { status: 400 });
  }

  const db = await getDb();

  const result = await db
    .collection("follows")
    .deleteOne({ followerId, followingId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not following" }, { status: 404 });
  }

  await Promise.all([
    db.collection("users").updateOne(
      { privyDid: followerId },
      { $inc: { followingCount: -1 } }
    ),
    db.collection("users").updateOne(
      { privyDid: followingId },
      { $inc: { followersCount: -1 } }
    ),
  ]);

  return NextResponse.json({ success: true });
}
