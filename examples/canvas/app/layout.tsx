import type { Metadata } from "next";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProvenanceKitProvider } from "@/components/providers/pk-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Canvas", template: "%s | Canvas" },
  description:
    "Social content platform with onchain provenance and revenue splits powered by ProvenanceKit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PrivyProvider>
          <QueryProvider>
            {/*
              ProvenanceKitProvider sets CSS custom properties for @provenancekit/ui components.
              No apiKey here — reads go through our /api/pk/* proxy routes (keeps key server-side).
            */}
            <ProvenanceKitProvider
              theme={{
                nodeResourceColor: "#3b82f6",
                nodeActionColor: "#8b5cf6",
                nodeEntityColor: "#10b981",
                verifiedColor: "#16a34a",
                partialColor: "#d97706",
                failedColor: "#dc2626",
                badgeBg: "#16a34a",
                badgeFg: "#ffffff",
                radius: "0.5rem",
              }}
            >
              {children}
            </ProvenanceKitProvider>
          </QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
