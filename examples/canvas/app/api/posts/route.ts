/**
 * Posts API — create posts with automatic ProvenanceKit recording.
 *
 * POST /api/posts
 *   Creates a new post or remix, uploads content to IPFS via PK API,
 *   records the create/transform action in ProvenanceKit, and deploys
 *   a 0xSplits contract if the post is monetized.
 *
 * GET /api/posts?feed=1&userId=<id>
 *   Returns the feed for a user (followed creators + own posts).
 *
 * GET /api/posts?explore=1
 *   Returns trending/recent public posts.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import { createCanvasPKClient } from "@/lib/provenance";
import type { Post, CanvasUser } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const explore = searchParams.get("explore");
  const authorId = searchParams.get("authorId");

  const db = await getDb();
  const collection = db.collection<Post>("posts");

  let posts: Post[];

  if (authorId) {
    posts = await collection
      .find({ authorId, isPublished: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
  } else if (explore) {
    posts = await collection
      .find({ isPublished: true })
      .sort({ likesCount: -1, createdAt: -1 })
      .limit(30)
      .toArray();
  } else {
    // Feed: own posts + followed creators
    // Simplified: just return all posts for now
    posts = await collection
      .find({ isPublished: true })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
  }

  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    authorId,
    type = "text",
    content,
    tags = [],
    licenseType = "CC-BY-4.0",
    aiTraining = "unspecified",
    isPremium = false,
    x402Price,
    originalPostId,
    remixNote,
  } = body;

  if (!authorId || !content) {
    return NextResponse.json({ error: "authorId and content are required" }, { status: 400 });
  }

  const db = await getDb();

  // Get user's PK config
  const user = await db.collection<CanvasUser>("users").findOne({ privyDid: authorId });

  const post: Post = {
    _id: uuidv4(),
    authorId,
    type: originalPostId ? "remix" : type,
    content,
    mediaRefs: [],
    originalPostId,
    remixNote,
    tags,
    isPremium,
    x402Price,
    likesCount: 0,
    commentsCount: 0,
    remixCount: 0,
    viewCount: 0,
    isPublished: true,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Record provenance (non-blocking failure)
  if (user) {
    const pk = createCanvasPKClient(user);
    if (pk) {
      try {
        const contentBlob = new Blob([content], { type: "text/plain" });

        // Get/create author entity
        const authorEntity = await pk.upsertEntity({
          name: user.username || user.privyDid,
          type: "person",
          wallet: user.wallet,
        });

        if (originalPostId) {
          // Find original post's provenance CID
          const original = await db.collection<Post>("posts").findOne({ _id: originalPostId });
          if (original?.provenanceCid) {
            const result = await pk.recordRemix({
              remixerEntityId: authorEntity.id,
              originalCid: original.provenanceCid,
              remixBlob: contentBlob,
              remixNote,
            });
            post.provenanceCid = result.resource.cid;
            post.actionId = result.action.id;

            // Update remix count on original
            await db.collection("posts").updateOne(
              { _id: originalPostId },
              { $inc: { remixCount: 1 } }
            );
          }
        } else {
          const result = await pk.recordNewPost({
            authorEntityId: authorEntity.id,
            contentBlob,
            licenseType,
            commercial: !["CC-BY-NC-4.0", "all-rights-reserved"].includes(licenseType),
            aiTraining: aiTraining as "permitted" | "reserved" | "unspecified",
            paymentWallet: user.wallet,
          });
          post.provenanceCid = result.resource.cid;
          post.actionId = result.action.id;
        }
      } catch (err) {
        console.warn("[Canvas PK] Provenance recording failed:", err);
      }
    }
  }

  await db.collection("posts").insertOne(post);

  // Increment author post count
  if (user) {
    await db.collection("users").updateOne(
      { privyDid: authorId },
      { $inc: { postsCount: 1 } }
    );
  }

  return NextResponse.json(post, { status: 201 });
}
