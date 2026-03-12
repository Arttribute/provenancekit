/**
 * POST /api/pk-proxy/claim
 *
 * Records an attached file in the ProvenanceKit provenance system.
 * Called when FileOwnershipClaim resolves — the file had no prior provenance
 * and the user has indicated whether they own it or not.
 *
 * Form fields:
 *   file     — the File blob to record
 *   owned    — "true" if the user created this file, "false" if it's external
 *   userId   — Privy DID of the current user
 *   mimeType — MIME type of the file (overrides file.type if set)
 *
 * On success:
 *   { cid, actionId?, status: "claimed" | "referenced" }
 *
 * Action semantics:
 *   owned=true  → action.type = "create"    — user is the creator/owner
 *   owned=false → action.type = "reference" — user cites an external source
 *
 * On-chain recording: if CHAIN_PRIVATE_KEY + BASE_SEPOLIA_RPC_URL are configured,
 * pk.file() fires an on-chain transaction automatically (fire-and-forget).
 */

import { NextRequest, NextResponse } from "next/server";
import { getPKClientAsync } from "@/lib/pk-client";

export const runtime = "nodejs";

function resourceTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "text";
}

export async function POST(req: NextRequest) {
  const pk = await getPKClientAsync();
  if (!pk) {
    return NextResponse.json({ error: "ProvenanceKit not configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const ownedRaw = form.get("owned");
  const userId = (form.get("userId") as string | null) ?? "anonymous";
  const mimeTypeOverride = form.get("mimeType") as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (ownedRaw === null) {
    return NextResponse.json({ error: "owned required" }, { status: 400 });
  }

  const owned = ownedRaw === "true";
  const mimeType = mimeTypeOverride ?? file.type ?? "application/octet-stream";
  const resourceType = resourceTypeFromMime(mimeType);

  try {
    const entityId = await pk.entity({ role: "human", name: userId });

    const result = await pk.file(file, {
      entity: { id: entityId, role: "human", name: userId },
      action: {
        type: owned ? "create" : "reference",
      },
      resourceType,
    });

    const status = owned ? "claimed" : "referenced";
    console.log(`[claim] ${status}: cid=${result.cid} user=${userId} owned=${owned}`);

    if (result.onchain) {
      console.log(`[claim] On-chain: txHash=${result.onchain.txHash} chain=${result.onchain.chainName}`);
    }

    return NextResponse.json({
      cid: result.cid,
      actionId: result.actionId,
      status,
      onchain: result.onchain ?? null,
    });
  } catch (err) {
    console.error("[claim] Failed to record provenance:", err);
    return NextResponse.json(
      { error: "Failed to record provenance" },
      { status: 500 }
    );
  }
}
