/**
 * Server-side ProvenanceKit client factory.
 * Returns a configured SDK instance — only import in Server Components
 * or API route handlers, never in client-side code.
 */
import { ProvenanceKit } from "@provenancekit/sdk";

export function createPK(): ProvenanceKit {
  return new ProvenanceKit({
    baseUrl: process.env.PROVENANCEKIT_API_URL ?? "http://localhost:3001",
    apiKey: process.env.PROVENANCEKIT_API_KEY,
  });
}
