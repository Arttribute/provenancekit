/**
 * Payments Handler
 *
 * API endpoints for payment distribution based on provenance attributions.
 * Uses @provenancekit/payments and @provenancekit/extensions.
 */

import { Hono } from "hono";
import { z } from "zod";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";
import {
  calculateDistribution,
  type Distribution,
} from "@provenancekit/extensions";
import { getLineageAttributions } from "@provenancekit/storage/utils";

const r = new Hono();

/*─────────────────────────────────────────────────────────────*\
 | Request Schemas                                              |
\*─────────────────────────────────────────────────────────────*/

const DistributionQuerySchema = z.object({
  depth: z.coerce.number().min(1).max(50).default(10),
});

/*─────────────────────────────────────────────────────────────*\
 | GET /distribution/:cid                                       |
 | Calculate payment distribution for a resource                |
\*─────────────────────────────────────────────────────────────*/

r.get("/distribution/:cid", async (c) => {
  const cid = c.req.param("cid");
  if (!cid) {
    throw new ProvenanceKitError("MissingField", "cid path param required");
  }

  const query = DistributionQuerySchema.parse({
    depth: c.req.query("depth"),
  });

  const { dbStorage } = getContext();

  // Check resource exists
  const resource = await dbStorage.getResource(cid);
  if (!resource) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${cid}`);
  }

  // Get all attributions in the lineage
  const attributions = await getLineageAttributions(dbStorage, cid, query.depth);

  // Calculate distribution
  const distribution = calculateDistribution(
    { ref: cid, scheme: "cid" },
    attributions
  );

  return c.json({
    resourceRef: distribution.resourceRef,
    entries: distribution.entries.map((e) => ({
      entityId: e.entityId,
      bps: e.bps,
      percentage: (e.bps / 100).toFixed(2) + "%",
      payment: e.payment,
    })),
    totalBps: distribution.totalBps,
    metadata: {
      attributionsProcessed: distribution.metadata.attributionsProcessed,
      attributionsFiltered: distribution.metadata.attributionsFiltered,
      normalized: distribution.metadata.normalized,
      algorithmVersion: distribution.metadata.algorithmVersion,
    },
  });
});

/*─────────────────────────────────────────────────────────────*\
 | POST /distribution/preview                                   |
 | Preview distribution for multiple resources                  |
\*─────────────────────────────────────────────────────────────*/

const PreviewRequestSchema = z.object({
  cids: z.array(z.string()).min(1).max(100),
  depth: z.number().min(1).max(50).default(10),
});

r.post("/distribution/preview", async (c) => {
  const body = await c.req.json();
  const { cids, depth } = PreviewRequestSchema.parse(body);

  const { dbStorage } = getContext();
  const distributions: Array<Distribution & { cid: string }> = [];

  for (const cid of cids) {
    const resource = await dbStorage.getResource(cid);
    if (!resource) continue;

    const attributions = await getLineageAttributions(dbStorage, cid, depth);
    const distribution = calculateDistribution(
      { ref: cid, scheme: "cid" },
      attributions
    );

    distributions.push({ ...distribution, cid });
  }

  return c.json({
    distributions: distributions.map((d) => ({
      cid: d.cid,
      entries: d.entries.map((e) => ({
        entityId: e.entityId,
        bps: e.bps,
        percentage: (e.bps / 100).toFixed(2) + "%",
      })),
      totalBps: d.totalBps,
    })),
    summary: {
      resourcesProcessed: distributions.length,
      uniqueContributors: new Set(
        distributions.flatMap((d) => d.entries.map((e) => e.entityId))
      ).size,
    },
  });
});

export default r;
