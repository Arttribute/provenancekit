import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Post } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asId = (id: string): any => id;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: asId(id) });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Increment view count (fire-and-forget)
  db.collection("posts").updateOne({ _id: asId(id) }, { $inc: { viewCount: 1 } });

  return NextResponse.json(post);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const requesterId = searchParams.get("userId");

  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: asId(id) });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.authorId !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.collection("posts").deleteOne({ _id: asId(id) });
  await db.collection("users").updateOne(
    { privyDid: requesterId },
    { $inc: { postsCount: -1 } }
  );

  return NextResponse.json({ success: true });
}
