"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import type { Post } from "@/types";

export default function FeedPage() {
  const { user } = usePrivy();

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["feed", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/posts?feed=1&userId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-4">
      {/* Create prompt */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {user?.email?.slice(0, 2).toUpperCase() ?? "?"}
        </div>
        <Link
          href="/create"
          className="flex-1 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          What are you creating today?
        </Link>
        <Link
          href="/create"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border animate-pulse bg-muted" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-lg font-medium">Nothing in your feed yet</p>
          <p className="text-sm text-muted-foreground">
            Follow creators or start posting to see content here
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Explore content
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
