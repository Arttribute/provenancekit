"use client";

import { ProvenanceBadge } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockBundle } from "../../lib/mock-data";

export function BadgePreviewClient() {
  const variant = (typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("variant")
    : null) ?? "floating";

  return (
    <PreviewShell className="p-10 flex flex-col items-center gap-10">
      {/* Floating badge over an image */}
      <div className="flex flex-col items-center gap-3">
        <p
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--pk-muted-foreground)" }}
        >
          Floating Badge (default)
        </p>
        <ProvenanceBadge bundle={mockBundle} position="bottom-right" size="md">
          <div
            className="w-64 h-40 rounded-xl flex items-center justify-center text-sm font-medium"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.18 250 / 15%) 0%, oklch(0.52 0.2 310 / 15%) 100%)",
              border: "1px solid var(--pk-surface-border)",
              color: "var(--pk-muted-foreground)",
            }}
          >
            AI-generated image
          </div>
        </ProvenanceBadge>
      </div>

      {/* Inline badge variant */}
      <div className="flex flex-col items-center gap-3">
        <p
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--pk-muted-foreground)" }}
        >
          Inline Variant
        </p>
        <ProvenanceBadge bundle={mockBundle} variant="inline" size="sm">
          <span style={{ color: "var(--pk-foreground)", fontSize: "0.9rem" }}>
            This AI-generated poem has provenance.
          </span>
        </ProvenanceBadge>
      </div>

      {/* Size variants */}
      <div className="flex flex-col items-center gap-3">
        <p
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--pk-muted-foreground)" }}
        >
          Sizes
        </p>
        <div className="flex items-center gap-6">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <ProvenanceBadge bundle={mockBundle} size={size}>
                <div
                  className="rounded-lg"
                  style={{
                    width: size === "sm" ? 60 : size === "md" ? 80 : 100,
                    height: size === "sm" ? 60 : size === "md" ? 80 : 100,
                    background: "var(--pk-surface-muted)",
                    border: "1px solid var(--pk-surface-border)",
                  }}
                />
              </ProvenanceBadge>
              <span
                className="text-xs"
                style={{ color: "var(--pk-muted-foreground)" }}
              >
                {size}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PreviewShell>
  );
}
