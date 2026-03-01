"use client";

import { use, useRef, useState, useEffect } from "react";
import { useChat } from "ai/react";
import { usePrivy } from "@privy-io/react-auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Bot, User, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SupportedProvider } from "@/lib/provenance";

const PROVIDER_COLORS: Record<SupportedProvider, string> = {
  openai: "bg-green-500",
  anthropic: "bg-amber-500",
  google: "bg-blue-500",
  custom: "bg-purple-500",
};

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = usePrivy();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      body: { conversationId: id, userId: user?.id },
    });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2">
              <Bot className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Start the conversation. All responses are provenance-tracked.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-3xl mx-auto",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-1">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm max-w-[80%]",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}

              {/* Provenance badge (shown for assistant messages when CID is available) */}
              {msg.role === "assistant" && (msg as any).annotations?.provenanceCid && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground border-t pt-2">
                  <Shield className="h-3 w-3 text-green-500" />
                  <span>Provenance recorded</span>
                  <code className="font-mono text-xs opacity-70">
                    {((msg as any).annotations.provenanceCid as string).slice(0, 12)}…
                  </code>
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground mt-1">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 max-w-3xl mx-auto">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted rounded-xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <input
            className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            placeholder="Type a message…"
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Every AI response is provenance-tracked via ProvenanceKit
        </p>
      </div>
    </div>
  );
}
