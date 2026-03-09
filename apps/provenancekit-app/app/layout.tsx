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
    default:
      "ProvenanceKit — Open Source Content Provenance toolkit for Human-AI Works",
    template: "%s | ProvenanceKit",
  },
  description:
    "Open-source toolkit for Human-AI content provenance. Record, verify, and communicate how content was created — onchain anchoring, C2PA support, and programmable attribution.",
  keywords: [
    "content provenance",
    "AI provenance",
    "Human-AI content",
    "provenance toolkit",
    "content attribution",
    "AI attribution",
    "onchain provenance",
    "C2PA",
    "EAA",
    "content transparency",
    "AI disclosure",
    "open source provenance",
  ],
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: "ProvenanceKit",
    title:
      "ProvenanceKit — Open Source Content Provenance Toolkit for Human-AI Works",
    description:
      "Record, verify, and communicate how Human-AI content was created. Onchain anchoring, C2PA support, privacy extensions, and programmable attribution — open source.",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ProvenanceKit — Content Provenance for Human-AI Works",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@provenancekit",
    creator: "@provenancekit",
    title:
      "ProvenanceKit — Open Source Content Provenance Toolkit for Human-AI Works",
    description:
      "Record, verify, and communicate how Human-AI content was created. Onchain anchoring, C2PA support, and programmable attribution — open source.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
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
