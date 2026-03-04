import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "@/components/ui/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProvenanceKit",
    template: "%s | ProvenanceKit",
  },
  description:
    "Universal provenance management for Human-AI created works. Track, verify, and monetize attribution at scale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <QueryProvider>{children}</QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
