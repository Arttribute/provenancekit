"use client";

import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import { ProvenanceBadge } from "@/components/provenance/pk-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getModelInfo } from "@/lib/provenance";
import type { ChatMessage, AIProvider } from "@/types";

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

const PROVIDER_COLORS: Record<AIProvider | string, string> = {
  openai: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  anthropic: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  google: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  custom: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={copy}
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const router = useRouter();
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const provenanceCid = message.provenance?.cid;
  const modelInfo = message.model && message.provider
    ? getModelInfo(message.provider, message.model)
    : null;

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-2 px-4">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="group flex items-start gap-3 px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {/* Message header: model badge + provenance badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {modelInfo && (
              <Badge
                variant="muted"
                className={cn("text-xs", PROVIDER_COLORS[message.provider ?? "openai"])}
              >
                {modelInfo.displayName}
              </Badge>
            )}
            {provenanceCid && (
              <ProvenanceBadge
                cid={provenanceCid}
                variant="inline"
                size="sm"
                onViewDetail={() => router.push(`/provenance/${provenanceCid}`)}
              />
            )}
            {isStreaming && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Generating…
              </span>
            )}
          </div>

          {/* Message content with markdown rendering */}
          <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Footer: token count + copy button */}
          <div className="flex items-center justify-between px-1">
            {message.usage && (
              <span className="text-xs text-muted-foreground">
                {message.usage.totalTokens.toLocaleString()} tokens
              </span>
            )}
            <CopyButton text={message.content} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Streaming assistant placeholder shown while response is being generated */
export function StreamingMessageItem() {
  return (
    <div className="flex items-start gap-3 px-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
