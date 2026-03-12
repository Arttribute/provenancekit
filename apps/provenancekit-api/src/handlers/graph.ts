// apps/provenanceKit-api/src/handlers/graph.ts
import { Hono } from "hono";
import { buildProvenanceGraph } from "../services/graph.service.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/**
 * GET /graph/:cid?depth=10
 */
r.get("/graph/:cid", async (c) => {
  const cid = c.req.param("cid");
  const depthRaw = c.req.query("depth") ?? "10";
  const depth = Number(depthRaw);

  if (!cid)
    throw new ProvenanceKitError("MissingField", "cid path param required", {
      recovery: "Call /graph/{CID}",
    });

  if (Number.isNaN(depth) || depth < 0)
    throw new ProvenanceKitError(
      "InvalidField",
      "`depth` must be a positive number"
    );

  let graph;
  try {
    graph = await buildProvenanceGraph(cid, depth);
  } catch (err) {
    if (err instanceof ProvenanceKitError) throw err;
    console.error("[graph] Storage error for CID", cid, "—", err instanceof Error ? err.message : err);
    throw new ProvenanceKitError("NotFound", `Resource not found or still recording: ${cid}`, {
      recovery: "Wait a few seconds and retry — recording can take a few seconds to propagate to the DB.",
    });
  }
  return c.json(graph);
});

export default r;
