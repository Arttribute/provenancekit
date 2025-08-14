// app/api/sessions/route.ts
import { NextResponse } from "next/server";
import { getPrivyUser } from "@/lib/privy-server";

const API = process.env.PROVENANCE_API_URL!;
const ADMIN = process.env.PROVENANCE_API_KEY ?? ""; // if your API needs a key

export async function GET(req: Request) {
  try {
    const { user } = await getPrivyUser(
      req.headers.get("authorization") ?? undefined
    );

    const url = API + `/sessions?privyUser=${encodeURIComponent(user.id)}`;

    const res = await fetch(url, {
      headers: ADMIN ? { Authorization: `Bearer ${ADMIN}` } : {},
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const sessions = (await res.json()) as Array<{
      id: string;
      title: string;
      createdAt: string;
      metadata: any;
    }>;

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        title: s.title ?? "Untitled session",
        createdAt: s.createdAt,
        metadata: s.metadata,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
