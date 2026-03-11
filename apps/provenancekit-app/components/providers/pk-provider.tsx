"use client";

/**
 * Client-side wrapper for @provenancekit/ui's ProvenanceKitProvider.
 *
 * Points at /api/pk-proxy — a Next.js proxy route that adds
 * Authorization: Bearer PROVENANCEKIT_API_KEY server-side, keeping the
 * secret out of the browser. All @provenancekit/ui hooks
 * (useProvenanceBundle, useProvenanceGraph, useSessionProvenance) and
 * interactive components (ProvenanceGraph, ProvenanceBundleView,
 * ProvenanceSearch, FileUploadZone) call transparently through this proxy.
 */

export { ProvenanceKitProvider } from "@provenancekit/ui";
