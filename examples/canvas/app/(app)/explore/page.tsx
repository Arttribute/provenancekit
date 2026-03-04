"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Clock, Sparkles } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";
import type { Post } from "@/types";

type Tab = "trending" | "recent" | "provenance";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "trending",   label: "Trending",   icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: "recent",     label: "Recent",     icon: <Clock className="h-3.5 w-3.5" /> },
  { id: "provenance", label: "Verified",   icon: <Sparkles className="h-3.5 w-3.5" /> },
];

export default function ExplorePage() {
  const [tab, setTab] = useState<Tab>("trending");

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["explore", tab],
    queryFn: async () => {
      const res = await fetch(`/api/posts?explore=1&sort=${tab}`);
      return res.json();
    },
  });

  // Client-side filter for "verified" tab
  const displayPosts =
    tab === "provenance"
      ? posts.filter((p) => !!p.provenanceCid)
      : posts;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Discover content with on-chain provenance
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border animate-pulse bg-muted" />
          ))}
        </div>
      ) : displayPosts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">
            {tab === "provenance"
              ? "No verified posts yet. Be the first to create provenance-tracked content!"
              : "No posts yet. Be the first to create!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayPosts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
