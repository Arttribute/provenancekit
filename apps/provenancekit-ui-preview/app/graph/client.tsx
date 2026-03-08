"use client";

import { useState } from "react";
import { ProvenanceGraph } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockNodes, mockEdges } from "../../lib/mock-data";

export function GraphPreviewClient() {
  const [darkCanvas, setDarkCanvas] = useState(false);

  return (
    <PreviewShell className="p-6 space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pk-muted-foreground)" }}>
          ProvenanceGraph — drag nodes · scroll to zoom · click to expand
        </p>
        <button
          type="button"
          onClick={() => setDarkCanvas((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--pk-surface-muted)",
            border: "1px solid var(--pk-surface-border)",
            color: "var(--pk-foreground)",
          }}
        >
          {darkCanvas ? "☀ Light mode" : "☾ Dark mode"}
        </button>
      </div>

      {/* Graph in its own theme scope */}
      <div className={darkCanvas ? "dark" : ""}>
        <ProvenanceGraph
          nodes={mockNodes}
          edges={mockEdges}
          height={480}
        />
      </div>
    </PreviewShell>
  );
}
