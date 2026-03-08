"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useChat } from "ai/react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, History } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ModelSelector } from "@/components/chat/model-selector";
import { ProvenanceSheet } from "@/components/chat/provenance-sheet";
import { Button } from "@/components/ui/button";
import type { ChatMessage, Conversation, AIProvider, FileAttachment } from "@/types";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = usePrivy();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const searchParams = useSearchParams();
  const firstMessage = searchParams.get("q");
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["conversation", id, userId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${id}?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!userId,
  });

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
    staleTime: 0,
  });

  const dbMessages = historyData?.messages ?? [];

  const {
    messages: streamMessages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    append,
  } = useChat({
    api: "/api/chat",
    body: {
      conversationId: id,
      userId,
      provider: conversation?.provider ?? "openai",
      model: conversation?.model ?? "gpt-4o",
    },
    initialMessages: [],
    onFinish: () => {
      // Phase 1 — quick refetch so messages appear immediately (messages are saved before provenance)
      setTimeout(() => {
        refetchMessages();
        queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
        queryClient.invalidateQueries({ queryKey: ["conversation", id, userId] });
      }, 300);
      // Phase 2 — follow-up refetch to pick up provenance CIDs once async recording completes
      setTimeout(() => {
        refetchMessages();
        queryClient.invalidateQueries({ queryKey: ["conversation", id, userId] });
      }, 6000);
    },
  });

  // Auto-send first message passed via ?q= param (from chat home page)
  useEffect(() => {
    if (!firstMessage || !userId || isLoading || dbMessages.length > 0 || streamMessages.length > 0) return;
    append({ role: "user", content: firstMessage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMessage, userId]);

  async function handleModelChange(provider: AIProvider, model: string) {
    if (!userId) return;
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, provider, model }),
    });
    queryClient.invalidateQueries({ queryKey: ["conversation", id, userId] });
  }

  const handleFormSubmit = useCallback(
    (e: React.FormEvent, attachments?: FileAttachment[]) => {
      e.preventDefault();
      if (!input.trim() && (!attachments || attachments.length === 0)) return;

      const imageAttachments = (attachments ?? []).filter((a) => a.mimeType.startsWith("image/"));

      if (imageAttachments.length > 0) {
        const parts: Array<{ type: "text" | "image"; text?: string; image?: string }> = [];
        if (input.trim()) parts.push({ type: "text", text: input.trim() });
        for (const att of imageAttachments) {
          if (att.url) parts.push({ type: "image", image: att.url });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        append({ role: "user", content: parts as any });
        setInput("");
      } else {
        handleSubmit(e);
      }
    },
    [input, handleSubmit, append, setInput]
  );

  const hasSession = !!conversation?.provenance?.sessionId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background/80 backdrop-blur-sm">
        <h1 className="text-sm font-medium truncate min-w-0">
          {conversation?.title ?? "New conversation"}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <ModelSelector
            provider={conversation?.provider ?? "openai"}
            model={conversation?.model ?? "gpt-4o"}
            onChange={handleModelChange}
            disabled={isLoading}
            size="sm"
          />
          {/* Session provenance sheet toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSheetOpen(true)}
            disabled={!hasSession}
            className={
              hasSession
                ? "h-7 gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                : "h-7 gap-1 text-xs text-muted-foreground"
            }
            title={hasSession ? "View session provenance" : "No provenance session yet"}
          >
            <History className="h-3 w-3" />
            Provenance
          </Button>
          {conversation?.provenanceCid && (
            <Button variant="ghost" size="sm" asChild
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Link href={`/provenance/${conversation.provenanceCid}`}>
                <ShieldCheck className="h-3 w-3" />
                Explorer
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList
          dbMessages={dbMessages}
          streamMessages={streamMessages}
          isLoading={isLoading}
          isFetchingHistory={isFetchingHistory && dbMessages.length === 0}
        />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 bg-background">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleFormSubmit}
            isLoading={isLoading}
          />
          <p className="text-center text-xs text-muted-foreground mt-2">
            Every response is provenance-tracked via{" "}
            <Link href="/provenance" className="underline hover:text-foreground">
              ProvenanceKit
            </Link>
            {" · "}Try <strong>generate an image</strong> or <strong>read this aloud</strong>
          </p>
        </div>
      </div>

      {/* Session provenance sheet */}
      <ProvenanceSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        conversation={conversation}
      />
    </div>
  );
}
