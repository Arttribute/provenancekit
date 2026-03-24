/**
 * ProvenanceKit API — OpenAPI 3.1 Specification
 *
 * Exported as a plain object so it can be served at GET /openapi.json
 * and consumed by Scalar UI at GET /docs.
 *
 * Coverage:
 *   - /v1/*   — versioned provenance recording endpoints (used by SDK)
 *   - /entity, /entities — entity CRUD
 *   - /activity — convenience upload+record+embed endpoint
 *   - /bundle, /graph, /session — retrieval endpoints
 *   - /search, /similar — discovery endpoints
 *   - /ownership — on-chain ownership claim/transfer
 *
 * Management endpoints (/management/*) are internal server-to-server APIs
 * and are documented separately.
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ProvenanceKit API",
    version: "1.0.0",
    description:
      "REST API for recording, querying, and verifying provenance of Human-AI created works. " +
      "All endpoints under `/v1/*` require an `Authorization: Bearer pk_live_...` API key.",
    contact: {
      name: "ProvenanceKit",
      url: "https://provenancekit.org",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "https://api.provenancekit.org",
      description: "Production",
    },
    {
      url: "http://localhost:3001",
      description: "Local development",
    },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "pk_live_...",
        description: "API key obtained from the ProvenanceKit dashboard",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", example: "NotFound" },
              message: { type: "string", example: "Entity not found" },
              recovery: { type: "string", nullable: true },
              details: { type: "object", nullable: true, additionalProperties: true },
            },
          },
        },
      },
      Entity: {
        type: "object",
        required: ["id", "role"],
        properties: {
          id: { type: "string", example: "user:alice" },
          role: { type: "string", enum: ["human", "ai", "organization"], example: "human" },
          name: { type: "string", nullable: true, example: "Alice" },
          publicKey: { type: "string", nullable: true },
          metadata: { type: "object", nullable: true, additionalProperties: true },
          extensions: { type: "object", nullable: true, additionalProperties: true },
        },
      },
      ContentReference: {
        type: "object",
        required: ["ref", "scheme"],
        properties: {
          ref: { type: "string", example: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" },
          scheme: { type: "string", enum: ["ipfs", "arweave", "https", "data"], example: "ipfs" },
          integrity: { type: "string", nullable: true, example: "sha256-..." },
          size: { type: "integer", nullable: true, example: 12345 },
        },
      },
      Resource: {
        type: "object",
        required: ["address", "type", "createdBy", "rootAction"],
        properties: {
          address: { $ref: "#/components/schemas/ContentReference" },
          type: {
            type: "string",
            enum: ["text", "image", "audio", "video", "code", "dataset", "model", "other"],
            example: "text",
          },
          locations: {
            type: "array",
            items: { type: "string" },
            example: ["ipfs://bafybeig..."],
          },
          createdAt: { type: "string", format: "date-time" },
          createdBy: { type: "string", example: "user:alice" },
          rootAction: { type: "string", example: "action:01HX..." },
          extensions: { type: "object", nullable: true, additionalProperties: true },
        },
      },
      Action: {
        type: "object",
        required: ["id", "type", "performedBy", "timestamp"],
        properties: {
          id: { type: "string", example: "action:01HX..." },
          type: {
            type: "string",
            enum: ["create", "transform", "aggregate", "verify"],
            example: "create",
          },
          performedBy: { type: "string", example: "user:alice" },
          timestamp: { type: "string", format: "date-time" },
          inputs: {
            type: "array",
            items: { $ref: "#/components/schemas/ContentReference" },
          },
          outputs: {
            type: "array",
            items: { $ref: "#/components/schemas/ContentReference" },
          },
          proof: { type: "string", nullable: true },
          extensions: { type: "object", nullable: true, additionalProperties: true },
        },
      },
      Attribution: {
        type: "object",
        required: ["id", "entityId", "role"],
        properties: {
          id: { type: "string", example: "attr:01HX..." },
          resourceRef: { type: "string", nullable: true },
          actionId: { type: "string", nullable: true },
          entityId: { type: "string", example: "user:alice" },
          role: {
            type: "string",
            enum: ["creator", "contributor", "source"],
            example: "creator",
          },
          note: { type: "string", nullable: true },
          extensions: { type: "object", nullable: true, additionalProperties: true },
        },
      },
      ProvenanceBundle: {
        type: "object",
        properties: {
          resource: { $ref: "#/components/schemas/Resource" },
          actions: { type: "array", items: { $ref: "#/components/schemas/Action" } },
          entities: { type: "array", items: { $ref: "#/components/schemas/Entity" } },
          attributions: { type: "array", items: { $ref: "#/components/schemas/Attribution" } },
        },
      },
    },
  },
  paths: {
    // ─── Health ────────────────────────────────────────────────────────────
    "/": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        operationId: "getHealth",
        security: [],
        responses: {
          "200": { description: "API is running", content: { "text/plain": { schema: { type: "string", example: "ok" } } } },
        },
      },
    },

    // ─── Entities ──────────────────────────────────────────────────────────
    "/entity": {
      post: {
        tags: ["Entities"],
        summary: "Create or update an entity",
        operationId: "upsertEntity",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  id: { type: "string", description: "Stable identifier. Auto-generated if omitted." },
                  role: { type: "string", enum: ["human", "ai", "organization"] },
                  name: { type: "string" },
                  publicKey: { type: "string" },
                  metadata: { type: "object", additionalProperties: true },
                  aiAgent: {
                    type: "object",
                    description: "Required when role is 'ai'",
                    properties: {
                      model: {
                        type: "object",
                        required: ["provider", "model"],
                        properties: {
                          provider: { type: "string", example: "openai" },
                          model: { type: "string", example: "gpt-4o" },
                          version: { type: "string" },
                        },
                      },
                      autonomyLevel: { type: "string", enum: ["supervised", "autonomous", "collaborative"] },
                      delegatedBy: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Entity created or updated",
            content: { "application/json": { schema: { type: "object", properties: { entity: { $ref: "#/components/schemas/Entity" } } } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/entity/{id}": {
      get: {
        tags: ["Entities"],
        summary: "Get an entity by ID",
        operationId: "getEntity",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Entity found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entity: { $ref: "#/components/schemas/Entity" },
                    isAIAgent: { type: "boolean" },
                  },
                },
              },
            },
          },
          "404": { description: "Entity not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/entities": {
      get: {
        tags: ["Entities"],
        summary: "List entities",
        operationId: "listEntities",
        parameters: [
          { name: "role", in: "query", schema: { type: "string", enum: ["human", "ai", "organization"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "List of entities",
            content: { "application/json": { schema: { type: "object", properties: { entities: { type: "array", items: { $ref: "#/components/schemas/Entity" } } } } } },
          },
        },
      },
    },

    // ─── V1 Endpoints (SDK-facing) ─────────────────────────────────────────
    "/v1/entities": {
      post: {
        tags: ["V1 — Entities"],
        summary: "Create or update an entity (v1 compat)",
        operationId: "v1UpsertEntity",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  role: { type: "string", enum: ["human", "ai", "organization"] },
                  type: { type: "string", description: "Alias for role (legacy)" },
                  name: { type: "string" },
                  provider: { type: "string", description: "AI provider (when role=ai)" },
                  model: { type: "string", description: "AI model name (when role=ai)" },
                  isAIAgent: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Entity created",
            content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/actions": {
      post: {
        tags: ["V1 — Actions"],
        summary: "Record an action",
        operationId: "v1RecordAction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "performedBy"],
                properties: {
                  type: { type: "string", example: "create" },
                  performedBy: { type: "string", example: "user:alice" },
                  requestedBy: { type: "string", description: "Second entity (e.g. human who prompted the AI)" },
                  inputs: { type: "array", items: { $ref: "#/components/schemas/ContentReference" } },
                  outputs: { type: "array", items: { $ref: "#/components/schemas/ContentReference" } },
                  timestamp: { type: "string", format: "date-time" },
                  extensions: { type: "object", additionalProperties: true },
                  attributions: {
                    type: "array",
                    description: "Inline attributions to record alongside the action",
                    items: {
                      type: "object",
                      properties: {
                        entityId: { type: "string" },
                        role: { type: "string" },
                        resourceRef: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Action recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    actionId: { type: "string" },
                    onchain: {
                      type: "object",
                      nullable: true,
                      description: "Present when on-chain recording succeeded",
                      properties: {
                        txHash: { type: "string" },
                        actionId: { type: "string" },
                        chainId: { type: "integer" },
                        chainName: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/resources/upload": {
      post: {
        tags: ["V1 — Resources"],
        summary: "Upload a file and record it as a resource",
        operationId: "v1UploadResource",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "createdBy", "rootAction"],
                properties: {
                  file: { type: "string", format: "binary" },
                  createdBy: { type: "string", example: "user:alice" },
                  rootAction: { type: "string", example: "action:01HX..." },
                  type: { type: "string", enum: ["text", "image", "audio", "video", "code", "dataset", "model", "other"] },
                  extensions: { type: "string", description: "JSON-encoded extensions object" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "File uploaded and resource recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cid: { type: "string" },
                    url: { type: "string" },
                    resource: { $ref: "#/components/schemas/Resource" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/resources/{cid}/bundle": {
      get: {
        tags: ["V1 — Resources"],
        summary: "Get provenance bundle for a resource",
        operationId: "v1GetBundle",
        parameters: [{ name: "cid", in: "path", required: true, schema: { type: "string" }, example: "bafybeig..." }],
        responses: {
          "200": {
            description: "Provenance bundle",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProvenanceBundle" } } },
          },
          "404": { description: "Resource not found" },
        },
      },
    },
    "/v1/resources/{cid}/distribution": {
      get: {
        tags: ["V1 — Resources"],
        summary: "Calculate revenue distribution for a resource",
        operationId: "v1GetDistribution",
        parameters: [
          { name: "cid", in: "path", required: true, schema: { type: "string" } },
          { name: "totalAmount", in: "query", schema: { type: "number" }, description: "Total amount to distribute (in base units)" },
        ],
        responses: {
          "200": {
            description: "Distribution result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    recipients: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          entityId: { type: "string" },
                          weight: { type: "number" },
                          amount: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Resource not found" },
        },
      },
    },

    // ─── Activity ──────────────────────────────────────────────────────────
    "/activity": {
      post: {
        tags: ["Activity"],
        summary: "Upload file, record action, and embed provenance in one call",
        operationId: "recordActivity",
        description:
          "Convenience endpoint that uploads a file to IPFS, records a provenance action, " +
          "and optionally embeds C2PA metadata. Replaces three separate API calls.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "entityId", "actionType"],
                properties: {
                  file: { type: "string", format: "binary" },
                  entityId: { type: "string", example: "user:alice" },
                  actionType: { type: "string", example: "create" },
                  resourceType: { type: "string", enum: ["text", "image", "audio", "video", "code", "dataset", "model", "other"] },
                  extensions: { type: "string", description: "JSON-encoded extensions (e.g. ext:ai@1.0.0 data)" },
                  embedC2pa: { type: "string", enum: ["true", "false"], description: "Embed C2PA manifest in supported media files" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Activity recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    actionId: { type: "string" },
                    cid: { type: "string" },
                    url: { type: "string" },
                    onchain: { type: "object", nullable: true },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },

    // ─── Bundle ────────────────────────────────────────────────────────────
    "/bundle/{cid}": {
      get: {
        tags: ["Provenance"],
        summary: "Get full provenance bundle for a content CID",
        operationId: "getBundle",
        parameters: [
          { name: "cid", in: "path", required: true, schema: { type: "string" } },
          { name: "depth", in: "query", schema: { type: "integer", default: 3 }, description: "Depth of ancestry to include" },
        ],
        responses: {
          "200": { description: "Provenance bundle", content: { "application/json": { schema: { $ref: "#/components/schemas/ProvenanceBundle" } } } },
          "404": { description: "Content not found" },
        },
      },
    },
    "/graph/{entityId}": {
      get: {
        tags: ["Provenance"],
        summary: "Get provenance graph for an entity",
        operationId: "getGraph",
        parameters: [{ name: "entityId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Provenance graph", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "Entity not found" },
        },
      },
    },
    "/session/{sessionId}": {
      get: {
        tags: ["Provenance"],
        summary: "Get all actions in a session",
        operationId: "getSession",
        parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Session actions",
            content: { "application/json": { schema: { type: "object", properties: { actions: { type: "array", items: { $ref: "#/components/schemas/Action" } } } } } },
          },
        },
      },
    },

    // ─── Search ────────────────────────────────────────────────────────────
    "/search": {
      post: {
        tags: ["Discovery"],
        summary: "Search resources by text query",
        operationId: "searchResources",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string", example: "AI generated blog post" },
                  type: { type: "string", enum: ["text", "image", "audio", "video", "code", "dataset", "model", "other"] },
                  limit: { type: "integer", default: 10 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: { type: "object", properties: { results: { type: "array", items: { $ref: "#/components/schemas/Resource" } } } },
              },
            },
          },
        },
      },
    },
    "/similar/{cid}": {
      get: {
        tags: ["Discovery"],
        summary: "Find semantically similar resources",
        operationId: "getSimilar",
        parameters: [
          { name: "cid", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: {
          "200": {
            description: "Similar resources",
            content: {
              "application/json": {
                schema: { type: "object", properties: { results: { type: "array", items: { $ref: "#/components/schemas/Resource" } } } },
              },
            },
          },
        },
      },
    },

    // ─── Ownership ─────────────────────────────────────────────────────────
    "/ownership/claim": {
      post: {
        tags: ["Ownership"],
        summary: "Claim ownership of a resource",
        operationId: "claimOwnership",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["resourceRef", "entityId"],
                properties: {
                  resourceRef: { type: "string" },
                  entityId: { type: "string" },
                  evidence: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Ownership claimed" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/ownership/transfer": {
      post: {
        tags: ["Ownership"],
        summary: "Transfer ownership of a resource",
        operationId: "transferOwnership",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["resourceRef", "fromEntityId", "toEntityId"],
                properties: {
                  resourceRef: { type: "string" },
                  fromEntityId: { type: "string" },
                  toEntityId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Ownership transferred" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "404": { description: "Resource or entity not found" },
        },
      },
    },
  },
  tags: [
    { name: "Health", description: "Server health" },
    { name: "Entities", description: "Create and query entities (humans, AI agents, organizations)" },
    { name: "V1 — Entities", description: "Versioned entity endpoints used by the SDK" },
    { name: "V1 — Actions", description: "Versioned action recording used by the SDK" },
    { name: "V1 — Resources", description: "Versioned resource upload and retrieval used by the SDK" },
    { name: "Activity", description: "Convenience endpoint: upload + record + embed in one call" },
    { name: "Provenance", description: "Retrieve provenance bundles, graphs, and sessions" },
    { name: "Discovery", description: "Search and find similar content" },
    { name: "Ownership", description: "Claim and transfer resource ownership" },
  ],
} as const;
