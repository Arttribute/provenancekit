"use client";

import { ProvenanceBadge } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockBundle } from "../../lib/mock-data";

function Label({ children }: { children: string }) {
  return (
    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--pk-muted-foreground)" }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--pk-surface-border)", margin: "4px 0" }} />;
}

export function BadgePreviewClient() {
  return (
    <PreviewShell className="p-10 flex flex-col items-center gap-10">

      {/* ── AI-generated image — primary use case ── */}
      <div className="flex flex-col items-center w-full max-w-xl">
        <Label>AI-generated image — click "Pr" to inspect provenance</Label>
        <div className="flex items-start justify-center gap-10 flex-wrap">

          {/* Real photographic image */}
          <div className="flex flex-col items-center gap-2">
            <ProvenanceBadge bundle={mockBundle} position="bottom-right" size="md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://picsum.photos/seed/illustrateddigest/320/200"
                alt="AI-generated header image for The Illustrated Article"
                style={{
                  width: 264,
                  height: 166,
                  objectFit: "cover",
                  borderRadius: 12,
                  display: "block",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                }}
              />
            </ProvenanceBadge>
            <span style={{ fontSize: 11, color: "var(--pk-muted-foreground)" }}>
              bottom-right (default)
            </span>
          </div>

          {/* Second image — top-left position */}
          <div className="flex flex-col items-center gap-2">
            <ProvenanceBadge bundle={mockBundle} position="top-left" size="md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://picsum.photos/seed/researchreport/320/200"
                alt="AI-generated research report cover"
                style={{
                  width: 264,
                  height: 166,
                  objectFit: "cover",
                  borderRadius: 12,
                  display: "block",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                }}
              />
            </ProvenanceBadge>
            <span style={{ fontSize: 11, color: "var(--pk-muted-foreground)" }}>
              top-left
            </span>
          </div>
        </div>

        <p style={{ marginTop: 14, fontSize: 12, color: "var(--pk-muted-foreground)", textAlign: "center", maxWidth: 440, lineHeight: 1.6 }}>
          Clicking "Pr" reveals the full provenance card: who created it, which AI tools were used,
          the license, and verification status — all from the bundle attached to the content.
        </p>
      </div>

      <Divider />

      {/* ── Inline variant — article byline ── */}
      <div className="flex flex-col items-center w-full max-w-xl">
        <Label>Inline variant — article byline &amp; chat messages</Label>
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            borderRadius: 12,
            border: "1px solid var(--pk-surface-border)",
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* Simulated article header image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://picsum.photos/seed/articleheader/920/360"
            alt="Article header"
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
          />

          {/* Article body */}
          <div style={{ padding: "16px 20px", background: "var(--pk-surface)" }}>
            {/* Byline with inline badge */}
            <ProvenanceBadge bundle={mockBundle} variant="inline" size="sm">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pk-muted-foreground)" }}>
                By Sarah Kim · Illustrated Digest · Mar 7, 2026
              </span>
            </ProvenanceBadge>

            <h3 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 800, color: "var(--pk-foreground)", lineHeight: 1.3 }}>
              The Future of Human–AI Authorship
            </h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--pk-muted-foreground)" }}>
              The boundaries between human authorship and machine generation are blurring
              faster than our legal frameworks can adapt. Content Credentials offer a path
              toward verifiable provenance at scale…
            </p>
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Size reference ── */}
      <div className="flex flex-col items-center">
        <Label>Sizes — sm (22px) · md (28px) · lg (38px)</Label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <ProvenanceBadge bundle={mockBundle} size={size} position="bottom-right">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://picsum.photos/seed/size${size}/120/120`}
                  alt={`size ${size} example`}
                  style={{
                    width: size === "sm" ? 64 : size === "md" ? 88 : 112,
                    height: size === "sm" ? 64 : size === "md" ? 88 : 112,
                    objectFit: "cover",
                    borderRadius: 10,
                    display: "block",
                  }}
                />
              </ProvenanceBadge>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pk-muted-foreground)" }}>{size}</span>
            </div>
          ))}
        </div>
      </div>

    </PreviewShell>
  );
}
