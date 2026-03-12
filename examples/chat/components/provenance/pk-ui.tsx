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
  FileProvenanceTag,
  FileOwnershipClaim,
  ProvenanceSearch,
} from "@provenancekit/ui";
