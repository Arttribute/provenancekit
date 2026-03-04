"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/chat/empty-state";
import { useQuery } from "@tanstack/react-query";
import type { Conversation, UserSettings } from "@/types";

export default function ChatHomePage() {
  const { user } = usePrivy();
  const router = useRouter();
  const qc = useQueryClient();

  // Load user settings to pick up saved model preference
  const { data: settingsData } = useQuery<{ settings: UserSettings }>({
    queryKey: ["settings", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/settings?userId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { mutate: createConversation, isPending } = useMutation({
    mutationFn: async (firstMessage?: string) => {
      const settings = settingsData?.settings;
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          provider: settings?.defaultProvider ?? "openai",
          model: settings?.defaultModel ?? "gpt-4o",
          title: firstMessage
            ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "")
            : "New conversation",
        }),
      });
      return res.json() as Promise<Conversation>;
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      router.push(`/chat/${conv._id}`);
    },
  });

  return (
    <div className="flex flex-col h-full">
      <EmptyState
        onPromptClick={(prompt) => {
          if (!isPending) createConversation(prompt);
        }}
      />
    </div>
  );
}
