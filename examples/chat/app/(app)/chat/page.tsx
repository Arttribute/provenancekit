"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Sparkles, Image, Volume2, Shield, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/chat/chat-input";
import { useState } from "react";
import type { Conversation, UserSettings, FileAttachment } from "@/types";

const STARTER_PROMPTS = [
  { icon: Sparkles, label: "Explain quantum computing", prompt: "Explain quantum computing in simple terms" },
  { icon: Image, label: "Generate an image", prompt: "Generate an image of a futuristic city at night, neon lights reflecting on rain-soaked streets" },
  { icon: Volume2, label: "Read text aloud", prompt: "Write a short poem about the ocean and read it aloud" },
  { icon: Shield, label: "What is ProvenanceKit?", prompt: "What is ProvenanceKit and why does provenance tracking matter for AI?" },
];

export default function ChatHomePage() {
  const { ready, authenticated, user, login } = usePrivy();
  const router = useRouter();
  const qc = useQueryClient();
  const [input, setInput] = useState("");

  const { data: settingsData } = useQuery<{ settings: UserSettings }>({
    queryKey: ["settings", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/settings?userId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { mutate: createConversation, isPending } = useMutation({
    mutationFn: async (firstMessage: string) => {
      const settings = settingsData?.settings;
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          provider: settings?.defaultProvider ?? "openai",
          model: settings?.defaultModel ?? "gpt-4o",
          title: firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : ""),
        }),
      });
      return res.json() as Promise<Conversation>;
    },
    onSuccess: (conv, firstMessage) => {
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      // Navigate to new conversation; the chat page will auto-send the first message
      router.push(`/chat/${conv._id}?q=${encodeURIComponent(firstMessage)}`);
    },
  });

  function handleSubmit(e: React.FormEvent, _attachments?: FileAttachment[]) {
    e.preventDefault();
    if (!input.trim() || !authenticated) return;
    createConversation(input.trim());
    setInput("");
  }

  function handlePrompt(prompt: string) {
    if (!authenticated) { login(); return; }
    createConversation(prompt);
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div className="w-full max-w-2xl space-y-8">
          {/* Greeting */}
          <div className="text-center space-y-2">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-[28%] bg-primary text-primary-foreground font-bold text-lg">
              Pr
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {authenticated
                ? `Hello${user?.google?.name ? `, ${user.google.name.split(" ")[0]}` : user?.github?.name ? `, ${user.github.name.split(" ")[0]}` : ""}!`
                : "Welcome to PK Chat"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {authenticated
                ? "Every response is provenance-tracked. Ask me anything — or try DALL-E, TTS, or voice input."
                : "AI chat with built-in provenance tracking. Sign in to get started."}
            </p>
          </div>

          {/* Starter prompt cards */}
          <div className="grid grid-cols-2 gap-3">
            {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => handlePrompt(prompt)}
                disabled={isPending}
                className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3.5 text-left hover:bg-muted/60 hover:border-border/80 transition-all disabled:opacity-50 group"
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Input or Sign in */}
          {authenticated ? (
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              isLoading={isPending}
              placeholder="Message PK Chat…"
            />
          ) : (
            <div className="text-center">
              <Button size="lg" onClick={login} className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign in to start chatting
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom note */}
      {authenticated && (
        <div className="text-center text-xs text-muted-foreground pb-3">
          All responses are provenance-tracked via{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">ProvenanceKit</span>
          {" · "}Supports images, voice, and file attachments
        </div>
      )}
    </div>
  );
}
