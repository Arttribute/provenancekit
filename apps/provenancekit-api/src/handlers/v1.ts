/**
 * V1 API Compatibility Layer
 *
 * Mounts versioned REST endpoints (/v1/*) that example apps and external
 * clients use. These routes normalise incoming shapes and delegate to the
 * same services as the unversioned handlers.
 *
 * Mapped endpoints:
 *   POST /v1/entities               → upsert entity
 *   POST /v1/actions                → record action (JSON, no file upload)
 *   POST /v1/resources/upload       → upload resource to IPFS
 *   GET  /v1/resources/:cid/bundle  → provenance bundle
 *   GET  /v1/resources/:cid/distribution → revenue distribution
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { cidRef } from "@provenancekit/eaa-types";
import type { ContentReference } from "@provenancekit/eaa-types";
import {
  upsertEntity,
  type CreateEntityInput,
} from "../services/entity.service.js";
import { fetchBundle } from "../services/bundle.service.js";
import { ProvenanceKitError } from "../errors.js";
import { getContext } from "../context.js";

const r = new Hono();

// ---------------------------------------------------------------------------
// POST /v1/entities
// Body: { name?, type, isAIAgent?, provider?, model? }
//   or: CreateEntityInput (role, name, aiAgent, etc.)
//
// Normalises the "type + isAIAgent + provider + model" shape used by the
// example apps into the canonical CreateEntityInput shape used internally.
// ---------------------------------------------------------------------------
r.post("/entities", async (c) => {
  const raw = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  // Normalise: type → role; isAIAgent + provider + model → aiAgent extension
  const input: CreateEntityInput = {
    id: raw.id as string | undefined,
    role: (raw.role ?? raw.type ?? "human") as string,
    name: raw.name as string | undefined,
    wallet: raw.wallet as string | undefined,
    publicKey: raw.publicKey as string | undefined,
    metadata: raw.metadata as Record<string, unknown> | undefined,
  };

  if (
    input.role === "ai" &&
    (raw.isAIAgent || raw.provider || raw.model)
  ) {
    input.aiAgent = {
      model: {
        provider: (raw.provider as string) ?? "unknown",
        model: (raw.model as string) ?? "unknown",
        version: raw.version as string | undefined,
      },
      delegatedBy: raw.delegatedBy as string | undefined,
      autonomyLevel: raw.autonomyLevel as CreateEntityInput["aiAgent"] extends object
        ? CreateEntityInput["aiAgent"]["autonomyLevel"]
        : undefined,
    };
  }

  if (!input.role.trim()) {
    throw new ProvenanceKitError("MissingField", "`role` or `type` is required");
  }

  const result = await upsertEntity(input);
  return c.json({ id: result.id }, 201);
});

// ---------------------------------------------------------------------------
// POST /v1/actions
// Body: {
//   type: string,
//   performedBy: string,           // entity ID of primary performer
//   requestedBy?: string,          // entity ID of requester (optional second performer)
//   inputs: ContentReference[],
//   outputs: ContentReference[],
//   extensions?: Record<string, unknown>,
//   attributions?: Array<{ entityId, role }>,
// }
//
// Records an action against already-existing CIDs (no file upload).
// Returns: { action: { id: string }, resource: { cid: string } }
// ---------------------------------------------------------------------------
r.post("/actions", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    type?: string;
    performedBy?: string;
    requestedBy?: string;
    inputs?: ContentReference[];
    outputs?: ContentReference[];
    extensions?: Record<string, unknown>;
    note?: string;
  };

  if (!body.performedBy) {
    throw new ProvenanceKitError("MissingField", "`performedBy` is required");
  }

  const { dbStorage } = getContext();

  // Ensure the entity exists
  const entity = await dbStorage.getEntity(body.performedBy).catch(() => null);
  if (!entity) {
    throw new ProvenanceKitError(
      "NotFound",
      `Entity not found: ${body.performedBy}`,
      { recovery: "Register the entity via POST /v1/entities first" }
    );
  }

  const actionId = uuidv4();
  const now = new Date().toISOString();
  const inputs = body.inputs ?? [];
  const outputs = body.outputs ?? [];

  const action = {
    id: actionId,
    type: body.type ?? "create",
    performedBy: body.performedBy,
    inputs,
    outputs,
    timestamp: now,
    extensions: body.extensions,
    ...(body.note && { note: body.note }),
  };

  await dbStorage.saveAction(action as Parameters<typeof dbStorage.saveAction>[0]);

  // Record attribution for the primary performer
  const performerAttribution = {
    entityId: body.performedBy,
    actionId,
    role: "creator" as const,
    timestamp: now,
  };
  await dbStorage.saveAttribution(performerAttribution as Parameters<typeof dbStorage.saveAttribution>[0]);

  // Record attribution for the requester (if different)
  if (body.requestedBy && body.requestedBy !== body.performedBy) {
    const requesterAttribution = {
      entityId: body.requestedBy,
      actionId,
      role: "contributor" as const,
      timestamp: now,
    };
    await dbStorage.saveAttribution(requesterAttribution as Parameters<typeof dbStorage.saveAttribution>[0]);
  }

  // For outputs that look like CIDs, ensure a resource record exists
  const primaryOutput = outputs[0];
  const primaryCid = primaryOutput
    ? "ref" in primaryOutput
      ? (primaryOutput as { ref: string }).ref
      : String(primaryOutput)
    : actionId;

  return c.json(
    {
      action: { id: actionId },
      resource: { cid: primaryCid },
    },
    201
  );
});

// ---------------------------------------------------------------------------
// POST /v1/resources/upload
// Multipart: file=<binary>
// Returns: { cid: string }
// ---------------------------------------------------------------------------
r.post("/resources/upload", async (c) => {
  const { fileStorage } = getContext();
  const form = await c.req.parseBody();

  if (!(form.file instanceof File)) {
    throw new ProvenanceKitError("MissingField", "`file` part is required");
  }

  const buffer = Buffer.from(await form.file.arrayBuffer());
  const cid = await fileStorage.upload(buffer, {
    mimeType: form.file.type || "application/octet-stream",
    filename: form.file.name || "upload",
  });

  return c.json({ cid }, 201);
});

// ---------------------------------------------------------------------------
// GET /v1/resources/:cid/bundle
// Delegates to bundle service
// ---------------------------------------------------------------------------
r.get("/resources/:cid/bundle", async (c) => {
  const cid = c.req.param("cid");
  const bundle = await fetchBundle(cid);
  return c.json(bundle);
});

// ---------------------------------------------------------------------------
// GET /v1/resources/:cid/distribution
// Computes revenue distribution by walking the provenance graph
// ---------------------------------------------------------------------------
r.get("/resources/:cid/distribution", async (c) => {
  const cid = c.req.param("cid");
  const { dbStorage } = getContext();

  const resource = await dbStorage.getResource(cid).catch(() => null);
  if (!resource) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${cid}`);
  }

  const attributions = await dbStorage.getAttributionsByResource(cid);

  // Build distribution as basis-point shares
  const byEntity: Record<string, number> = {};
  for (const attr of attributions) {
    const entityId = attr.entityId ?? attr.performedBy;
    if (entityId) {
      byEntity[entityId] = (byEntity[entityId] ?? 0) + 1;
    }
  }

  const total = Object.values(byEntity).reduce((s, n) => s + n, 0) || 1;
  const distribution = Object.entries(byEntity).map(([entityId, count]) => ({
    entityId,
    share: Math.round((count / total) * 10000),
  }));

  return c.json(distribution);
});

export default r;
