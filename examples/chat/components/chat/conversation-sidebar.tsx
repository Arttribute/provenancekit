"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageSquare, Settings, LogOut, ShieldCheck, Search, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ConversationSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = usePrivy();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 250);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations", user?.id, debouncedSearch],
    queryFn: async () => {
      if (!user?.id) return [];
      const params = new URLSearchParams({ userId: user.id });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/conversations?${params}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const newConversation = useMutation({
    mutationFn: async () => {
      // Fetch user's saved model preference
      const settingsRes = await fetch(`/api/settings?userId=${user?.id}`);
      const settingsData = settingsRes.ok ? await settingsRes.json() : null;
      const provider = settingsData?.settings?.defaultProvider ?? "openai";
      const model = settingsData?.settings?.defaultModel ?? "gpt-4o";

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          provider,
          model,
          title: "New conversation",
        }),
      });
      return res.json() as Promise<Conversation>;
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      router.push(`/chat/${conv._id}`);
    },
  });

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId === id) return;
    setDeletingId(id);
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      if (pathname === `/chat/${id}`) router.push("/chat");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="w-64 flex flex-col border-r bg-muted/20 h-full">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        <Link href="/chat" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            PK
          </div>
          <span className="text-sm font-semibold">Chat</span>
        </Link>
        <button
          onClick={() => newConversation.mutate()}
          disabled={newConversation.isPending}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">New chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="pl-8 h-7 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              {search ? "No conversations match your search" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <ul className="px-2 space-y-0.5">
            {conversations.map((conv) => {
              const isActive = pathname === `/chat/${conv._id}`;
              return (
                <li key={conv._id} className="group relative">
                  <Link
                    href={`/chat/${conv._id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors pr-8",
                      isActive
                        ? "bg-background border shadow-sm"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{conv.title}</span>
                    {conv.provenanceCid && (
                      <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" aria-label="Provenance tracked" />
                    )}
                  </Link>
                  {/* Delete button — only visible on hover */}
                  <button
                    onClick={(e) => deleteConversation(conv._id, e)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-2 space-y-0.5">
        <Link
          href="/provenance"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            pathname === "/provenance"
              ? "bg-background border"
              : "hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Provenance Explorer
        </Link>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-background border"
              : "hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
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
