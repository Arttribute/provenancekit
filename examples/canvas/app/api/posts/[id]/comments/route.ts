/**
 * GET  /api/posts/[id]/comments  — List comments on a post
 * POST /api/posts/[id]/comments  — Add a comment
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import type { Comment, CanvasUser } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asId = (id: string): any => id;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  const comments = await db
    .collection<Comment>("comments")
    .find({ postId: id })
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray();

  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { authorId, content } = await req.json();

  if (!authorId || !content?.trim()) {
    return NextResponse.json(
      { error: "authorId and content are required" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Verify post exists
  const post = await db.collection("posts").findOne({ _id: asId(id) });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const author = await db
    .collection<CanvasUser>("users")
    .findOne({ privyDid: authorId });

  const comment: Comment = {
    _id: uuidv4(),
    postId: id,
    authorId,
    authorUsername: author?.username,
    authorDisplayName: author?.displayName,
    authorAvatar: author?.avatar,
    content: content.trim(),
    likesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.collection("comments").insertOne(comment as any);

  await db
    .collection("posts")
    .updateOne({ _id: asId(id) }, { $inc: { commentsCount: 1 } });

  return NextResponse.json(comment, { status: 201 });
}
