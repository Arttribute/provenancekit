/**
 * Posts API — create posts with automatic ProvenanceKit recording.
 *
 * ProvenanceKit integration:
 *   Uses a single platform-level API key (PROVENANCEKIT_API_KEY env var).
 *   All users are PK entities identified by their Privy DID.
 *   Provenance recording is non-blocking (fails silently if PK is down).
 *
 * POST /api/posts
 *   Creates a new post or remix, uploads content to PK/IPFS,
 *   records the create/transform action, and saves to MongoDB.
 *
 * GET /api/posts?feed=1&userId=<id>
 *   Feed for a user (posts from followed creators + own).
 *
 * GET /api/posts?explore=1
 *   Trending/recent public posts for the explore page.
 *
 * GET /api/posts?authorId=<id>
 *   All posts by a specific author.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/mongodb";
import { getPlatformClient } from "@/lib/provenance";
import type { Post, CanvasUser, Follow } from "@/types";

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
      .limit(30)
      .toArray();
  } else if (explore) {
    const sort = searchParams.get("sort") ?? "trending";
    const sortObj =
      sort === "recent"
        ? { createdAt: -1 }
        : { likesCount: -1, viewCount: -1, createdAt: -1 };

    posts = await collection
      .find({ isPublished: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort(sortObj as any)
      .limit(30)
      .toArray();
  } else if (userId) {
    // Feed: own posts + followed creators
    const follows = await db
      .collection<Follow>("follows")
      .find({ followerId: userId })
      .toArray();
    const followingIds = follows.map((f) => f.followingId);
    const feedAuthorIds = [userId, ...followingIds];

    posts = await collection
      .find({ authorId: { $in: feedAuthorIds }, isPublished: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
  } else {
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
    mediaRefs = [],
  } = body;

  if (!authorId || !content) {
    return NextResponse.json(
      { error: "authorId and content are required" },
      { status: 400 }
    );
  }

  const db = await getDb();

  const author = await db
    .collection<CanvasUser>("users")
    .findOne({ privyDid: authorId });

  const post: Post = {
    _id: uuidv4(),
    authorId,
    authorUsername: author?.username,
    authorDisplayName: author?.displayName,
    authorAvatar: author?.avatar,
    type: originalPostId ? "remix" : type,
    content,
    mediaRefs,
    originalPostId,
    remixNote,
    licenseType,
    aiTraining,
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

  // Record provenance via the platform PK client (non-blocking)
  const pk = getPlatformClient();
  if (pk) {
    try {
      const commercial = !["CC-BY-NC-4.0", "all-rights-reserved"].includes(licenseType);
      const displayName = author?.displayName || author?.username || authorId.slice(0, 8);
      const wallet = author?.wallet;

      const textForPK = mediaRefs.length > 0
        ? content + "\n[media: " + mediaRefs.map((m: { mimeType: string }) => m.mimeType).join(", ") + "]"
        : content;
      const contentBlob = new Blob([textForPK], { type: "text/plain" });

      if (originalPostId) {
        const original = await db
          .collection<Post>("posts")
          .findOne({ _id: originalPostId });

        if (original?.provenanceCid) {
          const result = await pk.recordRemix({
            remixerPrivyDid: authorId,
            remixerDisplayName: displayName,
            remixerWallet: wallet,
            originalCid: original.provenanceCid,
            remixBlob: contentBlob,
            remixNote,
            licenseType,
            aiTraining: aiTraining as "permitted" | "reserved" | "unspecified",
          });
          post.provenanceCid = result.cid;
          post.actionId = result.actionId;
          post.provenanceStatus = "verified";
          post.originalAuthorId = original.authorId;
        }

        await db
          .collection("posts")
          .updateOne({ _id: originalPostId }, { $inc: { remixCount: 1 } });
      } else {
        const result = await pk.recordNewPost({
          authorPrivyDid: authorId,
          authorDisplayName: displayName,
          authorWallet: wallet,
          contentBlob,
          licenseType,
          commercial,
          aiTraining: aiTraining as "permitted" | "reserved" | "unspecified",
          tags,
        });
        post.provenanceCid = result.cid;
        post.actionId = result.actionId;
        post.provenanceStatus = "verified";

        if (author && !author.provenanceEntityId) {
          await db
            .collection("users")
            .updateOne(
              { privyDid: authorId },
              { $set: { provenanceEntityId: authorId } }
            );
        }
      }
    } catch (err) {
      console.warn("[Canvas PK] Provenance recording failed (non-fatal):", err);
      post.provenanceStatus = "none";
    }
  } else {
    post.provenanceStatus = "none";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.collection("posts").insertOne(post as any);

  await db
    .collection("users")
    .updateOne(
      { privyDid: authorId },
      { $inc: { postsCount: 1 }, $set: { updatedAt: new Date() } }
    );

  return NextResponse.json(post, { status: 201 });
}
