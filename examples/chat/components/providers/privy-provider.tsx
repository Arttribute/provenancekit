"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>;
  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        loginMethods: ["email", "google", "github", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#0a0a0a",
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
