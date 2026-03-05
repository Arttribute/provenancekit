"use client";

import { useEffect, useRef } from "react";
import { MessageItem, StreamingMessageItem } from "./message-item";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@/types";
import type { Message } from "ai";

interface MessageListProps {
  /** Historical messages loaded from MongoDB */
  dbMessages: ChatMessage[];
  /** Live streaming messages from useChat */
  streamMessages: Message[];
  isLoading: boolean;
  isFetchingHistory: boolean;
}

/**
 * Convert a Vercel AI SDK Message to our ChatMessage type for rendering.
 * Stream messages don't have provenance yet (set after response completes).
 */
function toRenderMessage(msg: Message): ChatMessage {
  return {
    _id: msg.id,
    conversationId: "",
    role: msg.role as "user" | "assistant",
    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    createdAt: msg.createdAt ?? new Date(),
  };
}

export function MessageList({
  dbMessages,
  streamMessages,
  isLoading,
  isFetchingHistory,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dbMessages.length, streamMessages.length, isLoading]);

  if (isFetchingHistory) {
    return (
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-4 flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // The stream messages from useChat include both user and assistant messages in real time.
  // We prefer dbMessages (which have provenance CIDs) but fall back to stream messages during
  // active streaming. Strategy: show dbMessages if we have them, else show streamMessages.
  const showDbMessages = dbMessages.length > 0;

  // During streaming, the last assistant response may not yet be in dbMessages.
  // Check if there's a streaming assistant message not yet saved to DB.
  const lastStreamMsg = streamMessages[streamMessages.length - 1];
  const hasInFlightAssistant =
    isLoading && lastStreamMsg?.role === "assistant" && showDbMessages;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="py-6 space-y-6">
        {showDbMessages ? (
          <>
            {dbMessages.map((msg) => (
              <MessageItem key={msg._id} message={msg} />
            ))}
            {hasInFlightAssistant && (
              <MessageItem
                key={lastStreamMsg.id + "-stream"}
                message={toRenderMessage(lastStreamMsg)}
                isStreaming
              />
            )}
          </>
        ) : (
          <>
            {streamMessages.map((msg, i) => (
              <MessageItem
                key={msg.id}
                message={toRenderMessage(msg)}
                isStreaming={isLoading && i === streamMessages.length - 1 && msg.role === "assistant"}
              />
            ))}
          </>
        )}
        {isLoading && !lastStreamMsg?.content && (
          <StreamingMessageItem />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
