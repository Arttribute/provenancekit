/**
 * GET /api/pk/distribution/[cid]
 *
 * Server-side proxy for ProvenanceKit distribution calculation.
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
    const distribution = await pk.getDistribution(cid);
    return NextResponse.json({ entries: distribution });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to calculate distribution";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
