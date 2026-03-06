/**
 * Server-side ProvenanceKit client factory.
 * The SDK defaults to https://api.provenancekit.com — no URL env var needed.
 * Only import in Server Components or API route handlers, never client-side.
 */
import { ProvenanceKit } from "@provenancekit/sdk";

export function createPK(): ProvenanceKit {
  return new ProvenanceKit({
    apiKey: process.env.PROVENANCEKIT_API_KEY,
  });
}
