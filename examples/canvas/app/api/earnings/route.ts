import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { CreatorEarning } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = await getDb();
  const earnings = await db
    .collection<CreatorEarning>("creator_earnings")
    .find({ userId })
    .sort({ distributedAt: -1 })
    .limit(50)
    .toArray();

  const total = earnings.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = earnings
    .filter((e) => new Date(e.distributedAt) >= monthStart)
    .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  const postIds = [...new Set(earnings.map((e) => e.postId))];

  return NextResponse.json({
    total: total.toFixed(0),
    thisMonth: thisMonth.toFixed(0),
    postCount: postIds.length,
    earnings,
  });
}
