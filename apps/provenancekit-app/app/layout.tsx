import type { Metadata } from "next";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { QueryProvider } from "@/components/ui/query-provider";
import "./globals.css";
//import Fragment Mono from google
import { Fragment_Mono } from "next/font/google";

const fragmentMono = Fragment_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fragment-mono",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning className={fragmentMono.className}>
      <body>
        <PrivyProvider>
          <QueryProvider>{children}</QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
