"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LandingCTAButton({ variant = "dark" }: { variant?: "dark" | "outline-light" }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !authenticated || !user) return;

    async function establishSession() {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const wallet =
          user?.wallet?.address ??
          (
            user?.linkedAccounts?.find(
              (a: { type: string }) => a.type === "wallet"
            ) as { address?: string } | undefined
          )?.address;

        await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: user?.email?.address,
            wallet,
            name: user?.google?.name ?? user?.github?.name ?? undefined,
          }),
        });

        router.replace("/dashboard");
      } catch {
        // silently continue
      }
    }

    establishSession();
  }, [ready, authenticated, user, getAccessToken, router]);

  if (!ready) return null;

  if (authenticated) {
    const base =
      variant === "outline-light"
        ? "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-sm text-slate-200 opacity-60 cursor-not-allowed"
        : "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white opacity-60 cursor-not-allowed";
    return (
      <span className={base}>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading
      </span>
    );
  }

  if (variant === "outline-light") {
    return (
      <button
        onClick={() => login()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
      >
        Get started
      </button>
    );
  }

  return (
    <button
      onClick={() => login()}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
    >
      Get started
    </button>
  );
}
