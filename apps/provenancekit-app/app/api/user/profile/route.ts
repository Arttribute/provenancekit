import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  try {
    await mgmt(user.privyDid).users.upsert(body);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
