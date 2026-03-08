"use client";

import { ProvenanceBundleView } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockBundle } from "../../lib/mock-data";

export function BundlePreviewClient() {
  return (
    <PreviewShell className="p-6 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest pb-2" style={{ color: "var(--pk-muted-foreground)" }}>
        ProvenanceBundleView — tabbed layout
      </p>
      <ProvenanceBundleView
        bundle={mockBundle}
        showEntities
        showActions
        showResources
        showAttributions
        showGraph
        graphHeight={340}
      />
    </PreviewShell>
  );
}
