import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProvenanceKit UI Preview",
  description: "Interactive component previews for @provenancekit/ui",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
