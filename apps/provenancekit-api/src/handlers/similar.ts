/**
 * Similar Resources Handler
 *
 * Find resources similar to a given resource.
 */

import { Hono } from "hono";
import { EmbeddingService } from "../embedding/service.js";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";

const embedder = new EmbeddingService();
const r = new Hono();

/**
 * GET /similar/:cid?topK=5
 * Find resources similar to the given resource.
 */
r.get("/similar/:cid", async (c) => {
  const cid = c.req.param("cid");
  const topK = Number(c.req.query("topK") ?? 5);

  if (!cid) {
    throw new ProvenanceKitError("MissingField", "cid path param required");
  }

  const { supabase, dbStorage } = getContext();

  // Check resource exists
  const resource = await dbStorage.getResource(cid);
  if (!resource) {
    throw new ProvenanceKitError("NotFound", "Resource not found");
  }

  // Get embedding from database
  const { data: embeddingData } = await supabase
    .from("pk_embedding")
    .select("embedding")
    .eq("ref", cid)
    .single();

  if (!embeddingData?.embedding) {
    throw new ProvenanceKitError("Unsupported", "Resource has no embedding");
  }

  const matches = await embedder.match(embeddingData.embedding as number[], { topK });
  return c.json(matches);
});

export default r;
