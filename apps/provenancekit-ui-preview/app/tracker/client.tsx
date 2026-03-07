"use client";

import { ProvenanceTracker } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockSession } from "../../lib/mock-data";

export function TrackerPreviewClient() {
  return (
    <PreviewShell className="p-6">
      <ProvenanceTracker session={mockSession} />
    </PreviewShell>
  );
}
