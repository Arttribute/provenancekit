"use client";

import Link from "next/link";
import { ProvenanceDocument } from "@/components/provenance/share-components";
import type { ShareData } from "@/components/provenance/share-components";

interface ShareViewerProps {
  share: ShareData;
}

/**
 * Client wrapper for the public share viewer page.
 * Renders ProvenanceDocument inside a minimal page layout —
 * no dashboard chrome, no auth required.
 */
export function ShareViewer({ share }: ShareViewerProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Minimal top bar */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="https://provenancekit.com"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "28%",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              Pr
            </span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>ProvenanceKit</span>
        </Link>

        <span style={{ color: "#e2e8f0", fontSize: 14 }}>/</span>
        <span style={{ fontSize: 12, color: "#64748b" }}>Shared Provenance Record</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 64px" }}>
        <ProvenanceDocument share={share} graphHeight={520} />

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Secured and shared via{" "}
            <Link href="https://provenancekit.com" style={{ color: "#64748b", fontWeight: 600 }}>
              ProvenanceKit
            </Link>
            {share.viewCount > 0 && ` · ${share.viewCount} view${share.viewCount !== 1 ? "s" : ""}`}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Share ID: <code style={{ fontFamily: "monospace", fontSize: 10 }}>{share.shareId}</code>
          </span>
        </div>
      </div>
    </div>
  );
}
