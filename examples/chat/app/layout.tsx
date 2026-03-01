import type { Metadata } from "next";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Chat", template: "%s | PK Chat" },
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
          <QueryProvider>{children}</QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
