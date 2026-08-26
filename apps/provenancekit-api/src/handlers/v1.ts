/**
 * V1 API Compatibility Layer
 *
 * Mounts versioned REST endpoints (/v1/*) that example apps and external
 * clients use. These routes normalise incoming shapes and delegate to the
 * same services as the unversioned handlers.
 *
 * Mapped endpoints:
 *   POST /v1/entities               → upsert entity
 *   POST /v1/actions                → record action (JSON, no file upload)
 *   POST /v1/resources/upload       → upload resource to IPFS
 *   GET  /v1/resources/:cid/bundle  → provenance bundle
 *   GET  /v1/resources/:cid/distribution → revenue distribution
 */

import { Hono } from "hono";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import {
  ProvenanceBundle as ProvenanceBundleSchema,
  generateAttributionId,
  type Action,
  type Attribution,
  type ContentReference,
  type Entity,
  type ProvenanceBundle,
  type Resource,
} from "@provenancekit/eaa-types";
import { withOnchain } from "@provenancekit/extensions";
import {
  upsertEntity,
  type CreateEntityInput,
} from "../services/entity.service.js";
import { fetchBundle } from "../services/bundle.service.js";
import { ProvenanceKitError } from "../errors.js";
import { getContext } from "../context.js";

const r = new Hono();

type IngestBundle = ProvenanceBundle & {
  entities: Array<Entity & { id: string }>;
  actions: Array<Action & { id: string; performedBy: string }>;
  resources: Array<
    Resource & {
      address: ContentReference & { ref: string };
      createdBy: string;
    }
  >;
  attributions: Attribution[];
};
type IngestAction = IngestBundle["actions"][number];
type IngestResource = IngestBundle["resources"][number];

