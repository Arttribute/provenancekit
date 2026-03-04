"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Repeat2, ExternalLink, Heart, MessageCircle, Send, GitBranch, Users, Zap, Music } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { formatRelativeTime, truncateAddress } from "@/lib/utils";
import { ProvenanceBundleView, LicenseChip, VerificationIndicator } from "@provenancekit/ui";
import { ProvenancePanel } from "@/components/provenance/provenance-panel";
import type { Post, Comment, PublicUser } from "@/types";
import type { ProvenanceBundle } from "@provenancekit/sdk";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

type SelectedTab = "provenance" | "splits";

export default function PostPage({ params }: PostPageProps) {
  const { id } = use(params);
  const { user: privyUser } = usePrivy();
  const qc = useQueryClient();
  const [commentContent, setCommentContent] = useState("");
  const [activeTab, setActiveTab] = useState<SelectedTab>("provenance");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState<number | null>(null);

  // ── Data fetching ───────────────────────────────────
  const { data: post, isLoading: postLoading } = useQuery<Post>({
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

  const { data: author } = useQuery<PublicUser>({
    queryKey: ["user", post?.authorId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${post!.authorId}`);
      return res.json();
    },
    enabled: !!post?.authorId,
  });

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["comments", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${id}/comments`);
      return res.json();
    },
  });

  const { data: bundle, isLoading: bundleLoading } = useQuery<ProvenanceBundle>({
    queryKey: ["pk-bundle", post?.provenanceCid],
    queryFn: () => fetch(`/api/pk/bundle/${post!.provenanceCid}`).then(r => r.json()),
    enabled: !!post?.provenanceCid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: distribution } = useQuery<{ entries: Array<{ entityId: string; wallet?: string; bps: number; percentage: string }> }>({
    queryKey: ["pk-distribution", post?.provenanceCid],
    queryFn: () => fetch(`/api/pk/distribution/${post!.provenanceCid}`).then(r => r.json()),
    enabled: !!post?.provenanceCid && activeTab === "splits",
    staleTime: 5 * 60 * 1000,
  });

  // ── Mutations ────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/posts/${id}/like`, { method: "POST" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId: privyUser?.id, content }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", id] });
      qc.invalidateQueries({ queryKey: ["post", id] });
      setCommentContent("");
    },
  });

  const splitsDeployMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${id}/splits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployerId: privyUser?.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Deploy failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post", id] });
      qc.invalidateQueries({ queryKey: ["pk-distribution", post?.provenanceCid] });
    },
  });

  function handleLike() {
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => (c ?? (post?.likesCount ?? 0)) + 1);
    likeMutation.mutate();
  }

  // ── Loading / error states ───────────────────────────
  if (postLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="h-64 rounded-xl border bg-muted" />
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

  const displayLikeCount = likeCount ?? post.likesCount;
  const authorName = author?.displayName || author?.username || post.authorId.slice(0, 8);
  const avatarSrc = author?.avatar
    ? author.avatar.startsWith("http")
      ? author.avatar
      : `https://ipfs.io/ipfs/${author.avatar}`
    : null;

  const isOwnPost = privyUser?.id === post.authorId;
  const canDeploySplits = isOwnPost && !!post.provenanceCid && !post.splitsContract;

  const verificationStatus =
    post.provenanceCid
      ? post.provenanceStatus === "verified" ? "verified"
      : post.provenanceStatus === "partial" ? "partial"
      : "unverified"
      : undefined;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* ── Main post ────────────────────────────────────── */}
      <article className="rounded-xl border bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {avatarSrc ? (
              <div className="relative h-11 w-11 rounded-full overflow-hidden shrink-0">
                <Image src={avatarSrc} alt={authorName} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-bold shrink-0">
                {authorName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <Link href={`/profile/${post.authorId}`} className="font-semibold hover:underline underline-offset-2">
                {authorName}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {author?.username && <span>@{author.username}</span>}
                {author?.username && <span>·</span>}
                <span>{formatRelativeTime(post.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {verificationStatus && (
              <VerificationIndicator status={verificationStatus} size="sm" />
            )}
            {post.originalPostId && (
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Remix</span>
            )}
          </div>
        </div>

        {/* Original post reference */}
        {original && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Repeat2 className="h-3 w-3" /> Remixed from
            </p>
            <p className="line-clamp-2">{original.content}</p>
            {post.remixNote && (
              <p className="text-xs text-muted-foreground italic">&ldquo;{post.remixNote}&rdquo;</p>
            )}
            <Link
              href={`/post/${original._id}`}
              className="text-xs text-primary hover:underline"
            >
              View original →
            </Link>
          </div>
        )}

        {/* Content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {/* Media */}
        {post.mediaRefs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl overflow-hidden">
            {post.mediaRefs.map((ref, i) => {
              const src = ref.url ?? `https://ipfs.io/ipfs/${ref.cid}`;
              const isImage = ref.mimeType.startsWith("image/");
              const isVideo = ref.mimeType.startsWith("video/");
              const isAudio = ref.mimeType.startsWith("audio/");
              return (
                <div key={i} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  {isImage && <Image src={src} alt={`Media ${i+1}`} fill className="object-cover" unoptimized />}
                  {isVideo && <video src={src} controls className="w-full h-full object-cover" />}
                  {isAudio && (
                    <div className="flex h-full items-center justify-center flex-col gap-2">
                      <Music className="h-10 w-10 text-muted-foreground/50" />
                      <audio src={src} controls className="w-full px-4" />
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
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}

        {/* License */}
        {post.licenseType && (
          <div className="flex items-center gap-2">
            <LicenseChip license={{ type: post.licenseType }} />
            {post.aiTraining && post.aiTraining !== "unspecified" && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                post.aiTraining === "reserved"
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}>
                AI training: {post.aiTraining}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t text-muted-foreground">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs hover:text-foreground transition-colors ${liked ? "text-red-500" : ""}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            <span>{displayLikeCount}</span>
          </button>
          <span className="flex items-center gap-1.5 text-xs">
            <MessageCircle className="h-4 w-4" />
            <span>{comments.length}</span>
          </span>
          <Link href={`/create?remix=${post._id}`} className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors">
            <Repeat2 className="h-4 w-4" />
            <span>{post.remixCount} remixes</span>
          </Link>
          <div className="flex-1" />
          {post.isPremium && post.x402Price && (
            <span className="text-xs font-semibold text-amber-600">${post.x402Price} USDC</span>
          )}
        </div>
      </article>

      {/* ── Provenance & Splits tabs ─────────────────────── */}
      {post.provenanceCid && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b">
            {([
              { id: "provenance" as const, label: "Provenance", icon: GitBranch },
              { id: "splits" as const,     label: "Revenue Split", icon: Users },
            ] as const).map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tabId
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Provenance tab */}
          {activeTab === "provenance" && (
            <div className="p-5 space-y-4">
              {/* CID info */}
              <div className="rounded-lg bg-muted/40 border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Content CID</p>
                  <a
                    href={`https://ipfs.io/ipfs/${post.provenanceCid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    IPFS <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="font-mono text-xs break-all">{post.provenanceCid}</p>
              </div>

              {/* Bundle view */}
              {bundleLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : bundle ? (
                <ProvenanceBundleView
                  bundle={bundle}
                  showGraph={false}
                  showEntities
                  showActions
                  showResources
                  showAttributions
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Bundle data unavailable
                </p>
              )}
            </div>
          )}

          {/* Splits tab */}
          {activeTab === "splits" && (
            <div className="p-5 space-y-4">
              {post.splitsContract ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Splits Contract</p>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5 break-all">
                        {post.splitsContract}
                      </p>
                    </div>
                    <a
                      href={`https://app.splits.org/accounts/${post.splitsContract}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 ml-2"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {distribution?.entries?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Distribution</p>
                      {distribution.entries.map((e) => (
                        <div key={e.entityId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs">{e.entityId.slice(0, 20)}…</p>
                            {e.wallet && (
                              <p className="text-xs text-muted-foreground">{truncateAddress(e.wallet)}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{e.percentage}%</p>
                            <p className="text-xs text-muted-foreground">{e.bps} bps</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : distribution?.entries?.length ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                    <p className="text-sm font-medium">Provenance-based distribution</p>
                    <p className="text-xs text-muted-foreground">
                      Based on the provenance graph, revenue would be split as follows.
                      Deploy a 0xSplits contract to activate automatic payouts.
                    </p>
                    <div className="space-y-2">
                      {distribution.entries.map((e) => (
                        <div key={e.entityId} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs truncate">{e.entityId.slice(0, 20)}…</p>
                            {e.wallet && <p className="text-xs text-muted-foreground">{truncateAddress(e.wallet)}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{e.percentage}%</p>
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${e.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {canDeploySplits && (
                    <button
                      onClick={() => splitsDeployMutation.mutate()}
                      disabled={splitsDeployMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Zap className="h-4 w-4" />
                      {splitsDeployMutation.isPending ? "Deploying…" : "Deploy Splits Contract"}
                    </button>
                  )}
                  {splitsDeployMutation.isError && (
                    <p className="text-xs text-destructive">{(splitsDeployMutation.error as Error).message}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {canDeploySplits ? "Loading distribution…" : "No splits configured"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Remix prompt ─────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Remix this post</p>
          <p className="text-xs text-muted-foreground">Build on it — attribution tracked automatically</p>
        </div>
        <Link
          href={`/create?remix=${post._id}`}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Repeat2 className="h-3.5 w-3.5" />
          Remix
        </Link>
      </div>

      {/* ── Comments ─────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            Comments ({comments.length})
          </h2>
        </div>

        {/* Comment input */}
        {privyUser && (
          <div className="px-5 py-3 border-b flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
              {privyUser.id.slice(-2).toUpperCase()}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentContent.trim()) {
                    e.preventDefault();
                    commentMutation.mutate(commentContent.trim());
                  }
                }}
                placeholder="Add a comment…"
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => {
                  if (commentContent.trim()) commentMutation.mutate(commentContent.trim());
                }}
                disabled={commentMutation.isPending || !commentContent.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Comments list */}
        <div className="divide-y">
          {comments.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const cAuthor = comment.authorDisplayName || comment.authorUsername || comment.authorId.slice(0, 8);
              return (
                <div key={comment._id} className="px-5 py-3 flex gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0 mt-0.5">
                    {cAuthor.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Link href={`/profile/${comment.authorId}`} className="font-medium text-foreground hover:underline">
                        {cAuthor}
                      </Link>
                      <span>·</span>
                      <span>{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
