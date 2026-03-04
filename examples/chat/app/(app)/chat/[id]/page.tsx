"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ModelSelector } from "@/components/chat/model-selector";
import { Button } from "@/components/ui/button";
import type { ChatMessage, Conversation, AIProvider } from "@/types";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = usePrivy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // ─── Fetch conversation metadata ─────────────────────────────────────────
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["conversation", id, userId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${id}?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!userId,
  });

  // ─── Fetch historical messages from DB ───────────────────────────────────
  const { data: historyData, isFetching: isFetchingHistory, refetch: refetchMessages } = useQuery<{
    messages: ChatMessage[];
  }>({
    queryKey: ["messages", id, userId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${id}/messages?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 0, // always re-fetch after sends
  });

  const dbMessages = historyData?.messages ?? [];
  const hasHistory = dbMessages.length > 0;

  // ─── useChat for streaming ────────────────────────────────────────────────
  const { messages: streamMessages, input, setInput, handleSubmit, isLoading, reload } =
    useChat({
      api: "/api/chat",
      body: {
        conversationId: id,
        userId,
        // Fallback values — the API reads canonical values from DB
        provider: conversation?.provider ?? "openai",
        model: conversation?.model ?? "gpt-4o",
      },
      // Don't send history — the API reads it from DB context (system prompt only)
      initialMessages: [],
      onFinish: () => {
        // After streaming completes, refresh messages from DB (now has provenance CIDs)
        setTimeout(() => {
          refetchMessages();
          queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
        }, 500); // small delay to let DB write complete
      },
    });

  // ─── Model change ────────────────────────────────────────────────────────
  async function handleModelChange(provider: AIProvider, model: string) {
    if (!userId) return;
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, provider, model }),
    });
    queryClient.invalidateQueries({ queryKey: ["conversation", id, userId] });
  }

  // ─── Submit wrapper (clear input, use stream, then refresh DB) ───────────
  function handleFormSubmit(e: React.FormEvent) {
    handleSubmit(e);
  }

  const sessionId = conversation?.provenance?.sessionId;

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-medium truncate">
            {conversation?.title ?? "New conversation"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Model selector */}
          <ModelSelector
            provider={conversation?.provider ?? "openai"}
            model={conversation?.model ?? "gpt-4o"}
            onChange={handleModelChange}
            disabled={isLoading}
            size="sm"
          />
          {/* Provenance explorer link (shown when session has provenance records) */}
          {conversation?.provenanceCid && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 gap-1 text-xs text-emerald-600 dark:text-emerald-400"
            >
              <Link href={`/provenance/${conversation.provenanceCid}`}>
                <ShieldCheck className="h-3 w-3" />
                Provenance
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList
          dbMessages={dbMessages}
          streamMessages={streamMessages}
          isLoading={isLoading}
          isFetchingHistory={isFetchingHistory && !hasHistory}
        />
      </div>

      {/* Input area */}
      <div className="border-t px-4 py-3 bg-background">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleFormSubmit}
            isLoading={isLoading}
          />
          <p className="text-center text-xs text-muted-foreground mt-2">
            Every AI response is automatically provenance-tracked via{" "}
            <Link href="/provenance" className="underline hover:text-foreground">
              ProvenanceKit
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
