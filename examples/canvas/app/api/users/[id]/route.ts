import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { CanvasUser } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  const user = await db.collection<CanvasUser>("users").findOne({ privyDid: id });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Mask API key
  const { provenancekitApiKey: _, ...safe } = user as CanvasUser & { provenancekitApiKey?: string };
  return NextResponse.json({ ...safe, provenancekitApiKey: !!user.provenancekitApiKey });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { username, bio, pkApiKey, pkApiUrl } = body;

  const db = await getDb();
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (username !== undefined) update.username = username;
  if (bio !== undefined) update.bio = bio;
  if (pkApiKey !== undefined) update.provenancekitApiKey = pkApiKey;
  if (pkApiUrl !== undefined) update.provenancekitApiUrl = pkApiUrl;

  const result = await db
    .collection<CanvasUser>("users")
    .findOneAndUpdate(
      { privyDid: id },
      { $set: update },
      { returnDocument: "after", upsert: true }
    );

  return NextResponse.json(result);
}
