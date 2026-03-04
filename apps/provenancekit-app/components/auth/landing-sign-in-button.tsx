"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function LandingSignInButton() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const router = useRouter();

  // After Privy login, exchange token for session cookie then go to dashboard
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
    return (
      <Button size="sm" disabled>
        <span className="h-3.5 w-3.5 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading…
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={() => login()}>
      Sign in
    </Button>
  );
}
