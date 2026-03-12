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
 * Multi-modal user messages (images/files) get their content parts converted
 * from AI SDK format to our MessagePart format so they display during streaming.
 */
function toRenderMessage(msg: Message): ChatMessage {
  if (typeof msg.content === "string") {
    return {
      _id: msg.id,
      conversationId: "",
      role: msg.role as "user" | "assistant",
      content: msg.content,
      createdAt: msg.createdAt ?? new Date(),
    };
  }

  // Multi-modal: convert AI SDK parts ({ type:"text"|"image", ... }) to our format
  const textParts: string[] = [];
  const contentParts: ChatMessage["contentParts"] = [];

  for (const part of msg.content as Array<{ type: string; text?: string; image?: string }>) {
    if (part.type === "text" && part.text) {
      textParts.push(part.text);
    } else if (part.type === "image" && part.image) {
      contentParts.push({ type: "image_url", url: part.image });
    }
  }

  return {
    _id: msg.id,
    conversationId: "",
    role: msg.role as "user" | "assistant",
    content: textParts.join(" "),
    contentParts: contentParts.length > 0 ? contentParts : undefined,
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
  // We can't match by ID (Vercel AI SDK IDs ≠ MongoDB _ids), so we use count instead:
  // if streamMessages has more messages than dbMessages, the extras are still in-flight.
  // We keep showing them until the DB refetch catches up, preventing a flash of missing messages.
  const inFlightCount = Math.max(0, streamMessages.length - dbMessages.length);
  const inFlightMessages =
    inFlightCount > 0 ? streamMessages.slice(streamMessages.length - inFlightCount) : [];

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
