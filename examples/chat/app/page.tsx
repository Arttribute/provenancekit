"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.push("/chat");
  }, [ready, authenticated, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-8">
      <div className="text-center space-y-4 max-w-lg">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-2">
          <span className="text-primary-foreground font-bold text-xl">PK</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">AI Chat</h1>
        <p className="text-muted-foreground text-lg">
          Chat with OpenAI, Anthropic, and Google models — with built-in
          provenance tracking. Every AI response is traced, verified, and
          attributable.
        </p>
      </div>

      <div className="flex gap-3">
        <Button size="lg" onClick={login}>
          Get started
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a
            href="https://docs.provenancekit.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
          </a>
        </Button>
      </div>

      <div className="flex gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          OpenAI GPT-4o
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Anthropic Claude
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Google Gemini
        </div>
      </div>
    </div>
  );
}
