"use client";

import { PrivyProvider as PrivyBase } from "@privy-io/react-auth";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyBase
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
      config={{
        loginMethods: ["email", "google", "github", "wallet"],
        appearance: { theme: "light", accentColor: "#0a0a0a" },
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      {children}
    </PrivyBase>
  );
}
