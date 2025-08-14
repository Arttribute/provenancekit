// File: app/api/agents/agent/route.ts
import { NextResponse } from "next/server";
import { pk } from "@/lib/provenance";
export const maxDuration = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }
  //fetch session data
  try {
    const session = await pk.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    console.log("Session data:", session);
    // Return the session data
    return NextResponse.json({ success: true, data: session });
  } catch (err: any) {
    console.error("Error fetching agent:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
