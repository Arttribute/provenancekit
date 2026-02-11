/**
 * Provenance Service
 *
 * Builds complete provenance records using @provenancekit/storage utilities.
 */

import type { ProvenanceBundle } from "@arttribute/eaa-types";
import { getBundle } from "@provenancekit/storage/utils";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";

/**
 * Build a complete provenance bundle for a resource.
 * Recursively walks upstream from a CID until depth limit or no parents.
 *
 * @param rootCid - The CID of the target resource
 * @param depth - Maximum depth to traverse (default: 10)
 * @returns ProvenanceBundle with all entities, resources, actions, and attributions
 */
export async function buildProvenance(
  rootCid: string,
  depth = 10
): Promise<ProvenanceBundle> {
  const { dbStorage } = getContext();

  const bundle = await getBundle(dbStorage, rootCid, {
    includeEntities: true,
    includeAttributions: true,
    maxDepth: depth,
  });

  if (!bundle) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${rootCid}`);
  }

  return bundle;
}
