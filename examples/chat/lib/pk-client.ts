import { ProvenanceKit } from "@provenancekit/sdk";

/**
 * App-level ProvenanceKit client — reads from environment variables.
 *
 * The PK API key is set once by the app developer in .env (obtained from the
 * provenancekit-app dashboard). All users of this chat app share this single
 * app-level PK project.
 *
 * The SDK points to https://api.provenancekit.com by default — no URL env var needed.
 * The key is NEVER exposed to the browser. Server-side API routes use this
 * singleton directly. Browser components use /api/pk-proxy which forwards
 * requests to the real PK API with the Authorization header added server-side.
 */

let _pkClient: ProvenanceKit | null = null;

export function getPKClient(): ProvenanceKit | null {
  if (!process.env.PK_API_KEY) {
    return null; // Provenance tracking disabled — chat still works without it
  }
  if (!_pkClient) {
    _pkClient = new ProvenanceKit({
      apiKey: process.env.PK_API_KEY,
      projectId: process.env.PK_PROJECT_ID,
    });
  }
  return _pkClient;
}

export function isPKEnabled(): boolean {
  return !!process.env.PK_API_KEY;
}
