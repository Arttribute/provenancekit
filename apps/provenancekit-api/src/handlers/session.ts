/**
 * Session Provenance Handler
 *
 * Query provenance records linked to an app-managed session.
 *
 * Sessions are managed by the consuming application (in its own DB).
 * The provenance API stores a sessionId as an extension on actions
 * and resources, allowing apps to query all provenance for a session.
 */

import { Hono } from "hono";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/**
 * GET /session/:id/provenance?projectId=...
 *
 * Returns all actions, resources, and entities linked to a session ID.
 * The sessionId (and optional projectId) are stored as extensions on
 * actions and resources when created via POST /activity.
 *
 * Query params:
 *   projectId - Required when multiple apps share the same API.
 *               Prevents session ID collisions across apps.
 */
r.get("/session/:id/provenance", async (c) => {
  const sessionId = c.req.param("id");
  if (!sessionId) {
    throw new ProvenanceKitError("MissingField", "session id required");
  }

  const projectId = c.req.query("projectId");

  const { supabase, dbStorage } = getContext();

  // Build the extensions filter — always includes sessionId,
  // and includes projectId when provided (for multi-tenant isolation)
  const extensionsFilter: Record<string, string> = { sessionId };
  if (projectId) {
    extensionsFilter.projectId = projectId;
  }

  // Query actions that match the extensions filter
  const { data: actionRows, error: actionsErr } = await supabase
    .from("pk_action")
    .select("*")
    .contains("extensions", extensionsFilter);

  if (actionsErr) {
    throw new ProvenanceKitError("Internal", `Failed to query actions: ${actionsErr.message}`);
  }

  // Query resources that match the extensions filter
  const { data: resourceRows, error: resourcesErr } = await supabase
    .from("pk_resource")
    .select("*")
    .contains("extensions", extensionsFilter);

  if (resourcesErr) {
    throw new ProvenanceKitError("Internal", `Failed to query resources: ${resourcesErr.message}`);
  }

  // Collect unique entity IDs from actions and resources
  const entityIds = new Set<string>();
  for (const row of actionRows ?? []) {
    if (row.performed_by) entityIds.add(row.performed_by);
  }
  for (const row of resourceRows ?? []) {
    if (row.created_by) entityIds.add(row.created_by);
  }

  // Fetch entities
  const entities = [];
  for (const id of entityIds) {
    const entity = await dbStorage.getEntity(id);
    if (entity) entities.push(entity);
  }

  // Collect attributions for these resources
  const attributions = [];
  for (const row of resourceRows ?? []) {
    const ref = row.ref;
    if (ref) {
      const attrs = await dbStorage.getAttributionsByResource(ref);
      attributions.push(...attrs);
    }
  }

  // Map action rows to Action shape
  const actions = (actionRows ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as string,
    performedBy: row.performed_by as string,
    timestamp: row.timestamp as string,
    inputs: (row.inputs as unknown[]) ?? [],
    outputs: (row.outputs as unknown[]) ?? [],
    proof: (row.proof as string) ?? undefined,
    extensions: (row.extensions as Record<string, unknown>) ?? undefined,
  }));

  // Map resource rows to Resource shape
  const resources = (resourceRows ?? []).map((row: Record<string, unknown>) => ({
    address: row.address as { ref: string; scheme: string },
    type: (row.type as string) ?? undefined,
    locations: (row.locations as unknown[]) ?? [],
    createdAt: row.created_at as string,
    createdBy: row.created_by as string,
    rootAction: (row.root_action as string) ?? undefined,
    extensions: (row.extensions as Record<string, unknown>) ?? undefined,
  }));

  return c.json({
    sessionId,
    actions,
    resources,
    entities,
    attributions,
    summary: {
      actions: actions.length,
      resources: resources.length,
      entities: entities.length,
      attributions: attributions.length,
    },
  });
});

export default r;
