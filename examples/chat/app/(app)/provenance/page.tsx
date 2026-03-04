"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ShieldCheck, MessageSquare, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getModelInfo } from "@/lib/provenance";
import type { Conversation, AIProvider } from "@/types";

const PROVIDER_COLORS: Record<AIProvider | string, string> = {
  openai: "success",
  anthropic: "secondary",
  google: "outline",
  custom: "muted",
} as const;

function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const modelInfo = getModelInfo(conversation.provider, conversation.model);
  const cid = conversation.provenanceCid;
  const trackedCount = conversation.provenance?.totalMessages ?? 0;

  return (
    <Link
      href={cid ? `/provenance/${cid}` : "#"}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors",
        cid ? "hover:bg-accent hover:border-ring cursor-pointer" : "opacity-60 cursor-default"
      )}
    >
      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{conversation.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {modelInfo && (
            <Badge variant="muted" className="text-xs px-1.5 py-0">
              {modelInfo.displayName}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {conversation.messageCount ?? 0} messages
          </span>
          {trackedCount > 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {trackedCount} tracked
            </span>
          )}
          {cid && (
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {cid.slice(0, 8)}…
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(conversation.updatedAt)}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function ProvenanceExplorerPage() {
  const { user } = usePrivy();
  const userId = user?.id;

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations?userId=${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const tracked = conversations?.filter((c) => c.provenanceCid) ?? [];
  const total = conversations?.length ?? 0;
  const totalMessages = conversations?.reduce((sum, c) => sum + (c.messageCount ?? 0), 0) ?? 0;
  const trackedMessages = conversations?.reduce(
    (sum, c) => sum + (c.provenance?.totalMessages ?? 0),
    0
  ) ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            Provenance Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View the provenance records for all your AI-generated content.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Conversations", value: total },
            { label: "Messages", value: totalMessages },
            { label: "PK Records", value: trackedMessages },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Conversation list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Provenance-tracked conversations ({tracked.length})
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : tracked.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
              <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No provenance records yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation and your AI responses will be automatically recorded here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracked.map((conversation) => (
                <ConversationRow
                  key={conversation._id}
                  conversation={conversation}
                />
              ))}
            </div>
          )}
        </div>

        {/* Untracked conversations */}
        {conversations && total > tracked.length && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Not yet tracked ({total - tracked.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              These conversations were created before ProvenanceKit was configured, or PK is
              currently disabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
