"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.push("/feed");
  }, [ready, authenticated, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-8">
      <div className="text-center space-y-4 max-w-lg">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-2">
          <span className="text-primary-foreground font-bold text-xl">C</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Canvas</h1>
        <p className="text-muted-foreground text-lg">
          A social content platform where every post is provenance-tracked and
          every remix earns its contributors. Revenue splits to creators —
          automatically, onchain.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={login}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Get started
        </button>
        <a
          href="https://docs.provenancekit.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-input px-6 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          Learn more
        </a>
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-lg text-center text-sm">
        <div className="space-y-1">
          <div className="text-2xl">🎨</div>
          <p className="font-medium">Create</p>
          <p className="text-muted-foreground text-xs">Post text, images, video, audio</p>
        </div>
        <div className="space-y-1">
          <div className="text-2xl">🔗</div>
          <p className="font-medium">Remix</p>
          <p className="text-muted-foreground text-xs">Build on others' work with attribution</p>
        </div>
        <div className="space-y-1">
          <div className="text-2xl">💰</div>
          <p className="font-medium">Earn</p>
          <p className="text-muted-foreground text-xs">Revenue splits to all contributors</p>
        </div>
      </div>
    </div>
  );
}
