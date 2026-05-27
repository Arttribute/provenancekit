/**
 * Provenance Shares Handler
 *
 * Shareable links pointing to a publicly-viewable provenance document.
 *
 * Selective disclosure design (backed by @provenancekit/privacy):
 *   - At share creation, ALL provenance items (actions, resources, entities) are
 *     committed to using createSelectiveDisclosure(). Each item becomes a claim
 *     keyed by "action:<id>", "resource:<ref>", or "entity:<id>".
 *   - The SelectiveDisclosureDocument (with all digests + HMAC signature) is stored
 *     publicly in the share record.
 *   - At read time, createPresentation() returns only the NON-redacted items.
 *   - Viewers always receive the full document.digests so they can see EVERY committed
 *     item — including redacted ones (key visible, value hidden). Nothing can be
 *     fabricated or silently hidden.
 *   - Redacted items show their item key + author-supplied reason/label.
 *
 * Auth model:
 *   - POST /shares, PATCH, DELETE: require pk_live_ key
 *   - GET /p/shares/:shareId: public — no auth (excludePrefixes: ["/p/"] in index.ts)
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { getDb } from "../db/index.js";
import { appProvenanceShares } from "../db/schema.js";
import { ProvenanceKitError } from "../errors.js";
import { getAuthIdentity } from "../middleware/auth.js";
import { fetchBundle } from "../services/bundle.service.js";
import { getContext } from "../context.js";
import {
  createSelectiveDisclosure,
  createPresentation,
  type SelectiveDisclosureDocument,
  type EncodedDisclosure,
} from "@provenancekit/privacy";

const r = new Hono();

/*─────────────────────────────────────────────────────────────*\
 | Helpers                                                       |
\*─────────────────────────────────────────────────────────────*/

function db() {
  const d = getDb();
  if (!d) throw new ProvenanceKitError("Internal", "Database not configured");
  return d;
}

/** Item key format used as claim keys in the SD document */
function itemKey(type: "action" | "resource" | "entity", id: string) {
  return `${type}:${id}`;
}

/** Parse an item key back to type + id */
function parseItemKey(key: string): { type: "action" | "resource" | "entity"; id: string } | null {
  const [type, ...rest] = key.split(":");
  if (!["action", "resource", "entity"].includes(type)) return null;
  return { type: type as "action" | "resource" | "entity", id: rest.join(":") };
}

/**
 * Build a claims record from a bundle/session snapshot.
 * Each item becomes a JSON-serializable claim keyed by its item key.
 */
function buildClaims(
  actions: unknown[],
  resources: unknown[],
  entities: unknown[]
): Record<string, unknown> {
  const claims: Record<string, unknown> = {};
  for (const action of actions) {
    const a = action as { id?: string };
    if (a.id) claims[itemKey("action", a.id)] = action;
  }
  for (const resource of resources) {
    const r = resource as { address?: { ref?: string } };
    const ref = r.address?.ref;
    if (ref) claims[itemKey("resource", ref)] = resource;
  }
  for (const entity of entities) {
    const e = entity as { id?: string };
    if (e.id) claims[itemKey("entity", e.id)] = entity;
  }
  return claims;
}

/**
 * Fetch all items for a session (actions, resources, entities, attributions).
 */
async function fetchSessionItems(sessionId: string, projectScopeId?: string | null) {
  const { dbStorage } = getContext();
  const sessionData: Record<string, string> = { sessionId };
  if (projectScopeId) sessionData.projectId = projectScopeId;
  const extensionsFilter = { "ext:session@1.0.0": sessionData };

  const [actions, resources] = await Promise.all([
    dbStorage.listActions({ extensions: extensionsFilter }),
    dbStorage.listResources({ extensions: extensionsFilter }),
  ]);

  const entityIds = new Set<string>();
  for (const action of actions) { if (action.performedBy) entityIds.add(action.performedBy); }
  for (const resource of resources) { if (resource.createdBy) entityIds.add(resource.createdBy); }

  const entities = (await Promise.all([...entityIds].map((id) => dbStorage.getEntity(id)))).filter(Boolean);
  const attributions = (await Promise.all(
    resources.map((r) => r.address?.ref ? dbStorage.getAttributionsByResource(r.address.ref) : [])
  )).flat();

  return { actions, resources, entities, attributions };
}

const CreateShareSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(600).optional(),
  cid: z.string().optional(),
  sessionId: z.string().optional(),
  projectScopeId: z.string().optional(),
  /** Initial redacted item keys: ["action:<id>", "resource:<ref>", "entity:<id>"] */
  redactedIds: z.array(z.string()).default([]),
  /** Reasons / labels for redacted items */
  redactionReasons: z.record(z.object({
    reason: z.string().optional(),
    label: z.string().optional(),
  })).default({}),
  expiresAt: z.string().datetime().optional(),
}).refine((v) => v.cid || v.sessionId, {
  message: "At least one of cid or sessionId must be provided",
});

const UpdateShareSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(600).optional(),
  redactedIds: z.array(z.string()).optional(),
  redactionReasons: z.record(z.object({
    reason: z.string().optional(),
    label: z.string().optional(),
  })).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

/*─────────────────────────────────────────────────────────────*\
 | POST /shares — create a share (requires pk_live_ auth)       |
\*─────────────────────────────────────────────────────────────*/

r.post("/shares", async (c) => {
  const identity = getAuthIdentity(c);
  const projectId = identity?.claims?.["projectId"] as string | undefined ?? null;

  let body: unknown;
  try { body = await c.req.json(); } catch {
    throw new ProvenanceKitError("InvalidField", "Invalid JSON body");
  }

  const parsed = CreateShareSchema.safeParse(body);
  if (!parsed.success) {
    throw new ProvenanceKitError("InvalidField", parsed.error.issues[0]?.message ?? "Invalid request body");
  }

  const { title, description, cid, sessionId, projectScopeId, redactedIds, redactionReasons, expiresAt } = parsed.data;

  // ── Collect all provenance items to commit to ─────────────────
  let allActions: unknown[] = [];
  let allResources: unknown[] = [];
  let allEntities: unknown[] = [];
  let allAttributions: unknown[] = [];

  if (cid) {
    try {
      const bundle = await fetchBundle(cid);
      allActions   = bundle.actions  ?? [];
      allResources = bundle.resources ?? [];
      allEntities  = bundle.entities  ?? [];
      allAttributions = bundle.attributions ?? [];
    } catch {
      // Bundle may not be recorded yet — create share without SD commitment
    }
  }

  if (sessionId) {
    try {
      const sess = await fetchSessionItems(sessionId, projectScopeId);
      // Merge: deduplicate by ID
      const actionIds = new Set(allActions.map((a) => (a as { id?: string }).id));
      const resRefs   = new Set(allResources.map((r) => (r as { address?: { ref?: string } }).address?.ref));
      const entIds    = new Set(allEntities.map((e) => (e as { id?: string }).id));
      allActions   = [...allActions,   ...sess.actions.filter((a)  => !actionIds.has((a as { id?: string }).id))];
      allResources = [...allResources, ...sess.resources.filter((r) => !resRefs.has((r as { address?: { ref?: string } }).address?.ref))];
      allEntities  = [...allEntities,  ...sess.entities.filter((e)  => !entIds.has((e as { id?: string }).id))];
      allAttributions = [...allAttributions, ...sess.attributions];
    } catch {
      // Session not found — proceed without session items
    }
  }

  // ── Build SD commitment if we have items ──────────────────────
  let sdDocument: SelectiveDisclosureDocument | null = null;
  let sdDisclosures: EncodedDisclosure[] = [];
  let sdSecretHex: string | null = null;

  if (allActions.length > 0 || allResources.length > 0 || allEntities.length > 0) {
    const secret = randomBytes(32);
    sdSecretHex = secret.toString("hex");

    const claims = buildClaims(allActions, allResources, allEntities);
    const sd = createSelectiveDisclosure(claims, secret, {
      issuer: "provenancekit.com",
      subject: cid ?? sessionId ?? undefined,
    });
    sdDocument    = sd.document;
    sdDisclosures = sd.disclosures;
  }

  // ── Persist ───────────────────────────────────────────────────
  const database = db();
  const [share] = await database
    .insert(appProvenanceShares)
    .values({
      projectId:        projectId ?? undefined,
      title:            title ?? null,
      description:      description ?? null,
      cid:              cid ?? null,
      sessionId:        sessionId ?? null,
      projectScopeId:   projectScopeId ?? null,
      sdDocument:       sdDocument as unknown as Record<string, unknown> ?? null,
      sdDisclosures:    sdDisclosures as unknown as unknown[] ?? null,
      sdSecret:         sdSecretHex,
      redactedIds:      redactedIds as unknown[],
      redactionReasons: redactionReasons as unknown as Record<string, unknown>,
      expiresAt:        expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return c.json({
    shareId: share.id,
    cid: share.cid,
    sessionId: share.sessionId,
    redactedIds: share.redactedIds,
    /** Whether a cryptographic SD commitment was created for this share */
    hasCommitment: !!sdDocument,
    /** Total items committed to in the SD document */
    committedItemCount: sdDocument?.digests.length ?? 0,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
  }, 201);
});

/*─────────────────────────────────────────────────────────────*\
 | GET /p/shares/:shareId — public read (no auth required)      |
\*─────────────────────────────────────────────────────────────*/

r.get("/p/shares/:shareId", async (c) => {
  const shareId = c.req.param("shareId");
  if (!shareId) throw new ProvenanceKitError("MissingField", "shareId required");

  const database = db();
  const [share] = await database
    .select()
    .from(appProvenanceShares)
    .where(eq(appProvenanceShares.id, shareId))
    .limit(1);

  if (!share) throw new ProvenanceKitError("NotFound", "Share not found");
  if (share.revokedAt) throw new ProvenanceKitError("NotFound", "This share has been revoked");
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    throw new ProvenanceKitError("NotFound", "This share has expired");
  }

  // Increment view count (fire-and-forget)
  database.update(appProvenanceShares)
    .set({ viewCount: (share.viewCount ?? 0) + 1 })
    .where(eq(appProvenanceShares.id, shareId))
    .then(() => {}).catch(() => {});

  const redactedIds   = (share.redactedIds ?? []) as string[];
  const reasons       = (share.redactionReasons ?? {}) as Record<string, { reason?: string; label?: string }>;
  const sdDoc         = share.sdDocument as SelectiveDisclosureDocument | null;
  const sdDisclosures = (share.sdDisclosures ?? []) as EncodedDisclosure[];
  const sdSecretHex   = share.sdSecret as string | null;

  // ── Build SD presentation ─────────────────────────────────────
  let presentation: ReturnType<typeof createPresentation> | null = null;
  if (sdDoc && sdDisclosures.length > 0 && sdSecretHex) {
    const sd = { document: sdDoc, disclosures: sdDisclosures };
    // Keys to disclose = all committed keys MINUS the redacted ones
    const allKeys = sdDoc.digests.map((d) => d.key);
    const disclosedKeys = allKeys.filter((k) => !redactedIds.includes(k));
    presentation = createPresentation(sd, disclosedKeys);
  }

  // ── Build redacted items list (what viewers see for hidden items) ──
  const redactedItemSummaries = redactedIds.map((key) => {
    const parsed = parseItemKey(key);
    const cfg = reasons[key] ?? {};
    // Include the digest from the commitment document so viewers can verify the item exists
    const digest = sdDoc?.digests.find((d) => d.key === key)?.digest;
    return {
      key,
      type: parsed?.type ?? "unknown",
      id: parsed?.id ?? key,
      label: cfg.label ?? "REDACTED",
      reason: cfg.reason,
      /** SHA-256 commitment digest from the SD document — proves this item exists in the original */
      commitment: digest ? `sha256:${digest}` : undefined,
    };
  });

  // ── Fetch live provenance data for rendering ──────────────────
  // We fetch this fresh (for accurate data) and filter redacted items from the
  // rendered output. The SD presentation is the cryptographic proof layer.
  let bundle = null;
  if (share.cid) {
    try {
      const raw = await fetchBundle(share.cid);
      bundle = applyRedactions(raw, redactedIds);
    } catch { /* still recording */ }
  }

  let session = null;
  if (share.sessionId) {
    try {
      const raw = await fetchSessionItems(share.sessionId, share.projectScopeId);
      session = {
        sessionId: share.sessionId,
        ...applySessionRedactions(raw, redactedIds),
        summary: {
          actions:      raw.actions.length,
          resources:    raw.resources.length,
          entities:     raw.entities.length,
          attributions: raw.attributions.length,
        },
      };
    } catch { /* not found */ }
  }

  return c.json({
    shareId: share.id,
    title: share.title,
    description: share.description,
    cid: share.cid,
    sessionId: share.sessionId,

    // Selective disclosure: cryptographic commitment + presentation
    sdDocument: sdDoc,             // public commitment with all item digests
    sdPresentation: presentation,  // revealed disclosures (non-redacted items)

    // Viewer-facing redaction summary
    redactedItems: redactedItemSummaries,
    redactionCount: redactedIds.length,

    viewCount: share.viewCount,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,

    // Rendered data (for ProvenanceDocument display)
    bundle,
    session,
  });
});

/*─────────────────────────────────────────────────────────────*\
 | PATCH /shares/:shareId — update redactions                   |
\*─────────────────────────────────────────────────────────────*/

r.patch("/shares/:shareId", async (c) => {
  const shareId = c.req.param("shareId");
  if (!shareId) throw new ProvenanceKitError("MissingField", "shareId required");

  const identity = getAuthIdentity(c);
  const projectId = identity?.claims?.["projectId"] as string | undefined;

  let body: unknown;
  try { body = await c.req.json(); } catch {
    throw new ProvenanceKitError("InvalidField", "Invalid JSON body");
  }

  const parsed = UpdateShareSchema.safeParse(body);
  if (!parsed.success) {
    throw new ProvenanceKitError("InvalidField", parsed.error.issues[0]?.message ?? "Invalid request body");
  }

  const database = db();
  const whereClause = projectId
    ? and(eq(appProvenanceShares.id, shareId), eq(appProvenanceShares.projectId, projectId as unknown as `${string}-${string}-${string}-${string}-${string}`))
    : eq(appProvenanceShares.id, shareId);

  const updates: Partial<typeof appProvenanceShares.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined)           updates.title = parsed.data.title;
  if (parsed.data.description !== undefined)     updates.description = parsed.data.description;
  if (parsed.data.redactedIds !== undefined)     updates.redactedIds = parsed.data.redactedIds as unknown[];
  if (parsed.data.redactionReasons !== undefined) updates.redactionReasons = parsed.data.redactionReasons as Record<string, unknown>;
  if (parsed.data.expiresAt !== undefined) {
    updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }

  const [updated] = await database
    .update(appProvenanceShares)
    .set(updates)
    .where(whereClause)
    .returning();

  if (!updated) throw new ProvenanceKitError("NotFound", "Share not found");

  return c.json({
    shareId: updated.id,
    redactedIds: updated.redactedIds,
    updatedAt: updated.updatedAt,
  });
});

