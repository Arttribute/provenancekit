/**
 * Resource Service
 *
 * Resource operations using @provenancekit/storage.
 * Note: Resource creation is primarily handled by activity.service.
 */

import type { Resource } from "@arttribute/eaa-types";
import { getContext } from "../context.js";

/**
 * Get a resource by its CID.
 */
export async function getResource(cid: string): Promise<Resource | null> {
  const { dbStorage } = getContext();
  return dbStorage.getResource(cid);
}

/**
 * Check if a resource exists.
 */
export async function resourceExists(cid: string): Promise<boolean> {
  const { dbStorage } = getContext();
  return dbStorage.resourceExists(cid);
}

/**
 * List resources with optional filters.
 */
export async function listResources(filter?: {
  type?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}): Promise<Resource[]> {
  const { dbStorage } = getContext();
  return dbStorage.listResources(filter);
}
