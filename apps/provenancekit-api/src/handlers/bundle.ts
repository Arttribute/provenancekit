// apps/provenancekit-api/src/handlers/bundle.ts
import { Hono } from "hono";
import { fetchBundle } from "../services/bundle.service.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/**
 * GET /bundle/:cid
 */
r.get("/bundle/:cid", async (c) => {
  const cid = c.req.param("cid");
  if (!cid)
    throw new ProvenanceKitError("MissingField", "cid path param required", {
      recovery: "Call /bundle/{CID}",
    });

  const bundle = await fetchBundle(cid);
  return c.json(bundle);
});

export default r;
