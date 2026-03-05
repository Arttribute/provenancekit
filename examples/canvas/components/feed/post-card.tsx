"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, Repeat2, Music, Video, FileText, Mic } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { LicenseChip, VerificationIndicator } from "@provenancekit/ui";
import { ProvenancePanel } from "@/components/provenance/provenance-panel";
import type { Post } from "@/types";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  audio:  <Mic className="h-3.5 w-3.5" />,
  video:  <Video className="h-3.5 w-3.5" />,
  blog:   <FileText className="h-3.5 w-3.5" />,
  image:  null,
  text:   null,
  remix:  <Repeat2 className="h-3.5 w-3.5" />,
};

interface PostCardProps {
  post: Post;
  compact?: boolean;
}

export function PostCard({ post, compact }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likesCount);

  const authorName = post.authorDisplayName || post.authorUsername || post.authorId.slice(0, 8);
  const authorHandle = post.authorUsername ? `@${post.authorUsername}` : post.authorId.slice(0, 8);
  const initials = authorName.slice(0, 2).toUpperCase();

  async function handleLike() {
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    await fetch(`/api/posts/${post._id}/like`, { method: "POST" });
  }

  // Map PK provenanceStatus to VerificationIndicator status
  const verificationStatus =
    post.provenanceCid
      ? post.provenanceStatus === "verified"
        ? "verified"
        : post.provenanceStatus === "partial"
        ? "partial"
        : "unverified"
      : undefined;

  return (
    <article className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          {post.authorAvatar ? (
            <div className="relative h-9 w-9 rounded-full overflow-hidden shrink-0">
              <Image
                src={post.authorAvatar.startsWith("http")
                  ? post.authorAvatar
                  : `https://${process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "ipfs.io"}/ipfs/${post.authorAvatar}`}
                alt={authorName}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold shrink-0">
              {initials}
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/profile/${post.authorId}`}
                className="text-sm font-semibold hover:underline underline-offset-2"
              >
                {authorName}
              </Link>
              {TYPE_ICONS[post.type] && (
                <span className="text-muted-foreground">
                  {TYPE_ICONS[post.type]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{authorHandle}</span>
              <span>·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {verificationStatus && (
            <VerificationIndicator status={verificationStatus} size="sm" showLabel={false} />
          )}
          {post.originalPostId && (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              Remix
            </span>
          )}
          {post.isPremium && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 font-medium">
              ${post.x402Price} USDC
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="text-sm leading-relaxed">
        {compact ? (
          <p className="line-clamp-3">{post.content}</p>
        ) : (
          <p>{post.content}</p>
        )}
      </div>

      {/* Media grid */}
      {post.mediaRefs.length > 0 && (
        <div
          className={cn(
            "grid gap-1 rounded-xl overflow-hidden",
            post.mediaRefs.length === 1 ? "grid-cols-1" :
            post.mediaRefs.length === 2 ? "grid-cols-2" :
            post.mediaRefs.length >= 3 ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {post.mediaRefs.slice(0, 4).map((ref, i) => {
            const src = ref.url ?? `https://ipfs.io/ipfs/${ref.cid}`;
            const isImage = ref.mimeType.startsWith("image/");
            const isVideo = ref.mimeType.startsWith("video/");
            const isAudio = ref.mimeType.startsWith("audio/");

            return (
              <div
                key={i}
                className={cn(
                  "relative bg-muted rounded-md overflow-hidden",
                  post.mediaRefs.length === 1 ? "aspect-video" : "aspect-square",
                  // 3+ images: first spans 2 cols
                  post.mediaRefs.length >= 3 && i === 0 ? "col-span-2 aspect-video" : ""
                )}
              >
                {isImage && (
                  <Image
                    src={src}
                    alt={`Media ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
                {isVideo && (
                  <video
                    src={src}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                )}
                {isAudio && (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-1">
                      <Music className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Audio</p>
                    </div>
                  </div>
                )}
                {!isImage && !isVideo && !isAudio && (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-mono text-xs text-muted-foreground">
                      {ref.cid.slice(0, 12)}…
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/80 cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* License chip */}
      {post.licenseType && (
        <div>
          <LicenseChip license={{ type: post.licenseType }} />
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-1 border-t text-muted-foreground">
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-1.5 text-xs hover:text-foreground transition-colors",
            liked && "text-red-500 hover:text-red-600"
          )}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} />
          <span>{likeCount}</span>
        </button>

        <Link
          href={`/post/${post._id}`}
          className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.commentsCount}</span>
        </Link>

        <Link
          href={`/create?remix=${post._id}`}
          className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
        >
          <Repeat2 className="h-4 w-4" />
          <span>{post.remixCount}</span>
        </Link>

        <div className="flex-1" />

        {/* Provenance panel trigger — shown when post has a PK CID */}
        {post.provenanceCid && (
          <ProvenancePanel
            cid={post.provenanceCid}
            actionId={post.actionId}
            postId={post._id}
          />
        )}
      </div>
    </article>
  );
}
