import { NextResponse } from "next/server";

/**
 * GET /api/settings/pk-status
 * Returns the ProvenanceKit configuration status.
 * Safe to expose to the browser — no secrets included.
 */
export async function GET() {
  const enabled = !!process.env.PK_API_KEY;

  return NextResponse.json({
    enabled,
    apiUrl: process.env.PK_API_URL ?? "https://api.provenancekit.com",
    projectId: process.env.PK_PROJECT_ID ?? null,
  });
}
