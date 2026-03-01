"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.push("/");
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
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
