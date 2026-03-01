"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageSquare, Settings, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

export function ConversationSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = usePrivy();
  const qc = useQueryClient();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/conversations?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const newConversation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      return res.json() as Promise<Conversation>;
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      router.push(`/chat/${conv._id}`);
    },
  });

  return (
    <aside className="w-60 flex flex-col border-r bg-muted/30 h-full">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/chat" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            PK
          </div>
          <span className="text-sm font-semibold">Chat</span>
        </Link>
        <button
          onClick={() => newConversation.mutate()}
          disabled={newConversation.isPending}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">New chat</span>
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              No conversations yet
            </p>
          </div>
        ) : (
          <ul className="px-2 space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv._id}>
                <Link
                  href={`/chat/${conv._id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    pathname === `/chat/${conv._id}`
                      ? "bg-background border"
                      : "hover:bg-muted/60"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{conv.title}</span>
                  {conv.provenanceCid && (
                    <Shield className="h-3 w-3 ml-auto shrink-0 text-green-500" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-2 space-y-0.5">
        <Link
          href="/provenance"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors"
        >
          <Shield className="h-4 w-4 text-muted-foreground" />
          Provenance Explorer
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          Settings
        </Link>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
