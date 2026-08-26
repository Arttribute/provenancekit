// health.ts
import { Hono } from "hono";
import { openApiSpec } from "../openapi.js";
import { config } from "../config.js";

const SCALAR_UI_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>ProvenanceKit API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <script
    id="api-reference"
    data-url="/openapi.json"
    src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

const r = new Hono()
  .get("/", (c) => c.text("ok"))
  .get("/health", (c) =>
    c.json({
      status: "ok",
      service: "provenancekit-api",
      version: process.env.APP_VERSION ?? "development",
      storage: {
        database: config.databaseUrl ? "postgresql" : config.supabaseUrl ? "supabase" : "memory",
        files: config.storageProvider === "s3" ? "s3" : config.pinataJwt ? "ipfs" : "memory",
      },
      onchain: Boolean(
        config.blockchainRpcUrl &&
          config.blockchainContractAddress &&
          config.blockchainPrivateKey,
      ),
    }),
  )
  .get("/ready", (c) => c.json({ status: "ready" }))
  .get("/openapi.json", (c) => c.json(openApiSpec))
  .get("/docs", (c) => c.html(SCALAR_UI_HTML));

export default r;
