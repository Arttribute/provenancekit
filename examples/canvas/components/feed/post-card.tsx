"use client";

import Link from "next/link";
import { Heart, MessageCircle, Repeat2, Shield, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { Post } from "@/types";

interface PostCardProps {
  post: Post;
  compact?: boolean;
}

export function PostCard({ post, compact }: PostCardProps) {
  return (
    <article className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
            {post.authorId.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <Link
              href={`/post/${post._id}`}
              className="text-sm font-medium hover:underline underline-offset-4"
            >
              {post.authorId.slice(0, 8)}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(post.createdAt)}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {post.provenanceCid && (
            <span
              className="flex items-center gap-1 rounded-full border bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-xs text-green-700 dark:text-green-400"
              title={`Provenance CID: ${post.provenanceCid}`}
            >
              <Shield className="h-3 w-3" />
              Verified
            </span>
          )}
          {post.splitsContract && (
            <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Split
            </span>
          )}
          {post.originalPostId && (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              Remix
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

      {/* Media thumbnails */}
      {post.mediaRefs.length > 0 && (
        <div
          className={cn(
            "grid gap-2 rounded-lg overflow-hidden",
            post.mediaRefs.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}
        >
          {post.mediaRefs.slice(0, 4).map((ref, i) => (
            <div
              key={i}
              className="aspect-video bg-muted flex items-center justify-center rounded-md text-xs text-muted-foreground"
            >
              <span className="font-mono">{ref.cid.slice(0, 12)}…</span>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1 border-t text-muted-foreground">
        <button className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors">
          <Heart className="h-4 w-4" />
          <span>{post.likesCount}</span>
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
        {post.isPremium && post.x402Price && (
          <span className="text-xs font-medium text-amber-600">
            ${post.x402Price} USDC
          </span>
        )}
      </div>
    </article>
  );
}
