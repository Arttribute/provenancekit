"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const DASHBOARD_OPEN = process.env.NEXT_PUBLIC_DASHBOARD_OPEN === "true";

export function LandingCTAButton({ variant = "dark" }: { variant?: "dark" | "outline-light" }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (!DASHBOARD_OPEN || !ready || !authenticated || !user) return;

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

  // When dashboard is not yet open, always show "Learn more" — no auth interaction
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

  // Dashboard is open — auth-aware rendering
  if (!ready) return null;

  if (authenticated) {
    // Session is being established; show "Go to dashboard" as a link
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
