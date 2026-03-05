"use client";

/**
 * Client-side wrapper for @provenancekit/ui's ProvenanceKitProvider.
 *
 * This file exists because @provenancekit/ui's dist bundle doesn't preserve
 * "use client" directives. By re-exporting from a "use client" file, we tell
 * Next.js App Router to treat the provider (and all its hooks) as client-side.
 *
 * The provider points at /api/pk-proxy — our Next.js proxy route that adds
 * the server-side PK_API_KEY on every request, keeping it out of the browser.
 */

export { ProvenanceKitProvider } from "@provenancekit/ui";
