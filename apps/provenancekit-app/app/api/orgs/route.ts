import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  try {
    const org = await mgmt(user.privyDid).orgs.create(body);
    return NextResponse.json(org, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create org";
    const status = msg.includes("409") ? 409 : msg.includes("400") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
