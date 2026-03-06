import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await mgmt(user.privyDid).orgs.get(orgSlug));
  } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    return NextResponse.json(await mgmt(user.privyDid).orgs.update(orgSlug, body));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("403") ? 403 : 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await mgmt(user.privyDid).orgs.delete(orgSlug);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("403") ? 403 : 500 });
  }
}
