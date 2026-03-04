/**
 * ProvenanceKit client factory for the chat example.
 *
 * Uses the official @provenancekit/sdk — no raw API fetch calls.
 * The SDK is the single abstraction over the PK API.
 */

import { ProvenanceKit } from "@provenancekit/sdk";
import type { ProvenanceKitConfig } from "@/types";

export type { ProvenanceKitConfig };

/** Create a configured SDK instance from user-supplied settings. */
export function createPKClient(
  config: Pick<ProvenanceKitConfig, "apiKey" | "apiUrl">
): ProvenanceKit {
  return new ProvenanceKit({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
  });
}
