// health.ts
import { Hono } from "hono";
import { openApiSpec } from "../openapi.js";

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
  .get("/openapi.json", (c) => c.json(openApiSpec))
  .get("/docs", (c) => c.html(SCALAR_UI_HTML));

export default r;
