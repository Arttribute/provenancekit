// apps/provenanceKit-api/src/handlers/search.ts
import { Hono } from "hono";
import { searchByFile, searchByText } from "../services/search.service.js";
import { EmbeddingService } from "../embedding/service.js";
import { inferKindFromMime } from "../utils.js";
import { ProvenanceKitError } from "../errors.js";
import { getContext } from "../context.js";
import { supportsEncryptedVectors } from "@provenancekit/storage";

const embedder = new EmbeddingService();

const r = new Hono();

/*--------------------------------------------------------------
  POST /search/file
  multipart: file=<binary>
--------------------------------------------------------------*/
r.post("/search/file", async (c) => {
  const topK = Number(c.req.query("topK") ?? 5);
  const min = Number(c.req.query("min") ?? 0);
  const overrideType = c.req.query("type");

  const form = await c.req.parseBody();
  if (!(form.file instanceof File))
    throw new ProvenanceKitError("MissingField", "`file` part required");

  const kind = overrideType || inferKindFromMime(form.file.type);
  if (!kind)
    throw new ProvenanceKitError(
      "Unsupported",
      `Cannot infer kind from mime ${form.file.type}`,
      {
        recovery: "Specify ?type=image|audio|text|video",
      }
    );

  const matches = await searchByFile(form.file, {
    type: kind,
    topK,
    minScore: min,
  }).catch((e) => {
    throw new ProvenanceKitError(
      "EmbeddingFailed",
      "Embedding generation failed",
      {
        details: e,
      }
    );
  });

  const topScore = matches[0]?.score ?? 0;
  const verdict =
    matches.length === 0 ? "no-match" : topScore >= 0.95 ? "auto" : "review";

  return c.json({ verdict, matches });
});

/*--------------------------------------------------------------
  POST /search/text
  body: { text: "...", type?: "...", topK?: n, minScore?: n }
--------------------------------------------------------------*/
r.post("/search/text", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (typeof body.text !== "string" || !body.text.trim())
    throw new ProvenanceKitError("MissingField", "`text` is required in body");

  const result = await searchByText(body.text, {
    type: typeof body.type === "string" ? body.type : undefined,
    topK: typeof body.topK === "number" ? body.topK : 5,
    minScore: typeof body.minScore === "number" ? body.minScore : 0,
  }).catch((e) => {
    throw new ProvenanceKitError("EmbeddingFailed", "Text embedding failed", {
      details: e,
    });
  });

  return c.json(result);
});

/*--------------------------------------------------------------
  POST /search/text/vector
  Returns the raw embedding vector for a text query without running
  a similarity search. Used by the SDK to generate query vectors
  for client-side encrypted search.
--------------------------------------------------------------*/
r.post("/search/text/vector", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (typeof body.text !== "string" || !body.text.trim())
    throw new ProvenanceKitError("MissingField", "`text` is required in body");

  const vector = await embedder.vector("text", body.text).catch((e) => {
    throw new ProvenanceKitError("EmbeddingFailed", "Text embedding failed", {
      details: e,
    });
  });

  return c.json({ vector });
});

/*--------------------------------------------------------------
  GET /embeddings/encrypted
  Delta sync endpoint for the SDK's client-side encrypted search.
  Returns opaque encrypted vector blobs — the server cannot read them.
  The SDK decrypts locally with the user's key and runs similarity search.
--------------------------------------------------------------*/
r.get("/embeddings/encrypted", async (c) => {
  const since = c.req.query("since") || undefined;
  const kind = c.req.query("kind") || undefined;
  const limit = Number(c.req.query("limit") ?? 1000);

  const { dbStorage } = getContext();

  if (!supportsEncryptedVectors(dbStorage)) {
    throw new ProvenanceKitError(
      "Unsupported",
      "Encrypted vector storage not supported by current backend"
    );
  }

  const results = await dbStorage.listEncryptedEmbeddings({ since, kind, limit });
  return c.json({ embeddings: results });
});

export const searchRoute = r;
