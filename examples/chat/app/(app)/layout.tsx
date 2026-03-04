"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const synced = useRef(false);

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (ready && !authenticated) router.push("/");
  }, [ready, authenticated, router]);

  // Sync Privy user to MongoDB once per session
  useEffect(() => {
    if (!authenticated || !user || synced.current) return;
    synced.current = true;

    const email = user.email?.address ?? user.google?.email ?? user.github?.email;
    const name =
      user.google?.name ??
      user.github?.name ??
      email?.split("@")[0] ??
      "User";

    fetch("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyDid: user.id, email, name }),
    }).catch((err) => console.warn("[sync] Failed to sync user:", err));
  }, [authenticated, user]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ConversationSidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
