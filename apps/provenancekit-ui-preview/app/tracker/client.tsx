"use client";

import { ProvenanceTracker } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";
import { mockSession } from "../../lib/mock-data";

export function TrackerPreviewClient() {
  return (
    <PreviewShell className="p-6 space-y-4">
      {/* Context header */}
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--pk-muted-foreground)" }}>
          Live Session — "AI Research Workflow"
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--pk-muted-foreground)", lineHeight: 1.5 }}>
          Sarah uploads sources → AI synthesises and drafts → AI generates a chart →
          Sarah revises → AI finalises with verification. Each step recorded in real time.
        </p>
      </div>

      <ProvenanceTracker session={mockSession} />

      <p style={{ margin: 0, fontSize: 11, color: "var(--pk-muted-foreground)", lineHeight: 1.5 }}>
        In production, pass <code style={{ fontFamily: "monospace", fontSize: 11, background: "var(--pk-surface-muted)", padding: "1px 5px", borderRadius: 4 }}>sessionId</code> and
        the component polls for new actions automatically every <code style={{ fontFamily: "monospace", fontSize: 11, background: "var(--pk-surface-muted)", padding: "1px 5px", borderRadius: 4 }}>pollInterval</code> ms.
      </p>
    </PreviewShell>
  );
}
