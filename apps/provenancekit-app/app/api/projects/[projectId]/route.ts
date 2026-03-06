import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    return NextResponse.json(await mgmt(user.privyDid).projects.update(projectId, body));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("403") ? 403 : 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await mgmt(user.privyDid).projects.delete(projectId);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("403") ? 403 : 500 });
  }
}
