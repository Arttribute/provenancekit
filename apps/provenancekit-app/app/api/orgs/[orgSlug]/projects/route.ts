import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await mgmt(user.privyDid).projects.list(orgSlug));
  } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    const project = await mgmt(user.privyDid).projects.create(orgSlug, body);
    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg.includes("409") ? 409 : msg.includes("403") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
