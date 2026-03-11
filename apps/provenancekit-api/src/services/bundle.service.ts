/**
 * Bundle Service
 *
 * Provenance bundle operations using @provenancekit/storage utilities.
 */

import type { ProvenanceBundle } from "@provenancekit/eaa-types";
import { getBundle, storeBundle } from "@provenancekit/storage/utils";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";

/**
 * Fetch a provenance bundle for a resource.
 * Includes the resource and its complete lineage.
 */
export async function fetchBundle(cid: string): Promise<ProvenanceBundle> {
  const { dbStorage } = getContext();

  let bundle: ProvenanceBundle | null;
  try {
    bundle = await getBundle(dbStorage, cid, {
      includeEntities: true,
      includeAttributions: true,
      maxDepth: 10,
    });
  } catch (err) {
    if (err instanceof ProvenanceKitError) throw err;
    // Storage query error — log the real cause for ops and surface a clear message.
    // Most common: resource is still being recorded (on-chain takes 20-30 s) or a
    // Supabase index is missing (run the latest migration SQL to fix).
    console.error("[bundle] Storage error for CID", cid, "—", err instanceof Error ? err.message : err);
    throw new ProvenanceKitError("NotFound", `Resource not found or still recording: ${cid}`, {
      recovery: "Wait a few seconds and retry — on-chain recording can take 20-30 s. If the error persists, check that all DB migrations have been applied.",
    });
  }

  if (!bundle) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${cid}`);
  }

  return bundle;
}

/**
 * Ingest an external provenance bundle.
 * Stores all entities, resources, actions, and attributions.
 */
export async function ingestBundle(bundle: ProvenanceBundle): Promise<void> {
  const { dbStorage } = getContext();

  await storeBundle(dbStorage, bundle, {
    skipExistingEntities: false, // upsert entities
    skipExistingResources: true, // skip existing resources
    useTransaction: true,
  });
}
