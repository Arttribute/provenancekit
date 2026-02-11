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

  const graph = await buildProvenanceGraph(cid, depth);
  return c.json(graph);
});

export default r;
