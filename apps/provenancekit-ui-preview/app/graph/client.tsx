"use client";

import { ProvenanceGraph } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockNodes, mockEdges } from "../../lib/mock-data";

export function GraphPreviewClient() {
  return (
    <PreviewShell className="p-6">
      <ProvenanceGraph
        nodes={mockNodes}
        edges={mockEdges}
        height={460}
        showControls
        showLegend
        draggable
      />
    </PreviewShell>
  );
}
