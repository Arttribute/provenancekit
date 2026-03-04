"use client";

import { use } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MapPin, Link as LinkIcon, Shield, Users, FileText } from "lucide-react";
import { formatRelativeTime, truncateAddress } from "@/lib/utils";
import { PostCard } from "@/components/feed/post-card";
import type { PublicUser, Post } from "@/types";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params);
  const { user: privyUser } = usePrivy();
  const qc = useQueryClient();

  const isOwnProfile = privyUser?.id === id;

  const { data: profile, isLoading: profileLoading } = useQuery<PublicUser>({
    queryKey: ["user", id],
    queryFn: async () => {
      const qs = privyUser?.id ? `?requesterId=${privyUser.id}` : "";
      const res = await fetch(`/api/users/${id}${qs}`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["posts", "author", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts?authorId=${id}`);
      return res.json();
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!privyUser?.id) throw new Error("Not logged in");
      const method = profile?.isFollowing ? "DELETE" : "POST";
      const url = `/api/users/${id}/follow${profile?.isFollowing ? `?followerId=${privyUser.id}` : ""}`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: profile?.isFollowing ? undefined : JSON.stringify({ followerId: privyUser.id }),
      });
      if (!res.ok) throw new Error("Follow action failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", id] });
    },
  });

  if (profileLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">User not found</p>
        <Link href="/feed" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const displayName = profile.displayName || profile.username;
  const avatarSrc = profile.avatar
    ? profile.avatar.startsWith("http")
      ? profile.avatar
      : `https://ipfs.io/ipfs/${profile.avatar}`
    : null;

  const provenancePostCount = posts.filter((p) => p.provenanceCid).length;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Profile card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-br from-primary/20 via-purple-500/10 to-blue-500/10 relative">
          {profile.banner && (
            <Image
              src={profile.banner.startsWith("http") ? profile.banner : `https://ipfs.io/ipfs/${profile.banner}`}
              alt="Banner"
              fill
              className="object-cover"
              unoptimized
            />
          )}
        </div>

        {/* Avatar + actions */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="relative">
              {avatarSrc ? (
                <div className="relative h-20 w-20 rounded-full border-4 border-background overflow-hidden">
                  <Image src={avatarSrc} alt={displayName} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-muted text-lg font-bold">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isOwnProfile ? (
                <Link
                  href="/settings"
                  className="rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  Edit profile
                </Link>
              ) : (
                <button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  className={
                    "rounded-md px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 " +
                    (profile.isFollowing
                      ? "border hover:bg-muted"
                      : "bg-primary text-primary-foreground hover:bg-primary/90")
                  }
                >
                  {followMutation.isPending
                    ? "…"
                    : profile.isFollowing
                    ? "Following"
                    : "Follow"}
                </button>
              )}
            </div>
          </div>

          {/* Name + handle */}
          <div className="space-y-1">
            <h1 className="text-lg font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && (
              <p className="text-sm leading-relaxed mt-2">{profile.bio}</p>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
            {profile.wallet && (
              <span className="flex items-center gap-1 font-mono">
                <MapPin className="h-3 w-3" />
                {truncateAddress(profile.wallet)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              Joined {formatRelativeTime(profile.createdAt)}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div>
              <span className="font-semibold">{profile.followingCount}</span>
              <span className="text-muted-foreground ml-1">Following</span>
            </div>
            <div>
              <span className="font-semibold">{profile.followersCount}</span>
              <span className="text-muted-foreground ml-1">Followers</span>
            </div>
            <div>
              <span className="font-semibold">{profile.postsCount}</span>
              <span className="text-muted-foreground ml-1">Posts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Provenance summary */}
      {provenancePostCount > 0 && (
        <div className="rounded-xl border bg-green-50 dark:bg-green-900/10 p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 shrink-0">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              {provenancePostCount} provenance-tracked posts
            </p>
            <p className="text-xs text-green-700 dark:text-green-400">
              Authorship verified on-chain via ProvenanceKit
            </p>
          </div>
          {profile.provenanceEntityId && (
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground font-medium">Entity ID</p>
              <p className="font-mono text-xs text-muted-foreground">
                {profile.provenanceEntityId.slice(0, 12)}…
              </p>
            </div>
          )}
        </div>
      )}

      {/* Posts */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-1 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Posts</h2>
          <span className="text-xs text-muted-foreground">({posts.length})</span>
        </div>

        {postsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl border bg-muted animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No posts yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
