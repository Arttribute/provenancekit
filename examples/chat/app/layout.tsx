import type { Metadata } from "next";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProvenanceKitProvider } from "@/components/providers/pk-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PK Chat", template: "%s | PK Chat" },
  description:
    "AI chat with built-in provenance tracking powered by ProvenanceKit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PrivyProvider>
          <QueryProvider>
            {/*
             * ProvenanceKitProvider points at /api/pk-proxy — our Next.js proxy route.
             * The proxy adds Authorization: Bearer PK_API_KEY server-side, keeping
             * the secret out of the browser. All @provenancekit/ui hooks
             * (useProvenanceBundle, useProvenanceGraph, useSessionProvenance)
             * transparently call through this proxy.
             */}
            <ProvenanceKitProvider apiUrl="/api/pk-proxy" apiKey="">
              {children}
            </ProvenanceKitProvider>
          </QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
