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

  const hasDbMessages = dbMessages.length > 0;

  // Find in-flight messages from the current exchange that haven't been saved to DB yet.
  // These are the messages the user just sent + the streaming assistant response.
  // We identify them by checking if the last stream message is newer than the last DB message.
  // Strategy: find the index of the most recent user message in streamMessages that
  // doesn't have a matching message in dbMessages (matched by _id).
  const dbIds = new Set(dbMessages.map((m) => m._id));
  // Walk stream messages from the end to find the first one not yet in DB
  let inFlightStartIdx = streamMessages.length;
  for (let i = streamMessages.length - 1; i >= 0; i--) {
    if (dbIds.has(streamMessages[i].id)) break;
    inFlightStartIdx = i;
  }
  const inFlightMessages = streamMessages.slice(inFlightStartIdx);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="py-6 space-y-6">
        {hasDbMessages ? (
          <>
            {/* Persisted messages (include provenance CIDs once recorded) */}
            {dbMessages.map((msg) => (
              <MessageItem key={msg._id} message={msg} />
            ))}
            {/* In-flight messages from the current exchange not yet in DB */}
            {inFlightMessages.map((msg, i) => {
              const isLastAssistant =
                isLoading && i === inFlightMessages.length - 1 && msg.role === "assistant";
              return (
                <MessageItem
                  key={msg.id + "-inflight"}
                  message={toRenderMessage(msg)}
                  isStreaming={isLastAssistant}
                />
              );
            })}
          </>
        ) : (
          <>
            {/* No DB messages yet — show stream messages directly (first exchange) */}
            {streamMessages.map((msg, i) => (
              <MessageItem
                key={msg.id}
                message={toRenderMessage(msg)}
                isStreaming={isLoading && i === streamMessages.length - 1 && msg.role === "assistant"}
              />
            ))}
          </>
        )}
        {isLoading && inFlightMessages.length === 0 && streamMessages.length === 0 && (
          <StreamingMessageItem />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
