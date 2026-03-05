"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = usePrivy();
  const synced = useRef(false);

  // Sync Privy user to MongoDB once per session (only when logged in)
  useEffect(() => {
    if (!authenticated || !user || synced.current) return;
    synced.current = true;

    const email = user.email?.address ?? user.google?.email ?? user.github?.email;
    const name =
      user.google?.name ?? user.github?.name ?? email?.split("@")[0] ?? "User";

    fetch("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyDid: user.id, email, name }),
    }).catch((err) => console.warn("[sync] Failed to sync user:", err));
  }, [authenticated, user]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ConversationSidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
