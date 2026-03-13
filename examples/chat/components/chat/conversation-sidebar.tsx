"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  MessageSquare,
  Settings,
  LogOut,
  ShieldCheck,
  Search,
  Trash2,
  LogIn,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
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

/** Group conversations by recency for ChatGPT-like display */
function groupByDate(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);
  const month = new Date(today.getTime() - 30 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Previous 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= week) groups[2].items.push(conv);
    else if (d >= month) groups[3].items.push(conv);
    else groups[4].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ConversationSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 250);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
      if (!user?.id) throw new Error("Not logged in");
      const settingsRes = await fetch(`/api/settings?userId=${user.id}`);
      const settingsData = settingsRes.ok ? await settingsRes.json() : null;
      const provider = settingsData?.settings?.defaultProvider ?? "openai";
      const model = settingsData?.settings?.defaultModel ?? "gpt-4o";
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
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

  // Derive display name and initials
  const displayName =
    user?.google?.name ??
    user?.github?.name ??
    user?.email?.address?.split("@")[0] ??
    "User";
  const displayEmail =
    user?.email?.address ?? user?.google?.email ?? user?.github?.email ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  const groups = groupByDate(conversations);

  return (
    <aside className="w-64 flex flex-col border-r bg-sidebar h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex h-14 items-center justify-between px-3 border-b">
        <Link href="/chat" className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            Pr
          </div>
          <span className="text-sm font-semibold truncate">Pr Chat</span>
        </Link>
        <button
          onClick={() => (authenticated ? newConversation.mutate() : login())}
          disabled={newConversation.isPending}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
          title={authenticated ? "New conversation" : "Sign in to chat"}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Search (only when logged in) ───────────────────────────── */}
      {authenticated && (
        <div className="px-3 py-2">
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
      )}

      {/* ── Conversation list ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2">
        {!authenticated ? (
          // Not logged in — teaser content
          <div className="px-4 py-10 text-center space-y-3">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sign in to save your conversations and track provenance
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              {search ? "No conversations match" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-2">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((conv) => {
                    const isActive = pathname === `/chat/${conv._id}`;
                    return (
                      <li key={conv._id} className="group relative">
                        <Link
                          href={`/chat/${conv._id}`}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors pr-7",
                            isActive
                              ? "bg-background border shadow-sm"
                              : "hover:bg-muted/60",
                          )}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                          <span className="truncate flex-1 text-xs">
                            {conv.title}
                          </span>
                          {conv.provenanceCid && (
                            <ShieldCheck
                              className="h-3 w-3 shrink-0 text-emerald-500"
                              aria-label="Provenance tracked"
                            />
                          )}
                        </Link>
                        <button
                          onClick={(e) => deleteConversation(conv._id, e)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Nav links ─────────────────────────────────────────────── */}
      <div className="border-t px-2 py-1.5 space-y-0.5">
        {authenticated && (
          <>
            <Link
              href="/provenance"
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                pathname.startsWith("/provenance")
                  ? "bg-background border font-medium"
                  : "hover:bg-muted/60 text-muted-foreground",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Provenance Explorer
            </Link>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                pathname === "/settings"
                  ? "bg-background border font-medium"
                  : "hover:bg-muted/60 text-muted-foreground",
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
          </>
        )}
      </div>

      {/* ── Profile / Sign in ──────────────────────────────────────── */}
      <div className="border-t p-2" ref={profileRef}>
        {!ready ? (
          <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />
        ) : authenticated && user ? (
          // ── User profile card ──
          <div className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/60 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{displayName}</p>
                {displayEmail && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {displayEmail}
                  </p>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                  profileOpen && "rotate-180",
                )}
              />
            </button>

            {/* Profile popup menu */}
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border bg-popover shadow-lg py-1 z-10">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          // ── Login button ──
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/60 transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}
