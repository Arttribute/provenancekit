// apps/provenancekit-api/src/handlers/activity.ts
import { Hono } from "hono";
import {
  createActivity,
  ActivityPayload,
} from "../services/activity.service.js";
import { ProvenanceKitError } from "../errors.js";
import { ZodError } from "zod";

const r = new Hono();

/**
 * POST /activity
 * Multipart form:  file=<binary>  json=<activity-payload-json-string>
 */
r.post("/activity", async (c) => {
  const form = await c.req.parseBody();

  if (!(form.file instanceof File))
    throw new ProvenanceKitError("MissingField", "`file` part is required", {
      recovery: "Attach the binary file in the multipart form",
    });

  if (typeof form.json !== "string")
    throw new ProvenanceKitError("MissingField", "`json` part is required", {
      recovery: "Attach a JSON string describing entity & action",
    });

  let payload: unknown;
  try {
    payload = JSON.parse(form.json);
  } catch {
    throw new ProvenanceKitError("InvalidField", "`json` is not valid JSON", {
      recovery: "Ensure `json` multipart field is a valid JSON string",
    });
  }

  /* High‑level validation with Zod to catch missing entity.role etc. */
  const parse = ActivityPayload.safeParse(payload);
  if (!parse.success) throw ProvenanceKitError.fromZod(parse.error);

  /* Business rule: entity.role must exist, performedBy must match */
  if (!parse.data.entity.role)
    throw new ProvenanceKitError("MissingField", "`entity.role` is required", {
      recovery:
        "Provide the role performing this action (human/ai/organization)",
    });

  const result = await createActivity(form.file, payload).catch((err) => {
    if (err instanceof ZodError) throw ProvenanceKitError.fromZod(err);
    throw err;
  });

  return c.json(result, 201);
});

export default r;