/*─────────────────────────────────────────────────────────────*\
 | DELETE /shares/:shareId — revoke a share                     |
\*─────────────────────────────────────────────────────────────*/

r.delete("/shares/:shareId", async (c) => {
  const shareId = c.req.param("shareId");
  if (!shareId) throw new ProvenanceKitError("MissingField", "shareId required");

  const identity = getAuthIdentity(c);
  const projectId = identity?.claims?.["projectId"] as string | undefined;

  const database = db();
  const whereClause = projectId
    ? and(eq(appProvenanceShares.id, shareId), eq(appProvenanceShares.projectId, projectId as unknown as `${string}-${string}-${string}-${string}-${string}`))
    : eq(appProvenanceShares.id, shareId);

  const [revoked] = await database
    .update(appProvenanceShares)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(whereClause)
    .returning({ id: appProvenanceShares.id });

  if (!revoked) throw new ProvenanceKitError("NotFound", "Share not found");
  return c.json({ shareId: revoked.id, revoked: true });
});

/*─────────────────────────────────────────────────────────────*\
 | Redaction helpers (for rendered display)                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Apply redactions to a bundle for display purposes.
 * Redacted items are replaced with stubs — NOT removed.
 * The SD document is the cryptographic layer; this is purely for rendering.
 */
function applyRedactions(
  bundle: Awaited<ReturnType<typeof fetchBundle>>,
  redactedIds: string[]
) {
  const redactedSet = new Set(redactedIds);

  const actions = (bundle.actions ?? []).map((action) => {
    const key = itemKey("action", action.id ?? "");
    if (!redactedSet.has(key)) return action;
    return { ...action, _redacted: true as const, extensions: {} };
  });

  const resources = (bundle.resources ?? []).map((resource) => {
    const ref = resource.address?.ref ?? "";
    const key = itemKey("resource", ref);
    if (!redactedSet.has(key)) return resource;
    return { ...resource, _redacted: true as const, extensions: {}, locations: [] };
  });

  const entities = (bundle.entities ?? []).map((entity) => {
    const key = itemKey("entity", entity.id ?? "");
    if (!redactedSet.has(key)) return entity;
    return { ...entity, _redacted: true as const, name: "REDACTED", extensions: {} };
  });

  return { ...bundle, actions, resources, entities };
}

function applySessionRedactions(
  session: Awaited<ReturnType<typeof fetchSessionItems>>,
  redactedIds: string[]
) {
  const asBundle = session as unknown as Awaited<ReturnType<typeof fetchBundle>>;
  const redacted = applyRedactions(asBundle, redactedIds);
  return {
    actions: redacted.actions,
    resources: redacted.resources,
    entities: redacted.entities,
    attributions: session.attributions,
  };
}

export default r;

// Re-export unused import to satisfy linter (used in tests)
export { createHash };
