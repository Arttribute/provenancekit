"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Repeat2, Shield, ExternalLink } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { formatRelativeTime } from "@/lib/utils";
import type { Post } from "@/types";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { id } = use(params);
  const { user } = usePrivy();
  const qc = useQueryClient();

  const { data: post, isLoading } = useQuery<Post>({
    queryKey: ["post", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
  });

  const { data: original } = useQuery<Post>({
    queryKey: ["post", post?.originalPostId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${post!.originalPostId}`);
      return res.json();
    },
    enabled: !!post?.originalPostId,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/posts/${id}/like`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post", id] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-xl border bg-muted animate-pulse" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Post not found</p>
        <Link href="/feed" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* Post */}
      <article className="rounded-xl border bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
              {post.authorId.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-sm">{post.authorId.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(post.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {post.provenanceCid && (
              <span
                className="flex items-center gap-1 rounded-full border bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-xs text-green-700 dark:text-green-400"
                title={`Provenance CID: ${post.provenanceCid}`}
              >
                <Shield className="h-3 w-3" />
                Verified
              </span>
            )}
            {post.originalPostId && (
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                Remix
              </span>
            )}
          </div>
        </div>

        {/* Original post reference */}
        {original && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground font-medium">Remixed from</p>
            <p className="line-clamp-2">{original.content}</p>
            {post.remixNote && (
              <p className="text-xs text-muted-foreground italic">&ldquo;{post.remixNote}&rdquo;</p>
            )}
          </div>
        )}

        {/* Content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

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

        {/* Provenance CID */}
        {post.provenanceCid && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Provenance Record</p>
            <p className="font-mono text-xs break-all">{post.provenanceCid}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t text-muted-foreground">
          <button
            onClick={() => likeMutation.mutate()}
            className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
          >
            ♥ {post.likesCount}
          </button>
          <Link
            href={`/create?remix=${post._id}`}
            className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
          >
            <Repeat2 className="h-4 w-4" />
            {post.remixCount} remixes
          </Link>
          {post.isPremium && post.x402Price && (
            <span className="ml-auto text-xs font-medium text-amber-600">
              ${post.x402Price} USDC
            </span>
          )}
        </div>
      </article>

      {/* Splits info */}
      {post.splitsContract && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Revenue Split</p>
          <p className="text-xs text-muted-foreground">
            Earnings from this post are distributed on-chain via a 0xSplits contract.
          </p>
          <a
            href={`https://app.splits.org/accounts/${post.splitsContract}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View contract <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Remix this post */}
      {user && (
        <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Remix this post</p>
            <p className="text-xs text-muted-foreground">Build on it with attribution</p>
          </div>
          <Link
            href={`/create?remix=${post._id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Repeat2 className="h-3.5 w-3.5" />
            Remix
          </Link>
        </div>
      )}
    </div>
  );
}
