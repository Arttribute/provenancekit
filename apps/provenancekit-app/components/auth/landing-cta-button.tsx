"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import Link from "next/link";

const DASHBOARD_OPEN = process.env.NEXT_PUBLIC_DASHBOARD_OPEN === "true";

export function LandingCTAButton({ variant = "dark" }: { variant?: "dark" | "outline-light" }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();

  // Establish session whenever authenticated, so the cookie is ready before
  // the user clicks "Go to dashboard". No auto-redirect — user stays on landing.
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
      } catch {
        // silently continue
      }
    }

    establishSession();
  }, [ready, authenticated, user, getAccessToken]);

  // Signed in → always show "Go to dashboard" regardless of DASHBOARD_OPEN
  if (ready && authenticated) {
    if (variant === "outline-light") {
      return (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
        >
          Go to dashboard
        </Link>
      );
    }
    return (
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
      >
        Go to dashboard
      </Link>
    );
  }

  // Not signed in + dashboard not open → "Learn more" (no auth interaction)
  if (!DASHBOARD_OPEN) {
    if (variant === "outline-light") {
      return (
        <a
          href="#learn-more"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
        >
          Learn more
        </a>
      );
    }
    return (
      <a
        href="#learn-more"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
      >
        Learn more
      </a>
    );
  }

  // Not signed in + dashboard open → "Get started"
  if (!ready) return null;

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
