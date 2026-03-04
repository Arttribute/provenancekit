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

  const bundle = await getBundle(dbStorage, cid, {
    includeEntities: true,
    includeAttributions: true,
    maxDepth: 10,
  });

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
