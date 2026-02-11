// lib/provenance.ts
import { ProvenanceKit } from "@provenancekit/sdk";

const PROVENANCE_API = process.env.PROVENANCE_API_URL!;

if (!PROVENANCE_API) throw new Error("Missing PROVENANCE_API_URL env");

export const pk = new ProvenanceKit({ baseUrl: PROVENANCE_API });

/**
 * For the demo we'll just hardcode entity ids.
 * (You can persist real ids in DB/user session.)
 */
export const DEMO_AI_ID = "ent-ai-openai";
export const DEMO_TOOL_ID = "ent-tool-generic";

const cache = new Map<string, string>();

export async function ensureHumanEntity(opts: {
  privyId: string;
  wallet?: string | null;
  name?: string | null;
}) {
  const key = opts.privyId;
  const hit = cache.get(key);
  if (hit) return hit;

  const entityId = await pk.entity({
    role: "human",
    name: opts.name ?? key.slice(0, 8),
    publicKey: opts.wallet ?? undefined,
  });
  cache.set(key, entityId);
  return entityId;
}
