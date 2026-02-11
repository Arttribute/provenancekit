/**
 * Entity Handler
 *
 * REST API endpoints for entity management.
 * Supports AI agent extensions.
 */

import { Hono } from "hono";
import {
  upsertEntity,
  getEntity,
  listEntities,
  checkIsAIAgent,
  getAIAgentData,
  type CreateEntityInput,
} from "../services/entity.service.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/**
 * POST /entity
 * Create or update an entity.
 *
 * Body: {
 *   id?: string,
 *   role: string,
 *   name?: string,
 *   wallet?: string,
 *   publicKey?: string,
 *   metadata?: object,
 *   aiAgent?: { model: { provider, model, version? }, delegatedBy?, autonomyLevel?, ... }
 * }
 */
r.post("/entity", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as CreateEntityInput;

  if (typeof body.role !== "string" || !body.role.trim()) {
    throw new ProvenanceKitError(
      "MissingField",
      "`role` is required for entity",
      {
        recovery: "Provide role: human | ai | organization | ext:*",
      }
    );
  }

  // Validate AI agent config if role is "ai"
  if (body.role === "ai" && body.aiAgent) {
    if (!body.aiAgent.model?.provider || !body.aiAgent.model?.model) {
      throw new ProvenanceKitError(
        "MissingField",
        "AI agent requires model.provider and model.model",
        {
          recovery: "Provide aiAgent.model.provider and aiAgent.model.model",
        }
      );
    }
  }

  try {
    const result = await upsertEntity(body);
    return c.json(result, 201);
  } catch (e) {
    throw new ProvenanceKitError("Internal", "Failed to upsert entity", {
      details: e,
    });
  }
});

/**
 * GET /entity/:id
 * Get an entity by ID.
 */
r.get("/entity/:id", async (c) => {
  const id = c.req.param("id");

  const entity = await getEntity(id);
  if (!entity) {
    throw new ProvenanceKitError("NotFound", `Entity not found: ${id}`);
  }

  // Include AI agent info if applicable
  const isAgent = await checkIsAIAgent(id);
  const agentData = isAgent ? await getAIAgentData(id) : null;

  return c.json({
    entity,
    isAIAgent: isAgent,
    aiAgent: agentData,
  });
});

/**
 * GET /entities
 * List entities with optional filtering.
 *
 * Query params:
 *   role?: string - Filter by role
 *   limit?: number - Limit results (default: 50)
 *   offset?: number - Offset for pagination
 */
r.get("/entities", async (c) => {
  const role = c.req.query("role");
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");

  const entities = await listEntities({
    role: role ?? undefined,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });

  return c.json({ entities, count: entities.length });
});

/**
 * GET /entity/:id/ai-agent
 * Get AI agent extension data for an entity.
 */
r.get("/entity/:id/ai-agent", async (c) => {
  const id = c.req.param("id");

  const entity = await getEntity(id);
  if (!entity) {
    throw new ProvenanceKitError("NotFound", `Entity not found: ${id}`);
  }

  const isAgent = await checkIsAIAgent(id);
  if (!isAgent) {
    throw new ProvenanceKitError(
      "Unsupported",
      "Entity is not an AI agent",
      {
        recovery: "This entity does not have AI agent extensions",
      }
    );
  }

  const agentData = await getAIAgentData(id);
  return c.json({ agentData });
});

export default r;
