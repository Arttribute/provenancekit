import type { Metadata } from "next";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { QueryProvider } from "@/components/ui/query-provider";
import "./globals.css";
import { Fragment_Mono } from "next/font/google";

const fragmentMono = Fragment_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-fragment-mono",
  display: "swap",
});

const baseUrl = "https://provenancekit.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "ProvenanceKit",
    template: "%s | ProvenanceKit",
  },
  description:
    "Verifiable records of how it was made. A toolkit for creators and platforms to record and communicate how content was created, building transparency and trust with audiences.",
  keywords: [
    "provenance",
    "AI provenance",
    "content attribution",
    "Human-AI",
    "content labeling",
    "onchain attribution",
    "C2PA",
    "EAA",
  ],
  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: "ProvenanceKit",
    title: "ProvenanceKit — Verifiable records of how it was made.",
    description:
      "A toolkit for creators and platforms to record and communicate how content was created, building transparency and trust with audiences.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@provenancekit",
    creator: "@provenancekit",
    title: "ProvenanceKit — Verifiable records of how it was made.",
    description:
      "A toolkit for creators and platforms to record and communicate how content was created, building transparency and trust with audiences.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={fragmentMono.variable}>
      <body>
        <PrivyProvider>
          <QueryProvider>{children}</QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
