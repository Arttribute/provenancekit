"use client";

import { ProvenanceSearch } from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";

export function SearchPreviewClient() {
  return (
    <PreviewShell className="p-8">
      <div className="max-w-lg mx-auto">
        <ProvenanceSearch
          mode="both"
          onResult={(r) => console.log("Selected:", r.cid)}
        />
      </div>
    </PreviewShell>
  );
}
