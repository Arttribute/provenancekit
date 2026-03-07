"use client";

/**
 * Client-side re-exports of @provenancekit/ui components.
 * Required because the dist bundle doesn't preserve "use client" directives.
 */

export {
  ProvenanceBadge,
  ProvenanceBundleView,
  ProvenanceGraph,
  ProvenanceTracker,
  ProvenancePopover,
  AIExtensionView,
} from "@provenancekit/ui";

// Local copy — will import from "@provenancekit/ui" once FileProvenanceTag is published (>= 0.2.0)
export { FileProvenanceTag } from "./file-provenance-tag";