const REGISTRY_WRITE_ABI = [
  {
    type: "function",
    name: "recordActionAndRegisterOutputs",
    inputs: [
      { name: "actionType", type: "string" },
      { name: "inputs", type: "string[]" },
      { name: "outputs", type: "string[]" },
      { name: "resourceType", type: "string" },
    ],
    outputs: [{ name: "actionId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

function bundleHash(bundle: ProvenanceBundle): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(bundle)).digest("hex")}`;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

// ---------------------------------------------------------------------------
// POST /v1/entities
// Body: { name?, type, isAIAgent?, provider?, model? }
//   or: CreateEntityInput (role, name, aiAgent, etc.)
//
// Normalises the "type + isAIAgent + provider + model" shape used by the
// example apps into the canonical CreateEntityInput shape used internally.
// ---------------------------------------------------------------------------
r.post("/entities", async (c) => {
  const raw = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  // Normalise: type → role; isAIAgent + provider + model → aiAgent extension
  const input: CreateEntityInput = {
    id: raw.id as string | undefined,
    role: (raw.role ?? raw.type ?? "human") as string,
    name: raw.name as string | undefined,
    wallet: raw.wallet as string | undefined,
    publicKey: raw.publicKey as string | undefined,
    metadata: raw.metadata as Record<string, unknown> | undefined,
  };

  if (
    input.role === "ai" &&
    (raw.isAIAgent || raw.provider || raw.model)
  ) {
    input.aiAgent = {
      model: {
        provider: (raw.provider as string) ?? "unknown",
        model: (raw.model as string) ?? "unknown",
        version: raw.version as string | undefined,
      },
      delegatedBy: raw.delegatedBy as string | undefined,
      autonomyLevel: raw.autonomyLevel as CreateEntityInput["aiAgent"] extends object
        ? CreateEntityInput["aiAgent"]["autonomyLevel"]
        : undefined,
    };
  }

  if (!input.role.trim()) {
    throw new ProvenanceKitError("MissingField", "`role` or `type` is required");
  }

  const result = await upsertEntity(input);
  return c.json({ id: result.id }, 201);
});

// ---------------------------------------------------------------------------
// POST /v1/actions
// Body: {
//   type: string,
//   performedBy: string,           // entity ID of primary performer
//   requestedBy?: string,          // entity ID of requester (optional second performer)
//   inputs: ContentReference[],
//   outputs: ContentReference[],
//   extensions?: Record<string, unknown>,
//   attributions?: Array<{ entityId, role }>,
// }
//
// Records an action against already-existing CIDs (no file upload).
// Returns: { action: { id: string }, resource: { cid: string } }
// ---------------------------------------------------------------------------
r.post("/actions", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    type?: string;
    performedBy?: string;
    requestedBy?: string;
    inputs?: ContentReference[];
    outputs?: ContentReference[];
    extensions?: Record<string, unknown>;
  };

  if (!body.performedBy) {
    throw new ProvenanceKitError("MissingField", "`performedBy` is required");
  }

  const { dbStorage } = getContext();

  // Ensure the entity exists
  const entity = await dbStorage.getEntity(body.performedBy).catch(() => null);
  if (!entity) {
    throw new ProvenanceKitError(
      "NotFound",
      `Entity not found: ${body.performedBy}`,
      { recovery: "Register the entity via POST /v1/entities first" }
    );
  }

  const actionId = uuidv4();
  const now = new Date().toISOString();
  const inputs = body.inputs ?? [];
  const outputs = body.outputs ?? [];

  const action: Action = {
    id: actionId,
    type: (body.type ?? "create") as Action["type"],
    performedBy: body.performedBy,
    inputs,
    outputs,
    timestamp: now,
    extensions: body.extensions,
  };

  await dbStorage.createAction(action);

  // Record attribution for the primary performer
  const performerAttribution: Attribution = {
    entityId: body.performedBy,
    actionId,
    role: "creator",
  };
  await dbStorage.createAttribution(performerAttribution);

  // Record attribution for the requester (if different)
  if (body.requestedBy && body.requestedBy !== body.performedBy) {
    const requesterAttribution: Attribution = {
      entityId: body.requestedBy,
      actionId,
      role: "contributor",
    };
    await dbStorage.createAttribution(requesterAttribution);
  }

  // For outputs that look like CIDs, ensure a resource record exists
  const primaryOutput = outputs[0];
  const primaryCid = primaryOutput
    ? "ref" in primaryOutput
      ? (primaryOutput as { ref: string }).ref
      : String(primaryOutput)
    : actionId;

  return c.json(
    {
      action: { id: actionId },
      resource: { cid: primaryCid },
    },
    201
  );
});

// ---------------------------------------------------------------------------
// POST /v1/actions/batch
// Body: { bundle: ProvenanceBundle, onchain?: boolean }
//
// Ingests a complete EAA bundle with one network round-trip. Database writes
// are de-duplicated and grouped by dependency order. On-chain anchoring is a
// separate explicit boolean and commits the bundle digest once, not one tx per
// event.
// ---------------------------------------------------------------------------
r.post("/actions/batch", async (c) => {
  const raw = (await c.req.json().catch(() => ({}))) as {
    bundle?: unknown;
    onchain?: boolean;
  };
  const parsed = ProvenanceBundleSchema.safeParse(raw.bundle);
  if (!parsed.success) {
    throw new ProvenanceKitError("ValidationError", "Invalid provenance bundle", {
      details: parsed.error.flatten(),
    });
  }

  // Zod's runtime schema currently exposes a partial-looking inferred type;
  // successful strict parsing guarantees the public EAA bundle contract.
  const bundle = parsed.data as IngestBundle;
  const digest = bundleHash(bundle);
  const batchId = `pkbatch:${digest.slice("sha256:".length, "sha256:".length + 24)}`;
  const { dbStorage, blockchain } = getContext();
  const entities = uniqueBy(bundle.entities, (entity) => entity.id);
  const actions = uniqueBy(bundle.actions, (action) => action.id);
  const resources = uniqueBy(bundle.resources, (resource) => resource.address.ref);
  const attributions = uniqueBy(
    bundle.attributions.map((attribution) => ({
      ...attribution,
      id:
        attribution.id ??
        generateAttributionId({
          resourceRef: attribution.resourceRef,
          actionId: attribution.actionId,
          entityId: attribution.entityId,
          role: attribution.role,
          note: attribution.note,
          extensions: attribution.extensions,
        }),
    })),
    (attribution) => attribution.id!,
  );

  await Promise.all(entities.map((entity) => dbStorage.upsertEntity(entity)));

  const newActions = (
    await Promise.all(
      actions.map(async (action) =>
        (await dbStorage.getAction(action.id)) ? undefined : action,
      ),
    )
  ).filter((action): action is IngestAction => Boolean(action));
  await Promise.all(newActions.map((action) => dbStorage.createAction(action)));
  const actionWrites = newActions.length;

  const newResources = (
    await Promise.all(
      resources.map(async (resource) =>
        (await dbStorage.resourceExists(resource.address.ref)) ? undefined : resource,
      ),
    )
  ).filter((resource): resource is IngestResource => Boolean(resource));
  await Promise.all(
    newResources.map(async (resource) => {
      await dbStorage.createResource(resource);
      await dbStorage.initOwnershipState(resource.address.ref, resource.createdBy);
    }),
  );
  const resourceWrites = newResources.length;

  let attributionWrites = 0;
  // A repeated batch has no new actions/resources, so its deterministic
  // attributions were already inserted as part of the same successful write.
  if (actionWrites > 0 || resourceWrites > 0) {
    await Promise.all(
      attributions.map((attribution) => dbStorage.createAttribution(attribution)),
    );
    attributionWrites = attributions.length;
  }

  let onchain:
    | {
        txHash: string;
        chainId: number;
        chainName: string;
        contractAddress: string;
        status: "submitted";
      }
    | undefined;
  let warning: string | undefined;

  if (raw.onchain) {
    if (!blockchain) {
      warning = "On-chain anchoring was requested but no blockchain sink is configured";
    } else {
      const txHash = await blockchain.walletClient.writeContract({
        address: blockchain.contractAddress,
        abi: REGISTRY_WRITE_ABI,
        functionName: "recordActionAndRegisterOutputs",
        args: ["aggregate", [], [digest], "other"],
        account: blockchain.walletClient.account ?? null,
        chain: blockchain.walletClient.chain,
      });
      onchain = {
        txHash,
        chainId: blockchain.chainId,
        chainName: blockchain.chainName,
        contractAddress: blockchain.contractAddress,
        status: "submitted",
      };

      // Receipt waiting and action decoration are deliberately detached from
      // the response. Every action receives the same bundle-level anchor.
      blockchain.publicClient
        .waitForTransactionReceipt({ hash: txHash })
        .then(async (receipt) => {
          await Promise.all(
            actions.map((action) => {
              const anchored = withOnchain(action, {
                chainId: blockchain.chainId,
                chainName: blockchain.chainName,
                blockNumber: Number(receipt.blockNumber),
                transactionHash: receipt.transactionHash,
                contractAddress: blockchain.contractAddress,
                confirmed: receipt.status === "success",
              });
              return dbStorage.updateAction(action.id, {
                extensions: anchored.extensions,
              });
            }),
          );
        })
        .catch((error) =>
          console.error(
            `[batch:onchain] confirmation failed for ${txHash}:`,
            error instanceof Error ? error.message : error,
          ),
        );
    }
  }

  return c.json(
    {
      batchId,
      bundleHash: digest,
      accepted: {
        entities: entities.length,
        actions: actionWrites,
        resources: resourceWrites,
        attributions: attributionWrites,
      },
      onchain,
      warning,
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// POST /v1/resources/upload
// Multipart: file=<binary>
// Returns: { cid: string }
// ---------------------------------------------------------------------------
r.post("/resources/upload", async (c) => {
  const { fileStorage } = getContext();
  const form = await c.req.parseBody();

  if (!(form.file instanceof File)) {
    throw new ProvenanceKitError("MissingField", "`file` part is required");
  }

  const buffer = Buffer.from(await form.file.arrayBuffer());
  const uploaded = await fileStorage.upload(buffer, {
    mimeType: form.file.type || "application/octet-stream",
    name: form.file.name || "upload",
  });

  return c.json({ cid: uploaded.ref.ref, size: uploaded.size, url: uploaded.gatewayUrl }, 201);
});

// ---------------------------------------------------------------------------
// GET /v1/resources/:ref/content
// Streams private content through the authenticated API storage adapter.
// ---------------------------------------------------------------------------
r.get("/resources/:ref/content", async (c) => {
  const ref = c.req.param("ref");
  const { fileStorage } = getContext();
  const content = await fileStorage.retrieve(ref);
  c.header("Content-Type", "application/octet-stream");
  c.header("Content-Length", String(content.length));
  c.header("Cache-Control", "private, max-age=31536000, immutable");
  const body = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;
  return c.body(body);
});

// ---------------------------------------------------------------------------
// GET /v1/resources/:cid/bundle
// Delegates to bundle service
// ---------------------------------------------------------------------------
r.get("/resources/:cid/bundle", async (c) => {
  const cid = c.req.param("cid");
  const bundle = await fetchBundle(cid);
  return c.json(bundle);
});

// ---------------------------------------------------------------------------
// GET /v1/resources/:cid/distribution
// Computes revenue distribution by walking the provenance graph
// ---------------------------------------------------------------------------
r.get("/resources/:cid/distribution", async (c) => {
  const cid = c.req.param("cid");
  const { dbStorage } = getContext();

  const resource = await dbStorage.getResource(cid).catch(() => null);
  if (!resource) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${cid}`);
  }

  const attributions = await dbStorage.getAttributionsByResource(cid);

  // Build distribution as basis-point shares
  const byEntity: Record<string, number> = {};
  for (const attr of attributions) {
    const entityId = attr.entityId;
    if (entityId) {
      byEntity[entityId] = (byEntity[entityId] ?? 0) + 1;
    }
  }

  const total = Object.values(byEntity).reduce((s, n) => s + n, 0) || 1;
  const distribution = Object.entries(byEntity).map(([entityId, count]) => ({
    entityId,
    share: Math.round((count / total) * 10000),
  }));

  return c.json(distribution);
});

export default r;
