"use client";

/**
 * Re-exports of @provenancekit/ui share components.
 *
 * The built dist/index.js strips "use client" directives, so these
 * components must be re-exported through a client boundary wrapper.
 */
export {
  ProvenanceDocument,
  RedactedItem,
  ShareModal,
  type ShareData,
  type RedactedMarker,
  type MaybeRedactedAction,
  type MaybeRedactedResource,
  type MaybeRedactedEntity,
  type ShareConfig,
  type RedactionConfig,
} from "@provenancekit/ui";
