"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProviderBase
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
      config={{
        loginMethods: ["email", "google", "github", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#0a0a0a",
          logo: "/logo.svg",
        },
        embeddedWallets: {
          createOnLogin: "off",
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
