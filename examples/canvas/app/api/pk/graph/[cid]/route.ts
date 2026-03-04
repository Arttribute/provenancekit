/**
 * GET /api/pk/graph/[cid]?depth=3
 *
 * Server-side proxy for ProvenanceKit graph reads.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPlatformClient } from "@/lib/provenance";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  const depth = parseInt(req.nextUrl.searchParams.get("depth") ?? "3", 10);

  const pk = getPlatformClient();
  if (!pk) {
    return NextResponse.json(
      { error: "ProvenanceKit not configured" },
      { status: 503 }
    );
  }

  try {
    const graph = await pk.getGraph(cid, depth);
    return NextResponse.json(graph);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch graph";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
