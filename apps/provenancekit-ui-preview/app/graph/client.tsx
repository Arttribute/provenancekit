"use client";

import { useState } from "react";
import { ProvenanceGraph } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockNodes, mockEdges } from "../../lib/mock-data";

export function GraphPreviewClient() {
  const [darkCanvas, setDarkCanvas] = useState(false);

  return (
    <PreviewShell className="p-6 space-y-4">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--pk-muted-foreground)" }}>
            Provenance Graph — "The Illustrated Article"
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--pk-muted-foreground)", lineHeight: 1.5 }}>
            Sarah Kim writes a draft → Flux Schnell generates the header image →
            Claude Opus polishes the text → editorial team verifies and publishes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDarkCanvas((v) => !v)}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            background: "var(--pk-surface-muted)",
            border: "1px solid var(--pk-surface-border)",
            color: "var(--pk-foreground)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {darkCanvas ? "☀ Light" : "☾ Dark"}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { color: "#3b82f6", label: "Resource (file / artifact)" },
          { color: "#22c55e", label: "Action (create / transform / verify)" },
          { color: "#f59e0b", label: "Entity (human / AI / org)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--pk-muted-foreground)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* Graph canvas */}
      <div className={darkCanvas ? "dark" : ""}>
        <ProvenanceGraph
          nodes={mockNodes}
          edges={mockEdges}
          height={460}
        />
      </div>
    </PreviewShell>
  );
}
