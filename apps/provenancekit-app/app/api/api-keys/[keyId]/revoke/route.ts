import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ keyId: string }> }) {
  const { keyId } = await params;
  const user = await getAuthUser(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await mgmt(user.privyDid).apiKeys.revoke(keyId);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg.includes("403") ? 403 : msg.includes("409") ? 409 : 404;
    return NextResponse.json({ error: msg }, { status });
  }
}
