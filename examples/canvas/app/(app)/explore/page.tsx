"use client";

import { useQuery } from "@tanstack/react-query";
import { PostCard } from "@/components/feed/post-card";
import type { Post } from "@/types";

export default function ExplorePage() {
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["explore"],
    queryFn: async () => {
      const res = await fetch("/api/posts?explore=1");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Discover trending content with on-chain provenance
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border animate-pulse bg-muted" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No posts yet. Be the first to create!</p>
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
