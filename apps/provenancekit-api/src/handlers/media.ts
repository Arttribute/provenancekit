/**
 * Media Handler
 *
 * API endpoints for C2PA media provenance.
 *
 * Uses:
 * - @provenancekit/media: Reading C2PA content credentials
 */

import { Hono } from "hono";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";
import {
  readManifestFromBuffer,
  isAIGenerated,
  getC2PA,
  hasC2PA,
  SUPPORTED_FORMATS,
  isSupportedFormat,
  type ManifestReadResult,
} from "@provenancekit/media";

const r = new Hono();

/*─────────────────────────────────────────────────────────────*\
 | GET /media/formats                                          |
 | List supported media formats                                |
\*─────────────────────────────────────────────────────────────*/

r.get("/media/formats", (c) => {
  return c.json({
    supported: SUPPORTED_FORMATS,
    description: "Formats supported for C2PA manifest reading",
  });
});

/*─────────────────────────────────────────────────────────────*\
 | POST /media/read                                            |
 | Read C2PA manifest from uploaded media file                 |
\*─────────────────────────────────────────────────────────────*/

r.post("/media/read", async (c) => {
  const form = await c.req.parseBody();

  if (!(form.file instanceof File)) {
    throw new ProvenanceKitError("MissingField", "`file` part is required", {
      recovery: "Attach a media file (JPEG, PNG, etc.) in the multipart form",
    });
  }

  const file = form.file as File;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!isSupportedFormat(ext)) {
    throw new ProvenanceKitError("Unsupported", `Unsupported format: ${ext}`, {
      recovery: `Supported formats: ${SUPPORTED_FORMATS.join(", ")}`,
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await readManifestFromBuffer(buffer, ext);

    return c.json({
      hasManifest: true,
      c2pa: result.c2pa,
      resource: result.resource,
      actions: result.actions,
      entities: result.entities,
      attributions: result.attributions,
      isAIGenerated: result.c2pa.aiDisclosure?.isAIGenerated ?? false,
      validationStatus: result.c2pa.validationStatus ?? { isValid: true },
    });
  } catch (error) {
    // Check if the file simply has no manifest
    if (error instanceof Error && error.message.includes("no manifest")) {
      return c.json({
        hasManifest: false,
        message: "No C2PA manifest found in the file",
      });
    }

    throw new ProvenanceKitError("Internal", "Failed to read C2PA manifest", {
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/*─────────────────────────────────────────────────────────────*\
 | POST /media/verify                                          |
 | Verify C2PA manifest in uploaded media                      |
\*─────────────────────────────────────────────────────────────*/

r.post("/media/verify", async (c) => {
  const form = await c.req.parseBody();

  if (!(form.file instanceof File)) {
    throw new ProvenanceKitError("MissingField", "`file` part is required");
  }

  const file = form.file as File;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!isSupportedFormat(ext)) {
    throw new ProvenanceKitError("Unsupported", `Unsupported format: ${ext}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await readManifestFromBuffer(buffer, ext);

    return c.json({
      verified: result.c2pa.validationStatus?.isValid ?? true,
      signature: result.c2pa.signature,
      issuer: result.c2pa.signature?.issuer,
      signedAt: result.c2pa.signature?.timestamp,
      errors: result.c2pa.validationStatus?.errors ?? [],
      warnings: result.c2pa.validationStatus?.warnings ?? [],
    });
  } catch (error) {
    return c.json({
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed",
    });
  }
});

/*─────────────────────────────────────────────────────────────*\
 | POST /media/import                                          |
 | Import C2PA provenance as EAA records                       |
\*─────────────────────────────────────────────────────────────*/

r.post("/media/import", async (c) => {
  const form = await c.req.parseBody();

  if (!(form.file instanceof File)) {
    throw new ProvenanceKitError("MissingField", "`file` part is required");
  }

  const file = form.file as File;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!isSupportedFormat(ext)) {
    throw new ProvenanceKitError("Unsupported", `Unsupported format: ${ext}`);
  }

  const { dbStorage, fileStorage, ipfsGateway } = getContext();
  const buffer = Buffer.from(await file.arrayBuffer());

  // Read C2PA manifest
  let result: ManifestReadResult;
  try {
    result = await readManifestFromBuffer(buffer, ext);
  } catch (error) {
    throw new ProvenanceKitError("Unsupported", "No C2PA manifest found", {
      recovery: "Upload a file with embedded C2PA credentials",
      details: error instanceof Error ? error.message : undefined,
    });
  }

  // Upload file to IPFS
  const uploadResult = await fileStorage.upload(buffer, {
    name: file.name,
    mimeType: file.type,
  });
  const cid = uploadResult.ref.ref!;

  // Store entities
  for (const entity of result.entities) {
    try {
      await dbStorage.upsertEntity(entity);
    } catch {
      // Entity might already exist
    }
  }

  // Store actions
  for (const action of result.actions) {
    try {
      await dbStorage.createAction(action);
    } catch {
      // Action might already exist
    }
  }

  // Store resource with C2PA extension
  const resource = result.resource;
  if (resource) {
    try {
      await dbStorage.createResource({
        ...resource,
        address: { ref: cid, scheme: "cid" as const, size: buffer.length },
        locations: [{ uri: `${ipfsGateway}/${cid}`, provider: "ipfs" }],
        extensions: {
          ...resource.extensions,
          "ext:c2pa@1.0.0": result.c2pa,
        },
      });
    } catch {
      // Resource might already exist
    }
  }

  // Store attributions
  for (const attribution of result.attributions) {
    try {
      await dbStorage.createAttribution(attribution);
    } catch {
      // Attribution might already exist
    }
  }

  return c.json({
    success: true,
    cid,
    imported: {
      entities: result.entities.length,
      actions: result.actions.length,
      resource: resource ? 1 : 0,
      attributions: result.attributions.length,
    },
    c2pa: {
      title: result.c2pa.title,
      isAIGenerated: result.c2pa.aiDisclosure?.isAIGenerated ?? false,
      creator: result.c2pa.creativeWork?.author,
    },
  });
});

/*─────────────────────────────────────────────────────────────*\
 | GET /media/ai-check/:cid                                    |
 | Check if a resource was AI-generated                        |
\*─────────────────────────────────────────────────────────────*/

r.get("/media/ai-check/:cid", async (c) => {
  const cid = c.req.param("cid");
  if (!cid) {
    throw new ProvenanceKitError("MissingField", "cid path param required");
  }

  const { dbStorage } = getContext();

  const resource = await dbStorage.getResource(cid);
  if (!resource) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${cid}`);
  }

  // Check if resource has C2PA extension
  // Need to convert Resource to the expected MediaResource type
  const resourceAsMedia = {
    id: resource.address?.ref ?? cid,
    contentRef: resource.address ?? { ref: cid, scheme: "cid" as const },
    type: resource.type ?? "unknown",
    extensions: resource.extensions,
  };

  if (!hasC2PA(resourceAsMedia)) {
    return c.json({
      hasC2PA: false,
      isAIGenerated: null,
      message: "Resource does not have C2PA credentials",
    });
  }

  const c2pa = getC2PA(resourceAsMedia);

  return c.json({
    hasC2PA: true,
    isAIGenerated: isAIGenerated(resourceAsMedia),
    aiTool: c2pa?.aiDisclosure?.aiTool,
    disclosure: c2pa?.aiDisclosure,
  });
});

export default r;
