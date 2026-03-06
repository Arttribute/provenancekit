import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await mgmt(user.privyDid).apiKeys.list(projectId));
  } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    const key = await mgmt(user.privyDid).apiKeys.create(projectId, body);
    return NextResponse.json(key, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("403") ? 403 : 400 });
  }
}
