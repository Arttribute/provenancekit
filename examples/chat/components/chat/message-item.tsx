"use client";

import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check, Image as ImageIcon, Volume2, Wrench, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { ProvenanceBadge } from "@/components/provenance/pk-ui";
import type { ProvenanceBundle } from "@provenancekit/sdk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getModelInfo } from "@/lib/provenance";
import type { ChatMessage, AIProvider } from "@/types";

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
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
    <Button variant="ghost" size="icon" onClick={copy}
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function AudioPlayer({ src, label }: { src: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { await el.play(); setPlaying(true); }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-3 py-2 max-w-xs">
      <button type="button" onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        {playing ? (
          <span className="flex gap-0.5">
            <span className="w-1 h-4 bg-current rounded animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-4 bg-current rounded animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-4 bg-current rounded animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{label ?? "Audio"}</p>
        <p className="text-xs text-muted-foreground">Click to play</p>
      </div>
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

function GeneratedImage({ url, revisedPrompt }: { url: string; revisedPrompt?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={revisedPrompt ?? "Generated image"}
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "rounded-xl border border-border cursor-pointer object-cover transition-all hover:opacity-90",
          expanded ? "max-w-full" : "max-h-64 max-w-sm"
        )}
      />
      {revisedPrompt && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">
          <span className="font-medium not-italic">Revised prompt:</span> {revisedPrompt}
        </p>
      )}
    </div>
  );
}

/** Squircle "Pr" badge with pulsing animation — shown while provenance is being recorded */
function ProvenanceRecordingBadge() {
  return (
    <div
      title="Recording provenance…"
      aria-label="Recording provenance"
      className="flex items-center justify-center shrink-0 animate-pulse"
      style={{
        width: 22,
        height: 22,
        borderRadius: "28%",
        background: "oklch(0.12 0 0)",
        opacity: 0.42,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: "#f8fafc",
          lineHeight: 1,
          letterSpacing: "-0.03em",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        Pr
      </span>
    </div>
  );
}

/** Squircle "Pr" badge in red — shown when provenance recording failed */
function ProvenanceFailedBadge({ label = "Provenance recording failed" }: { label?: string }) {
  return (
    <div
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center gap-1 shrink-0 px-1.5",
        "h-[18px]",
        "bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800",
        "rounded-md cursor-default"
      )}
    >
      <AlertCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
      <span className="text-[8px] font-bold text-red-600 dark:text-red-400 leading-none select-none">Pr</span>
    </div>
  );
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const router = useRouter();
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const provenanceCid = message.provenance?.cid;
  const provenanceStatus = message.provenanceStatus;
  const imageProv = message.imageProvenance;
  const modelInfo =
    message.model && message.provider ? getModelInfo(message.provider as AIProvider, message.model) : null;

  // Collect multi-modal parts from user message
  const imageParts = (message.contentParts ?? []).filter((p) => p.type === "image_url" && p.url);
  const fileParts = (message.contentParts ?? []).filter((p) => p.type === "file");

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-2 px-4">
        <div className="max-w-[75%] space-y-2">
          {/* Text bubble */}
          {message.content && (
            <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          )}
          {/* Image attachments */}
          {imageParts.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p.url} alt={p.name ?? "attachment"}
              className="rounded-xl max-h-48 object-cover border border-border" />
          ))}
          {/* File chips */}
          {fileParts.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-2 py-1 text-xs text-primary-foreground">
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isAssistant) {
    const hasImage = !!message.imageUrl;
    const hasAudio = !!message.audioUrl;

    return (
      <div className="group flex items-start gap-3 px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: model + tool badges + provenance + streaming indicator */}
          <div className="flex items-center gap-2 flex-wrap">
            {modelInfo && (
              <Badge variant="muted" className={cn("text-xs", PROVIDER_COLORS[message.provider ?? "openai"])}>
                {modelInfo.displayName}
              </Badge>
            )}
            {hasImage && (
              <Badge variant="muted" className="text-xs bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                <ImageIcon className="h-3 w-3 mr-1" />DALL-E 3
              </Badge>
            )}
            {hasAudio && (
              <Badge variant="muted" className="text-xs bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                <Volume2 className="h-3 w-3 mr-1" />TTS
              </Badge>
            )}
            {message.toolCalls && message.toolCalls.length > 0 && !hasImage && !hasAudio && (
              <Badge variant="muted" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                <Wrench className="h-3 w-3 mr-1" />Tool use
              </Badge>
            )}

            {/* ── Provenance status badge ── */}
            {/* While streaming, no provenance yet */}
            {!isStreaming && (
              <>
                {provenanceStatus === "recording" && <ProvenanceRecordingBadge />}
                {provenanceStatus === "failed" && <ProvenanceFailedBadge />}
                {provenanceStatus === "recorded" && provenanceCid && (
                  <span className="pk-badge-glow inline-flex">
                    <ProvenanceBadge
                      cid={provenanceCid}
                      bundle={message.provenance?.bundle as ProvenanceBundle | undefined}
                      variant="inline"
                      size="sm"
                      onViewDetail={() => router.push(`/provenance/${provenanceCid}`)}
                    />
                  </span>
                )}
              </>
            )}

            {/* ── Image provenance status (separate from text provenance) ── */}
            {hasImage && !isStreaming && (
              <>
                {imageProv?.status === "recording" && (
                  <ProvenanceRecordingBadge />
                )}
                {imageProv?.status === "failed" && (
                  <ProvenanceFailedBadge label="Image provenance recording failed" />
                )}
                {imageProv?.status === "recorded" && imageProv.cid && (
                  <span className="pk-badge-glow inline-flex">
                    <ProvenanceBadge
                      cid={imageProv.cid}
                      bundle={imageProv.bundle as ProvenanceBundle | undefined}
                      variant="inline"
                      size="sm"
                      onViewDetail={() => router.push(`/provenance/${imageProv.cid}`)}
                    />
                  </span>
                )}
              </>
            )}

            {isStreaming && (
              <span className="text-xs text-muted-foreground animate-pulse">Generating…</span>
            )}
          </div>

          {/* Generated image */}
          {hasImage && (
            <GeneratedImage url={message.imageUrl!} revisedPrompt={message.imageRevisedPrompt} />
          )}

          {/* Text content */}
          {message.content && (
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}

          {/* Audio player */}
          {hasAudio && (
            <AudioPlayer src={message.audioUrl!} label={message.audioText ? `"${message.audioText.slice(0, 40)}…"` : "Generated audio"} />
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-1">
            {message.usage && (
              <span className="text-xs text-muted-foreground">
                {message.usage.totalTokens.toLocaleString()} tokens
              </span>
            )}
            {message.content && <CopyButton text={message.content} />}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

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
