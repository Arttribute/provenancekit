/**
 * POST /api/auth/session  — exchange a Privy JWT for an httpOnly session cookie
 * DELETE /api/auth/session — clear the session cookie (sign out)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  verifyPrivyToken,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";
import { mgmt } from "@/lib/management-client";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);

  let claims: { userId: string };
  try {
    claims = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const privyDid = claims.userId;

  // Upsert user record via management API (non-fatal if it fails)
  try {
    const body = await req.json().catch(() => ({}));
    const { email, wallet, name } = body as {
      email?: string;
      wallet?: string;
      name?: string;
    };
    await mgmt(privyDid).users.upsert({ email, wallet, name });
  } catch {
    // Non-fatal — session still valid even if user upsert fails
  }

  await setSessionCookie(privyDid);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
