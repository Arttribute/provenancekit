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
  const { dbStorage } = getContext();

  // Build the extensions filter using the namespaced key
  // that matches how activity.service.ts stores session context
  const sessionData: Record<string, string> = { sessionId };
  if (projectId) {
    sessionData.projectId = projectId;
  }
  const extensionsFilter = { "ext:session@1.0.0": sessionData };

  // Query actions and resources via storage interface
  const actions = await dbStorage.listActions({ extensions: extensionsFilter });
  const resources = await dbStorage.listResources({ extensions: extensionsFilter });

  // Collect unique entity IDs from actions and resources
  const entityIds = new Set<string>();
  for (const action of actions) {
    if (action.performedBy) entityIds.add(action.performedBy);
  }
  for (const resource of resources) {
    if (resource.createdBy) entityIds.add(resource.createdBy);
  }

  // Fetch entities
  const entities = [];
  for (const id of entityIds) {
    const entity = await dbStorage.getEntity(id);
    if (entity) entities.push(entity);
  }

  // Collect attributions for these resources
  const attributions = [];
  for (const resource of resources) {
    const ref = resource.address?.ref;
    if (ref) {
      const attrs = await dbStorage.getAttributionsByResource(ref);
      attributions.push(...attrs);
    }
  }

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
