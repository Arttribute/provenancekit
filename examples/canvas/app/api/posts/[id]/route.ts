import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Post } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: id });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const post = await db.collection<Post>("posts").findOne({ _id: id });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.authorId !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.collection("posts").deleteOne({ _id: id });
  return NextResponse.json({ success: true });
}
