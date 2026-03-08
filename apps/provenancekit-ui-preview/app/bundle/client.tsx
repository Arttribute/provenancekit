"use client";

import { ProvenanceBundleView } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockBundle } from "../../lib/mock-data";

export function BundlePreviewClient() {
  return (
    <PreviewShell className="p-6 space-y-4">
      {/* Context header */}
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--pk-muted-foreground)" }}>
          Bundle View — "The Illustrated Article"
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--pk-muted-foreground)", lineHeight: 1.5 }}>
          4 contributors (Sarah Kim · Illustrated Digest · Claude Opus 4.6 · Flux Schnell) · 4 actions ·
          4 resources · CC-BY-4.0 · editorially verified.
          Switch tabs to explore each layer of provenance.
        </p>
      </div>
      <ProvenanceBundleView
        bundle={mockBundle}
        showEntities
        showActions
        showResources
        showAttributions
        showGraph
        graphHeight={300}
      />
    </PreviewShell>
  );
}
