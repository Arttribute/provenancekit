/**
 * GET   /api/users/[id]    — Get a user's public profile (by privyDid)
 * PATCH /api/users/[id]    — Update username, bio, wallet, avatar
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { CanvasUser, PublicUser } from "@/types";

function toPublicUser(user: CanvasUser, isFollowing?: boolean): PublicUser {
  return {
    _id: user._id,
    privyDid: user.privyDid,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatar: user.avatar,
    banner: user.banner,
    wallet: user.wallet,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    postsCount: user.postsCount,
    provenanceEntityId: user.provenanceEntityId,
    createdAt: user.createdAt,
    isFollowing,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requesterId = req.nextUrl.searchParams.get("requesterId");

  const db = await getDb();

  // id can be privyDid or username
  const user = await db
    .collection<CanvasUser>("users")
    .findOne({
      $or: [{ privyDid: id }, { username: id }],
    });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let isFollowing: boolean | undefined;
  if (requesterId && requesterId !== user.privyDid) {
    const follow = await db
      .collection("follows")
      .findOne({ followerId: requesterId, followingId: user.privyDid });
    isFollowing = !!follow;
  }

  return NextResponse.json(toPublicUser(user, isFollowing));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { username, bio, wallet, avatar, displayName } = body;

  const db = await getDb();
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (username !== undefined) update.username = username;
  if (displayName !== undefined) update.displayName = displayName;
  if (bio !== undefined) update.bio = bio;
  if (wallet !== undefined) update.wallet = wallet;
  if (avatar !== undefined) update.avatar = avatar;

  // Check username uniqueness if changing
  if (username) {
    const existing = await db
      .collection<CanvasUser>("users")
      .findOne({ username, privyDid: { $ne: id } });
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }
  }

  const result = await db
    .collection<CanvasUser>("users")
    .findOneAndUpdate(
      { privyDid: id },
      { $set: update },
      { returnDocument: "after", upsert: true }
    );

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toPublicUser(result as CanvasUser));
}
