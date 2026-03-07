"use client";

import { ProvenanceBundleView } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockBundle } from "../../lib/mock-data";

export function BundlePreviewClient() {
  return (
    <PreviewShell className="p-6">
      <ProvenanceBundleView
        bundle={mockBundle}
        showEntities
        showActions
        showResources
        showAttributions
      />
    </PreviewShell>
  );
}
