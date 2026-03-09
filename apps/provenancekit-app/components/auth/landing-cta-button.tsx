"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DASHBOARD_OPEN = process.env.NEXT_PUBLIC_DASHBOARD_OPEN === "true";

export function LandingCTAButton({ variant = "dark" }: { variant?: "dark" | "outline-light" }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const router = useRouter();

  // Track the previous value of `authenticated` to detect a fresh login.
  // null = Privy not ready yet; false = was unauthenticated; true = was authenticated.
  // A transition false → true means the user just logged in on this page → redirect.
  // null → true means they were already signed in when the page loaded → no redirect.
  const prevAuthRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;

    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = authenticated;

    if (!authenticated || !user) return;

    const justLoggedIn = wasAuthenticated === false;

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

        if (justLoggedIn) {
          router.replace("/dashboard");
        }
      } catch {
        // silently continue
      }
    }

    establishSession();
  }, [ready, authenticated, user, getAccessToken, router]);

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
