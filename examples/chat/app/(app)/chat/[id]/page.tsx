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
    // Poll until the conversation has a provenanceCid (set after first recording completes).
    refetchInterval: (query) => {
      const conv = query.state.data as Conversation | undefined;
      return conv && !conv.provenanceCid ? 4000 : false;
    },
    refetchIntervalInBackground: false,
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
    // Poll every 4 s while any message is still recording provenance.
    // Stops automatically once all messages reach "recorded" or "failed".
    // On-chain provenance can take 20-30 s so a fixed 6 s timeout is not enough.
    refetchInterval: (query) => {
      const msgs = (query.state.data as { messages: ChatMessage[] } | undefined)?.messages ?? [];
      return msgs.some((m) => m.provenanceStatus === "recording") ? 4000 : false;
    },
    refetchIntervalInBackground: false,
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
      // Quick refetch so DB messages appear immediately.
      // refetchInterval takes over from here — it polls every 4 s until
      // all messages leave "recording" state (provenance + on-chain can take 20-30 s).
      setTimeout(() => {
        refetchMessages();
        queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
        queryClient.invalidateQueries({ queryKey: ["conversation", id, userId] });
      }, 300);
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
      const atts = attachments ?? [];
      if (!input.trim() && atts.length === 0) return;

      if (atts.length === 0) {
        // Plain text — use handleSubmit (input state already set)
        handleSubmit(e);
        return;
      }

      // Build text content string (non-image files inline + user input)
      const textParts: string[] = [];
      for (const att of atts) {
        if (!att.mimeType.startsWith("image/")) {
          textParts.push(
            att.textContent
              ? `**Attached: ${att.name}**\n\n${att.textContent}`
              : `**Attached file: ${att.name}** (${att.mimeType} — content not available inline)`
          );
        }
      }
      if (input.trim()) textParts.push(input.trim());

      // Images are sent via experimental_attachments — the Vercel AI SDK's supported
      // multimodal API for useChat. This ensures images reach the model correctly
      // instead of being silently dropped by the SDK's string-content serialization.
      const imageAttachments = atts
        .filter((att) => att.mimeType.startsWith("image/") && att.url)
        .map((att) => ({ url: att.url!, contentType: att.mimeType, name: att.name }));

      // Attachment metadata in the request body for provenance recording
      const attachmentMeta = atts.map(({ cid, url, mimeType, name }) => ({ cid, url, mimeType, name }));

      append(
        { role: "user", content: textParts.join("\n\n") || " " },
        {
          body: { attachments: attachmentMeta },
          experimental_attachments: imageAttachments.length > 0 ? imageAttachments : undefined,
        }
      );
      setInput("");
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
            userId={userId}
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
