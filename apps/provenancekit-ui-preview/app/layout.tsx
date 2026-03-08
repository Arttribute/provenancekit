import type { Metadata } from "next";
import "./globals.css";
import { Red_Hat_Display } from "next/font/google";

const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProvenanceKit UI Preview",
  description: "Interactive component previews for @provenancekit/ui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={redHatDisplay.variable}>{children}</body>
    </html>
  );
}
