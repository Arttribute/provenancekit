/**
 * GET /api/pk/bundle/[cid]
 *
 * Server-side proxy for ProvenanceKit bundle reads.
 * Keeps PROVENANCEKIT_API_KEY secret — clients fetch from here, not directly from PK API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPlatformClient } from "@/lib/provenance";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;

  const pk = getPlatformClient();
  if (!pk) {
    return NextResponse.json(
      { error: "ProvenanceKit not configured" },
      { status: 503 }
    );
  }

  try {
    const bundle = await pk.getBundle(cid);
    return NextResponse.json(bundle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch bundle";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
